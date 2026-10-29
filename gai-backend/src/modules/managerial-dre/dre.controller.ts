import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
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
import { DreService } from './dre.service';
import { DreExportService } from './dre-export.service';
import {
  DreAccountDto,
  DreAccountEditDto,
  DreCloseDto,
  DreCommandDto,
  DreEntryDto,
  DreEntryEditDto,
  DreExportDto,
  DreReopenDto,
  DreReportDto,
  DreScopeDto,
} from './dre.dto';
@Controller('finance/dre')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class DreController {
  constructor(
    private readonly dre: DreService,
    private readonly exports: DreExportService,
  ) {}
  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }
  @Get('accounts') @RequirePermissions('dre:read') accounts(
    @Query() f: DreScopeDto,
    @Req() req: Request,
  ) {
    return this.dre.accounts(f, this.actor(req));
  }
  @Get('accounts/:id') @RequirePermissions('dre:read') account(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.dre.accountHistory(id, this.actor(req));
  }
  @Post('accounts')
  @RequirePermissions('dre:read', 'dre:configure')
  createAccount(
    @Query() f: DreScopeDto,
    @Body() d: DreAccountDto,
    @Req() req: Request,
  ) {
    return this.dre.createAccount(f, d, this.actor(req));
  }
  @Post('accounts/bootstrap')
  @RequirePermissions('dre:read', 'dre:configure')
  bootstrap(
    @Query() f: DreScopeDto,
    @Body() d: DreCommandDto,
    @Req() req: Request,
  ) {
    return this.dre.bootstrap(f, d, this.actor(req));
  }
  @Put('accounts/:id')
  @RequirePermissions('dre:read', 'dre:configure')
  editAccount(
    @Param('id', ParseIntPipe) id: number,
    @Query() f: DreScopeDto,
    @Body() d: DreAccountEditDto,
    @Req() req: Request,
  ) {
    return this.dre.editAccount(id, f, d, this.actor(req));
  }
  @Get('sources') @RequirePermissions('dre:read', 'dre:classify') sources(
    @Query() f: DreScopeDto,
    @Req() req: Request,
  ) {
    return this.dre.candidates(f, this.actor(req));
  }
  @Get('entries') @RequirePermissions('dre:read') entries(
    @Query() f: DreScopeDto,
    @Req() req: Request,
  ) {
    return this.dre.entries(f, this.actor(req));
  }
  @Get('entries/:id') @RequirePermissions('dre:read') entry(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.dre.detail(id, this.actor(req));
  }
  @Post('entries') @RequirePermissions('dre:read', 'dre:classify') create(
    @Query() f: DreScopeDto,
    @Body() d: DreEntryDto,
    @Req() req: Request,
  ) {
    return this.dre.createEntry(f, d, this.actor(req));
  }
  @Put('entries/:id')
  @RequirePermissions('dre:read', 'dre:classify', 'dre:adjust')
  edit(
    @Param('id', ParseIntPipe) id: number,
    @Query() f: DreScopeDto,
    @Body() d: DreEntryEditDto,
    @Req() req: Request,
  ) {
    return this.dre.editEntry(id, f, d, this.actor(req));
  }
  @Get('report') @RequirePermissions('dre:read') report(
    @Query() f: DreReportDto,
    @Req() req: Request,
  ) {
    return this.dre.report(f, this.actor(req));
  }
  @Get('periods') @RequirePermissions('dre:read') periods(
    @Query() f: DreScopeDto,
    @Req() req: Request,
  ) {
    return this.dre.periods(f, this.actor(req));
  }
  @Get('periods/:month') @RequirePermissions('dre:read') period(
    @Param('month') c: string,
    @Query() f: DreScopeDto,
    @Req() req: Request,
  ) {
    return this.dre.periodDetail(c, f, this.actor(req));
  }
  @Post('periods/:month/close')
  @RequirePermissions('dre:read', 'dre:periods')
  close(
    @Param('month') c: string,
    @Query() f: DreScopeDto,
    @Body() d: DreCloseDto,
    @Req() req: Request,
  ) {
    return this.dre.close(c, f, d, this.actor(req));
  }
  @Post('periods/:month/reopen')
  @RequirePermissions('dre:read', 'dre:periods')
  reopen(
    @Param('month') c: string,
    @Query() f: DreScopeDto,
    @Body() d: DreReopenDto,
    @Req() req: Request,
  ) {
    return this.dre.reopen(c, f, d, this.actor(req));
  }
  @Post('exports')
  @RequirePermissions('dre:read', 'dre:export', 'export-jobs:create')
  export(@Body() d: DreExportDto, @Req() req: Request) {
    return this.exports.create(d, this.actor(req));
  }
  @Get('exports/:id') @RequirePermissions('dre:export') status(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.exports.status(id, this.actor(req));
  }
  @Get('exports/:id/download')
  @RequirePermissions('dre:export', 'export-jobs:download')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.exports.download(id, this.actor(req));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.content);
  }
}
