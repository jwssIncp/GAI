import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import {
  CreateReportDto,
  CreateTemplateDto,
  EditReportDto,
  EditTemplateDto,
  RefreshReportDto,
  ReportRevisionDto,
  ResponsibleDto,
  TransitionReportDto,
} from './report.dto';
import { TechnicalReportsService } from './report.service';
const Access = (...keys: string[]) =>
  RequirePermissions('projects:read', 'technical-reports:read', ...keys);
@Controller('projects/:projectId/technical-reports')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class TechnicalReportsController {
  constructor(private readonly reports: TechnicalReportsService) {}
  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }
  @Get('templates') @Access() templates(
    @Param('projectId', ParseIntPipe) p: number,
    @Req() r: Request,
  ) {
    return this.reports.templates(p, this.actor(r));
  }
  @Get('templates/:id') @Access() template(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() r: Request,
  ) {
    return this.reports.templateDetail(p, id, this.actor(r));
  }
  @Post('templates') @Access('technical-reports:templates') createTemplate(
    @Param('projectId', ParseIntPipe) p: number,
    @Body() d: CreateTemplateDto,
    @Req() r: Request,
  ) {
    return this.reports.createTemplate(p, d, this.actor(r));
  }
  @Put('templates/:id') @Access('technical-reports:templates') editTemplate(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: EditTemplateDto,
    @Req() r: Request,
  ) {
    return this.reports.editTemplate(p, id, d, this.actor(r));
  }
  @Post('templates/:id/publish') @Access('technical-reports:templates') publish(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ReportRevisionDto,
    @Req() r: Request,
  ) {
    return this.reports.templateAction(p, id, d, this.actor(r), 'publish');
  }
  @Post('templates/:id/archive')
  @Access('technical-reports:templates')
  archiveTemplate(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ReportRevisionDto,
    @Req() r: Request,
  ) {
    return this.reports.templateAction(p, id, d, this.actor(r), 'archive');
  }
  @Get('responsibles') @Access() responsibles(
    @Param('projectId', ParseIntPipe) p: number,
    @Req() r: Request,
  ) {
    return this.reports.responsibles(p, this.actor(r));
  }
  @Post('responsibles') @Access('technical-reports:templates') responsible(
    @Param('projectId', ParseIntPipe) p: number,
    @Body() d: ResponsibleDto,
    @Req() r: Request,
  ) {
    return this.reports.createResponsible(p, d, this.actor(r));
  }
  @Get() @Access() list(
    @Param('projectId', ParseIntPipe) p: number,
    @Req() r: Request,
  ) {
    return this.reports.list(p, this.actor(r));
  }
  @Post() @Access('technical-reports:edit') create(
    @Param('projectId', ParseIntPipe) p: number,
    @Body() d: CreateReportDto,
    @Req() r: Request,
  ) {
    return this.reports.create(p, d, this.actor(r));
  }
  @Get(':id') @Access() detail(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() r: Request,
  ) {
    return this.reports.detail(p, id, this.actor(r));
  }
  @Put(':id') @Access('technical-reports:edit') edit(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: EditReportDto,
    @Req() r: Request,
  ) {
    return this.reports.edit(p, id, d, this.actor(r));
  }
  @Post(':id/refresh-sources') @Access('technical-reports:edit') refresh(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: RefreshReportDto,
    @Req() r: Request,
  ) {
    return this.reports.refresh(p, id, d, this.actor(r));
  }
  @Get(':id/validation') @Access() validate(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() r: Request,
  ) {
    return this.reports.validate(p, id, this.actor(r));
  }
  @Post(':id/transitions') @Access('technical-reports:approve') transition(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: TransitionReportDto,
    @Req() r: Request,
  ) {
    return this.reports.transition(p, id, d, this.actor(r));
  }
  @Get(':id/versions/:versionId') @Access() version(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) v: number,
    @Req() r: Request,
  ) {
    return this.reports.version(p, id, v, this.actor(r));
  }
  @Get(':id/versions/:versionId/export')
  @Access('technical-reports:export')
  async export(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) v: number,
    @Req() r: Request,
    @Res() res: Response,
  ) {
    const data = await this.reports.export(p, id, v, this.actor(r));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laudo-${id}-versao-${v}.json"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(JSON.stringify(data, null, 2));
  }
}
