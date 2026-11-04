import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { OrganizationOverviewQueryDto } from '../project-dashboard/application/dto/organization-overview-query.dto';
import { safeSpreadsheetText } from '../project-dashboard/presentation/organization-overview.controller';
import { CommercialPayload, CommercialService } from './commercial.service';
import { invalid } from './contract.policy';
@Controller('organization-overview/commercial')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('projects:read', 'commercial-indicators:read')
export class CommercialController {
  constructor(private readonly service: CommercialService) {}
  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }
  @Get()
  overview(
    @Query() filters: OrganizationOverviewQueryDto,
    @Req() req: Request,
  ) {
    return this.service.overview(filters, this.actor(req));
  }
  @Post('reports')
  save(@Body() filters: OrganizationOverviewQueryDto, @Req() req: Request) {
    return this.service.saveReport(filters, this.actor(req));
  }
  @Get('reports/:id')
  report(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.report(id, this.actor(req));
  }
  @Get('reports/:id/export.:format')
  async export(
    @Param('id', ParseIntPipe) id: number,
    @Param('format') format: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!['csv', 'xlsx'].includes(format))
      invalid('Formato de exportação inválido.');
    const report = await this.service.report(id, this.actor(req)),
      payload = report.payload as CommercialPayload;
    const rows = payload.rows.map((r) => ({
      ID: r.id,
      Projeto: r.project_id,
      Versao: r.revision,
      Contrato: r.number,
      Empresa: r.company_name,
      Contratacao: r.contracted_on ?? '',
      Moeda: r.currency,
      Original: r.original_value ?? '',
      Vigente: r.current_value ?? '',
      Status: r.status,
      Recorrente: r.recurring == null ? '' : String(r.recurring),
      Segmento: r.segment ?? '',
      UF: r.company_state ?? '',
      Servicos: r.services.join('; '),
      Bens: r.estimated_assets ?? '',
    }));
    const safe = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          typeof v === 'string' ? safeSpreadsheetText(v) : v,
        ]),
      ),
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contratos-relatorio-${id}.${format === 'csv' ? 'csv' : 'xlsx'}"`,
    );
    if (format === 'csv') {
      const headers = [
        'ID',
        'Projeto',
        'Versao',
        'Contrato',
        'Empresa',
        'Contratacao',
        'Moeda',
        'Original',
        'Vigente',
        'Status',
        'Recorrente',
        'Segmento',
        'UF',
        'Servicos',
        'Bens',
      ];
      const escape = (v: unknown) =>
        `"${(typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').replace(/"/g, '""')}"`;
      return res
        .type('text/csv; charset=utf-8')
        .send(
          '\uFEFF' +
            [
              headers.map(escape).join(';'),
              ...safe.map((r) => headers.map((k) => escape(r[k])).join(';')),
            ].join('\r\n'),
        );
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(safe),
      'Contratos',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          Relatorio: id,
          Gerado: report.recordedAt.toISOString(),
          Hash: payload.hash,
          Filtros: JSON.stringify(payload.filters),
        },
      ]),
      'Recorte',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        payload.totals.map((t) => ({
          Moeda: t.currency,
          Contratos: t.count,
          Original: t.original.value,
          Vigente: t.current.value,
          Ausentes: t.current.missing,
          Ticket: t.average,
          Ativos: t.active.value,
        })),
      ),
      'Indicadores',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        payload.annual.flatMap((a) =>
          a.totals.map((t) => ({
            Ano: a.year,
            Moeda: t.currency,
            Contratos: t.count,
            Original: t.original.value,
            Vigente: t.current.value,
            Ticket: t.average,
            Ausentes: t.current.missing,
          })),
        ),
      ),
      'Anual',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        payload.operational_stages.map((s) => ({
          Etapa: s.stage,
          Fonte: s.source,
          Registros: s.total,
          Concluidos: s.completed,
          Percentual: s.percentage,
        })),
      ),
      'Etapas',
    );
    for (const [title, groups] of [
      ['Segmentos', payload.segments],
      ['Empresas', payload.companies],
      ['UF', payload.states],
    ] as const) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          groups.flatMap((g) =>
            g.totals.map((t) => ({
              Grupo: safeSpreadsheetText(g.label),
              Moeda: t.currency,
              Contratos: t.count,
              Original: t.original.value,
              Vigente: t.current.value,
            })),
          ),
        ),
        title,
      );
    }
    return res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}
