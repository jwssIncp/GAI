import type { CellFormat } from '../export-jobs/application/services/export-cell-format';
import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { ExportJobEntity } from '../export-jobs/infrastructure/persistence/export-job.entity';
import { ExportJobAuditLogEntity } from '../export-jobs/infrastructure/persistence/export-job-audit-log.entity';
import { ExportJobStatus } from '../export-jobs/domain/enums/export-job-status.enum';
import { ExportJobType } from '../export-jobs/domain/enums/export-job-type.enum';
import { ExportJobAuditOperation } from '../export-jobs/domain/enums/export-job-audit-operation.enum';
import { ExportJobProcessorService } from '../export-jobs/application/services/export-job-processor.service';
import { CashFlowService } from './cash-flow.service';
import { ReceivableService } from './receivable.service';
import { FinanceExportDto } from './receivable.dto';
import { hash, invalid } from './receivable.policy';
export interface FinanceWorkbook {
  permissions: string[];
  filters: object;
  kind: string;
  hash: string;
  sheets: Array<{
    name: string;
    headers: string[];
    rows: (string | number | boolean | null)[][];
    /** Formato de cada coluna no Excel (moeda, data, mês…); nulo = como está. */
    formats?: Array<CellFormat | null>;
  }>;
}
/** Rótulos da planilha = rótulos da tela (nunca o código interno em inglês). */
const STATUS: Record<string, string> = {
  open: 'Em aberto',
  partial: 'Parcial',
  paid: 'Quitado',
  cancelled: 'Cancelado',
  overdue: 'Vencido',
};
const DIRECTION: Record<string, string> = { in: 'Entrada', out: 'Saída' };
const VIEW: Record<string, string> = {
  all: 'Previsto e realizado',
  expected: 'Previsto',
  actual: 'Realizado',
};
const SOURCE: Record<string, string> = {
  receivable_installment: 'Parcela de recebível',
  receivable_event: 'Recebimento',
  expense: 'Despesa',
  expense_installment: 'Parcela de despesa',
  field_agent_payment: 'Diária de inventariante',
};
const OPERATION: Record<string, string> = {
  create: 'Criação',
  edit: 'Edição',
  receipt: 'Recebimento',
  reversal: 'Estorno',
  cancel: 'Cancelamento',
  reschedule: 'Reprogramação',
};
const KIND: Record<string, string> = {
  receivables: 'Recebíveis',
  installments: 'Parcelas',
  receipts: 'Recebimentos',
  expected: 'Fluxo previsto',
  actual: 'Fluxo realizado',
  statement: 'Fluxo de caixa',
};
const FILTER: Record<string, string> = {
  organization_id: 'Organização (ID)',
  company_id: 'Cliente (ID)',
  project_id: 'Projeto (ID)',
  contract_id: 'Contrato (ID)',
  date_from: 'De',
  date_to: 'Até',
  status: 'Situação',
  view: 'Visão',
  direction: 'Direção',
  kind: 'Exportação',
};
const label = (
  map: Record<string, string>,
  v: string | number | null | undefined,
) => (v === null || v === undefined ? null : (map[String(v)] ?? String(v)));
const br = (v: string) => v.split('-').reverse().join('/');
/** Valor de filtro legível: datas dd/mm/aaaa e códigos pelo rótulo da tela. */
const filterValue = (k: string, v: unknown) => {
  const s =
    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : JSON.stringify(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return br(s);
  if (k === 'status') return label(STATUS, s);
  if (k === 'view') return label(VIEW, s);
  if (k === 'direction') return label({ ...DIRECTION, all: 'Todas' }, s);
  if (k === 'kind') return label(KIND, s);
  return s;
};

@Injectable()
export class FinanceExportService {
  constructor(
    private readonly r: ReceivableService,
    private readonly cash: CashFlowService,
    private readonly processor: ExportJobProcessorService,
  ) {}
  async create(dto: FinanceExportDto, actor: ProjectActorContext) {
    const keys = [
      'finance:export',
      'export-jobs:create',
      ...(['expected', 'actual', 'statement'].includes(dto.kind)
        ? [
            'cash-flow:read',
            ...(dto.filters.direction === 'out' ? [] : ['receivables:read']),
            ...(dto.filters.direction === 'in'
              ? []
              : [
                  'payments:read',
                  'expenses:read',
                  'expense-installments:read',
                ]),
          ]
        : ['receivables:read']),
    ];
    await this.r.require(actor, keys);
    const job = await this.r.ds.transaction('REPEATABLE READ', async (m) => {
      const org = await this.r.filterReferences(m, dto.filters, actor),
        sheets: FinanceWorkbook['sheets'] = [];
      if (['expected', 'actual', 'statement'].includes(dto.kind)) {
        const f = {
          ...dto.filters,
          view: dto.kind === 'statement' ? dto.filters.view : dto.kind,
        };
        const report = await this.cash.from(m, f, actor);
        sheets.push({
          name: 'Movimentos',
          headers: [
            'Fonte',
            'ID',
            'Recebível',
            'Parcela',
            'Cliente',
            'Projeto',
            'Contrato',
            'Moeda',
            'Direção',
            'Visão',
            'Data',
            'Valor',
            'Descrição',
            'Status',
          ],
          rows: report.movements.map((r) => [
            label(SOURCE, r.source),
            r.source_id,
            r.receivable_id,
            r.installment_id,
            r.company_id,
            r.project_id,
            r.contract_id,
            r.currency,
            label(DIRECTION, r.direction),
            label(VIEW, r.view),
            r.on,
            r.amount,
            r.description,
            label(STATUS, r.status),
          ]),
          formats: [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            'date',
            'money',
            null,
            null,
          ],
        });
        sheets.push({
          name: 'Indicadores',
          headers: [
            'Moeda',
            'Entradas previstas',
            'Saídas previstas',
            'Entradas realizadas',
            'Saídas realizadas',
            'Vencido',
            'Resultado realizado',
            'Resultado projetado',
          ],
          rows: report.totals.map((t) => [
            t.currency,
            t.expected_in,
            t.expected_out,
            t.actual_in,
            t.actual_out,
            t.overdue,
            t.actual_net,
            t.projected_net,
          ]),
          formats: [null, ...Array<CellFormat>(7).fill('money')],
        });
        sheets.push({
          name: 'Limitações',
          headers: ['Limitação'],
          rows: report.limitations.map((l) => [l]),
        });
      } else {
        const data = await this.r.list(
          {
            ...dto.filters,
            ...(dto.kind === 'receipts'
              ? { date_from: undefined, date_to: undefined }
              : {}),
            page: 1,
            page_size: 10000,
          },
          actor,
        );
        if (dto.kind === 'receivables')
          sheets.push({
            name: 'Recebíveis',
            headers: [
              'ID',
              'Cliente',
              'Projeto',
              'Contrato',
              'Descrição',
              'Moeda',
              'Original',
              'Recebido líquido',
              'Aberto',
              'Status',
              'Origem',
            ],
            rows: data.items.map((r) => [
              r.id,
              r.companyId,
              r.projectId,
              r.contractId,
              r.data.description,
              r.currency,
              r.amount,
              r.received,
              r.open,
              label(STATUS, r.status),
              r.sourceKey,
            ]),
            formats: [
              null,
              null,
              null,
              null,
              null,
              null,
              'money',
              'money',
              'money',
              null,
              null,
            ],
          });
        else if (dto.kind === 'installments')
          sheets.push({
            name: 'Parcelas',
            headers: [
              'Recebível',
              'ID',
              'Número',
              'Vencimento',
              'Moeda',
              'Valor',
              'Recebido',
              'Aberto',
              'Status',
            ],
            rows: data.items.flatMap((r) =>
              r.installments
                .filter(
                  (i) =>
                    (!dto.filters.date_from ||
                      i.dueOn >= dto.filters.date_from) &&
                    (!dto.filters.date_to || i.dueOn <= dto.filters.date_to),
                )
                .map((i) => [
                  r.id,
                  i.id,
                  i.position,
                  i.dueOn,
                  r.currency,
                  i.amount,
                  i.received,
                  i.open,
                  label(STATUS, i.status),
                ]),
            ),
            formats: [
              null,
              null,
              null,
              'date',
              null,
              'money',
              'money',
              'money',
              null,
            ],
          });
        else
          sheets.push({
            name: 'Recebimentos',
            headers: [
              'Recebível',
              'Evento',
              'Parcela',
              'Operação',
              'Data',
              'Moeda',
              'Valor',
              'Forma',
              'Referência',
              'Motivo',
              'Autor',
              'Registrado em',
            ],
            rows: data.items.flatMap((r) =>
              r.events
                .filter(
                  (e) =>
                    e.amount &&
                    e.effectiveOn &&
                    (!dto.filters.date_from ||
                      e.effectiveOn >= dto.filters.date_from) &&
                    (!dto.filters.date_to ||
                      e.effectiveOn <= dto.filters.date_to),
                )
                .map((e) => [
                  r.id,
                  e.id,
                  e.installmentId,
                  label(OPERATION, e.operation),
                  e.effectiveOn,
                  r.currency,
                  e.amount,
                  text(e.details.method),
                  text(e.details.reference),
                  text(e.details.reason),
                  e.actorId,
                  e.recordedAt.toISOString(),
                ]),
            ),
            formats: [
              null,
              null,
              null,
              null,
              'date',
              null,
              'money',
              null,
              null,
              null,
              null,
              'datetime',
            ],
          });
      }
      if (sheets.some((s) => s.rows.length > 50000))
        invalid('Exportação excede 50.000 linhas.');
      sheets.push({
        name: 'Filtros',
        headers: ['Campo', 'Valor'],
        rows: Object.entries({ ...dto.filters, kind: dto.kind })
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [FILTER[k] ?? k, filterValue(k, v)]),
      });
      const permissions = [
          ...new Set(keys.filter((k) => k !== 'export-jobs:create')),
        ],
        payload = {
          permissions,
          filters: dto.filters,
          kind: dto.kind,
          hash: hash(sheets),
          sheets,
        };
      const now = new Date();
      const saved = await m.save(
        ExportJobEntity,
        m.create(ExportJobEntity, {
          organizationId: org,
          projectId: null,
          type: ExportJobType.FINANCE_XLSX,
          status: ExportJobStatus.PENDING,
          requestedById: actor.id,
          attemptCount: 1,
          requestedAt: now,
          financePayload: payload,
        }),
      );
      await m.insert(ExportJobAuditLogEntity, {
        exportJobId: saved.id,
        organizationId: org,
        projectId: null,
        operation: ExportJobAuditOperation.REQUEST,
        performedBy: actor.id,
        changes: {
          kind: dto.kind,
          filters: dto.filters,
          snapshot_hash: payload.hash,
        },
      });
      return saved;
    });
    this.processor.enqueue(Number(job.id));
    return { id: Number(job.id), status: job.status };
  }
  private async job(
    id: number,
    actor: ProjectActorContext,
    download = false,
    type = ExportJobType.FINANCE_XLSX,
  ) {
    const job = await this.r.ds
      .getRepository(ExportJobEntity)
      .createQueryBuilder('j')
      .addSelect('j.financePayload')
      .where('j.id=:id AND j.type=:type', {
        id,
        type,
      })
      .getOne();
    if (!job || !job.financePayload)
      throw new NotFoundException('Exportação financeira não encontrada.');
    this.r.org(actor, Number(job.organizationId));
    await this.r.require(actor, [
      ...(download
        ? ['export-jobs:download']
        : [type === ExportJobType.DRE_XLSX ? 'dre:export' : 'finance:export']),
      ...job.financePayload.permissions,
    ]);
    return job;
  }
  async status(
    id: number,
    actor: ProjectActorContext,
    type = ExportJobType.FINANCE_XLSX,
  ) {
    const j = await this.job(id, actor, false, type);
    return {
      id: Number(j.id),
      status: j.status,
      error_message: j.errorMessage,
      expires_at: j.expiresAt,
    };
  }
  async download(
    id: number,
    actor: ProjectActorContext,
    type = ExportJobType.FINANCE_XLSX,
  ) {
    const j = await this.job(id, actor, true, type);
    if (
      j.status === ExportJobStatus.EXPIRED ||
      (j.expiresAt && j.expiresAt <= new Date())
    )
      throw new GoneException('Exportação expirada.');
    if (j.status !== ExportJobStatus.FINISHED)
      throw new ConflictException('Exportação ainda não disponível.');
    const row = await this.r.ds
      .getRepository(ExportJobEntity)
      .createQueryBuilder('j')
      .addSelect('j.fileContent')
      .where('j.id=:id', { id })
      .getOneOrFail();
    if (
      !row.fileContent ||
      !j.checksum ||
      hashBuffer(row.fileContent) !== j.checksum
    )
      throw new ConflictException(
        'Arquivo indisponível ou checksum divergente.',
      );
    await this.r.ds.manager.insert(ExportJobAuditLogEntity, {
      exportJobId: id,
      organizationId: j.organizationId,
      projectId: null,
      operation: ExportJobAuditOperation.DOWNLOAD,
      performedBy: actor.id,
      changes: { checksum: j.checksum },
    });
    return {
      content: row.fileContent,
      fileName: j.fileName ?? `financeiro-${id}.xlsx`,
    };
  }
}
import { createHash } from 'crypto';
function hashBuffer(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
