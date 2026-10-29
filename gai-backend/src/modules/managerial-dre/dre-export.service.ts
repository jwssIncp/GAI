import { Injectable } from '@nestjs/common';
import { ExportJobEntity } from '../export-jobs/infrastructure/persistence/export-job.entity';
import { ExportJobAuditLogEntity } from '../export-jobs/infrastructure/persistence/export-job-audit-log.entity';
import { ExportJobType } from '../export-jobs/domain/enums/export-job-type.enum';
import { ExportJobStatus } from '../export-jobs/domain/enums/export-job-status.enum';
import { ExportJobAuditOperation } from '../export-jobs/domain/enums/export-job-audit-operation.enum';
import { ExportJobProcessorService } from '../export-jobs/application/services/export-job-processor.service';
import {
  FinanceExportService,
  FinanceWorkbook,
} from '../receivables/finance-export.service';
import { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { hash } from '../receivables/receivable.policy';
import { DreExportDto } from './dre.dto';
import { DreService } from './dre.service';
import { invalid } from './dre.policy';
@Injectable()
export class DreExportService {
  constructor(
    private readonly dre: DreService,
    private readonly processor: ExportJobProcessorService,
    private readonly files: FinanceExportService,
  ) {}
  async create(dto: DreExportDto, actor: ProjectActorContext) {
    const report = await this.dre.report(dto, actor);
    const permissions = [
      'dre:read',
      'dre:export',
      ...report.source_permissions,
    ];
    await this.dre.require(actor, [...permissions, 'export-jobs:create']);
    const sheets: FinanceWorkbook['sheets'] = [];
    const statement = {
      name: 'DRE Gerencial',
      headers: [
        'Moeda',
        'Linha',
        'Valor validado',
        'Apurado parcial',
        'Cobertura',
      ],
      rows: report.totals.flatMap((t) =>
        t.lines.map((l) => [
          t.currency,
          l.label,
          l.amount,
          l.known_amount,
          l.complete ? 'Validada' : 'Incompleta',
        ]),
      ),
    };
    if (dto.kind === 'statement') sheets.push(statement);
    if (dto.kind === 'projects')
      sheets.push({
        name: 'Projetos',
        headers: [
          'Projeto',
          'Moeda',
          'Linha',
          'Valor validado',
          'Apurado parcial',
        ],
        rows: report.by_project.flatMap((t) =>
          t.lines.map((l) => [
            t.project_id,
            t.currency,
            l.label,
            l.amount,
            l.known_amount,
          ]),
        ),
      });
    if (dto.kind === 'monthly' || dto.kind === 'statement')
      sheets.push({
        name: 'Comparativo mensal',
        headers: [
          'Competência',
          'Moeda',
          'Linha',
          'Validado',
          'Apurado parcial',
          'Fechado',
        ],
        rows: report.monthly.flatMap((t) =>
          t.lines.map((l) => [
            t.month,
            t.currency,
            l.label,
            l.amount,
            l.known_amount,
            t.closed,
          ]),
        ),
      });
    if (report.comparison)
      sheets.push({
        name: 'Período comparado',
        headers: [
          'Início',
          'Fim',
          'Moeda',
          'Linha',
          'Validado',
          'Apurado parcial',
        ],
        rows: report.comparison.totals.flatMap((t) =>
          t.lines.map((l) => [
            report.comparison!.start_month,
            report.comparison!.end_month,
            t.currency,
            l.label,
            l.amount,
            l.known_amount,
          ]),
        ),
      });
    const filtered = report.rows.filter((r) =>
      dto.kind === 'revenue'
        ? ['revenue', 'financial_income'].includes(r.group ?? '')
        : dto.kind === 'costs'
          ? r.group === 'direct_cost'
          : dto.kind === 'expenses'
            ? [
                'deductions',
                'operating_expense',
                'financial_expense',
                'income_tax',
              ].includes(r.group ?? '')
            : true,
    );
    if (dto.kind !== 'unclassified')
      sheets.push({
        name: 'Lançamentos',
        headers: [
          'Fato',
          'Revisão',
          'Competência',
          'Projeto',
          'Moeda',
          'Conta',
          'Grupo',
          'Descrição',
          'Valor',
          'Origem',
        ],
        rows: filtered.map((r) => [
          r.entry_id,
          r.revision,
          r.month,
          r.project_id,
          r.currency,
          r.account_name,
          r.group,
          r.description,
          r.amount,
          r.source_key,
        ]),
      });
    if (dto.kind === 'unclassified' || dto.kind === 'statement') {
      sheets.push({
        name: 'Não classificados',
        headers: ['Registro', 'Competência', 'Moeda', 'Valor', 'Motivo'],
        rows: report.unclassified.map((r) => [
          Number(r.entry_id),
          String(r.month),
          String(r.currency),
          String(r.amount),
          typeof r.reason === 'string' ? r.reason : '',
        ]),
      });
      sheets.push({
        name: 'Fontes sem competência',
        headers: [
          'Origem',
          'ID',
          'Projeto',
          'Moeda da origem',
          'Valor documental',
          'Saldo sem competência',
          'Data referência',
          'Descrição',
        ],
        rows: report.pending_sources.map((s) => [
          s.kind,
          s.id,
          s.project_id,
          s.currency,
          s.amount,
          s.remaining_amount ?? null,
          s.hint_date,
          s.description,
        ]),
      });
    }
    sheets.push({
      name: 'Cobertura e regras',
      headers: ['Informação', 'Valor'],
      rows: [
        ...report.warnings.map((w) => ['Aviso', w]),
        ['Motor', report.engine_version],
        ['Cobertura completa', String(report.complete)],
        ['Gerado em', report.generated_at],
        ['Filtros', JSON.stringify(report.filters)],
        ['Versões e hashes', JSON.stringify(report.entry_versions)],
        ...report.periods.map((p) => ['Fechamento ' + p.month, p.closure_hash]),
      ],
    });
    if (sheets.some((s) => s.rows.length > 50000))
      invalid('Limite de 50.000 linhas por aba.');
    const payload: FinanceWorkbook = {
      permissions,
      filters: report.filters,
      kind: 'dre:' + dto.kind,
      hash: hash(sheets),
      sheets,
    };
    const job = await this.dre.ds.transaction(async (m) => {
      const j = await m.save(
        ExportJobEntity,
        m.create(ExportJobEntity, {
          organizationId: report.organization_id,
          projectId: null,
          type: ExportJobType.DRE_XLSX,
          status: ExportJobStatus.PENDING,
          requestedById: actor.id,
          attemptCount: 1,
          requestedAt: new Date(),
          financePayload: payload,
        }),
      );
      await m.insert(ExportJobAuditLogEntity, {
        exportJobId: j.id,
        organizationId: report.organization_id,
        projectId: null,
        operation: ExportJobAuditOperation.REQUEST,
        performedBy: actor.id,
        changes: { kind: payload.kind, snapshot_hash: payload.hash },
      });
      return j;
    });
    this.processor.enqueue(Number(job.id));
    return { id: Number(job.id), status: job.status };
  }
  status(id: number, actor: ProjectActorContext) {
    return this.files.status(id, actor, ExportJobType.DRE_XLSX);
  }
  download(id: number, actor: ProjectActorContext) {
    return this.files.download(id, actor, ExportJobType.DRE_XLSX);
  }
}
