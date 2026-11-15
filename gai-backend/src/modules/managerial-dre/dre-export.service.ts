import type { CellFormat } from '../export-jobs/application/services/export-cell-format';
import { GROUP_LABELS } from './dre.policy';
import type { DreGroup } from './dre.dto';
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
    // Valores como número: texto começando com "-" seria prefixado pela
    // proteção contra fórmulas e o negativo viraria texto na planilha.
    const num = (v: string | null) => (v === null ? null : Number(v));
    const report = await this.dre.report(dto, actor);
    // Rótulos da tela: projeto pelo nome (código), grupo pelo nome e Sim/Não.
    const projectName = new Map(
      (report.projects ?? []).map((p) => [
        p.id,
        p.code ? `${p.name} (${p.code})` : p.name,
      ]),
    );
    const project = (id: number | null) =>
      id === null ? 'Sem projeto' : (projectName.get(id) ?? `Projeto ${id}`);
    const group = (g: string | null) =>
      g ? (GROUP_LABELS[g as DreGroup] ?? g) : 'Sem grupo';
    const yes = (b: boolean) => (b ? 'Sim' : 'Não');
    const br = (m: string) => m.split('-').reverse().join('/');
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
          num(l.amount),
          num(l.known_amount),
          l.complete ? 'Validada' : 'Incompleta',
        ]),
      ),
      formats: [null, null, 'money', 'money', null] as Array<CellFormat | null>,
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
            project(t.project_id),
            t.currency,
            l.label,
            num(l.amount),
            num(l.known_amount),
          ]),
        ),
        formats: [null, null, null, 'money', 'money'],
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
            num(l.amount),
            num(l.known_amount),
            yes(t.closed),
          ]),
        ),
        formats: ['month', null, null, 'money', 'money', null],
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
            num(l.amount),
            num(l.known_amount),
          ]),
        ),
        formats: ['month', 'month', null, null, 'money', 'money'],
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
          project(r.project_id),
          r.currency,
          r.account_name,
          group(r.group),
          r.description,
          num(r.amount),
          r.source_key,
        ]),
        formats: [
          null,
          null,
          'month',
          null,
          null,
          null,
          null,
          null,
          'money',
          null,
        ],
      });
    if (dto.kind === 'unclassified' || dto.kind === 'statement') {
      sheets.push({
        name: 'Não classificados',
        headers: ['Registro', 'Competência', 'Moeda', 'Valor', 'Motivo'],
        rows: report.unclassified.map((r) => [
          Number(r.entry_id),
          String(r.month),
          String(r.currency),
          num(String(r.amount)),
          typeof r.reason === 'string' ? r.reason : '',
        ]),
        formats: [null, 'month', null, 'money', null],
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
          project(s.project_id),
          s.currency,
          num(s.amount),
          num(s.remaining_amount ?? null),
          s.hint_date,
          s.description,
        ]),
        formats: [null, null, null, null, 'money', 'money', 'date', null],
      });
    }
    sheets.push({
      name: 'Cobertura e regras',
      headers: ['Informação', 'Valor'],
      rows: [
        ...report.warnings.map((w) => ['Aviso', w]),
        ['Motor', report.engine_version],
        ['Cobertura completa', yes(report.complete)],
        ['Gerado em', report.generated_at],
        ['Filtros', JSON.stringify(report.filters)],
        ['Versões e hashes', JSON.stringify(report.entry_versions)],
        ...report.periods.map((p) => [
          'Fechamento ' + br(p.month),
          p.closure_hash,
        ]),
      ],
      // "Gerado em" (3ª linha depois dos avisos) sai como data e hora
      formats: [null, null],
    });
    const info = sheets[sheets.length - 1];
    const generated = info.rows.findIndex((r) => r[0] === 'Gerado em');
    if (generated >= 0)
      info.rows[generated][1] = new Date(report.generated_at).toLocaleString(
        'pt-BR',
        {
          timeZone: 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'short',
        },
      );
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
