import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import {
  SessionAuthGuard,
  AuthenticatedUser,
} from '../../auth/presentation/guards/session-auth.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { OrganizationOverviewQueryDto } from '../application/dto/organization-overview-query.dto';
import { OrganizationOverviewService } from '../application/services/organization-overview.service';

// Prefix untrusted spreadsheet text, including leading control/whitespace characters.
export function safeSpreadsheetText(value: string): string {
  let first = 0;
  while (
    first < value.length &&
    (value.charCodeAt(first) <= 31 || /\s/u.test(value[first]))
  )
    first++;
  return /^[=+@-]/.test(value.slice(first)) ||
    ['\t', '\r', '\n'].includes(value[0])
    ? `'${value}`
    : value;
}

@Controller('organization-overview')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('projects:read')
export class OrganizationOverviewController {
  constructor(private readonly overview: OrganizationOverviewService) {}

  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }

  @Get()
  get(@Query() query: OrganizationOverviewQueryDto, @Req() req: Request) {
    return this.overview.overview(query, this.actor(req));
  }

  @Get('export.csv')
  async csv(
    @Query() query: OrganizationOverviewQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rows = await this.overview.exportRows(query, this.actor(req));
    const escape = (value: string | number) =>
      `"${safeSpreadsheetText(String(value)).replace(/"/g, '""')}"`;
    const csv = [
      ['ID', 'Projeto', 'Status', 'Criado em'].map(escape).join(';'),
      ...rows.map((row) => Object.values(row).map(escape).join(';')),
    ].join('\r\n');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="visao-geral.csv"',
    );
    res.type('text/csv; charset=utf-8').send('\uFEFF' + csv);
  }

  @Get('projects')
  projects(@Query() query: OrganizationOverviewQueryDto, @Req() req: Request) {
    return this.overview.projectPage(query, this.actor(req));
  }

  @Get('companies')
  companies(@Query() query: OrganizationOverviewQueryDto, @Req() req: Request) {
    return this.overview.companyPage(query, this.actor(req));
  }

  @Get('export.xlsx')
  async excel(
    @Query() query: OrganizationOverviewQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rows = await this.overview.exportRows(query, this.actor(req));
    const safe = rows.map((row) => ({
      ...row,
      Projeto: safeSpreadsheetText(row.Projeto),
      Status: safeSpreadsheetText(row.Status),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(safe, {
        header: ['ID', 'Projeto', 'Status', 'Criado em'],
      }),
      'Projetos',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="visao-geral.xlsx"',
    );
    res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}
