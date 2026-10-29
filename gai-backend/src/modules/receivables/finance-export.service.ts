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
  }>;
}
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
            r.source,
            r.source_id,
            r.receivable_id,
            r.installment_id,
            r.company_id,
            r.project_id,
            r.contract_id,
            r.currency,
            r.direction,
            r.view,
            r.on,
            r.amount,
            r.description,
            r.status,
          ]),
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
              r.status,
              r.sourceKey,
            ]),
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
                  i.status,
                ]),
            ),
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
                  e.operation,
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
          });
      }
      if (sheets.some((s) => s.rows.length > 50000))
        invalid('Exportação excede 50.000 linhas.');
      sheets.push({
        name: 'Filtros',
        headers: ['Campo', 'Valor'],
        rows: Object.entries({ ...dto.filters, kind: dto.kind }).map(
          ([k, v]) => [k, String(v)],
        ),
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
