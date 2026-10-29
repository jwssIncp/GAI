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
import { ReceivableService } from './receivable.service';
import { CashFlowService } from './cash-flow.service';
import { FinanceExportService } from './finance-export.service';
import {
  ConfirmReceivableDto,
  EditReceivableDto,
  FinanceCommandDto,
  FinanceExportDto,
  FinanceFilterDto,
  ReceiptDto,
  ReceivableInputDto,
  ReverseReceiptDto,
} from './receivable.dto';
@Controller('finance')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ReceivableController {
  constructor(
    private readonly r: ReceivableService,
    private readonly cash: CashFlowService,
    private readonly exports: FinanceExportService,
  ) {}
  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }
  @Get('sources/:kind/:id')
  @RequirePermissions('receivables:read', 'receivables:edit')
  source(
    @Param('kind') kind: string,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.r.source(kind, id, this.actor(req));
  }
  @Get('receivables')
  @RequirePermissions('receivables:read')
  list(@Query() f: FinanceFilterDto, @Req() req: Request) {
    return this.r.list(f, this.actor(req));
  }
  @Post('receivables/preview')
  @RequirePermissions('receivables:read', 'receivables:edit')
  preview(@Body() dto: ReceivableInputDto, @Req() req: Request) {
    return this.r.preview(dto, this.actor(req));
  }
  @Post('receivables')
  @RequirePermissions('receivables:read', 'receivables:edit')
  create(@Body() dto: ConfirmReceivableDto, @Req() req: Request) {
    return this.r.create(dto, this.actor(req));
  }
  @Get('receivables/:id')
  @RequirePermissions('receivables:read')
  detail(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.r.detail(id, this.actor(req));
  }
  @Put('receivables/:id')
  @RequirePermissions('receivables:read', 'receivables:edit')
  edit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditReceivableDto,
    @Req() req: Request,
  ) {
    return this.r.edit(id, dto, this.actor(req));
  }
  @Post('receivables/:id/receipts')
  @RequirePermissions('receivables:read', 'receivables:receive')
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiptDto,
    @Req() req: Request,
  ) {
    return this.r.receive(id, dto, this.actor(req));
  }
  @Post('receivables/:id/receipts/:eventId/reverse')
  @RequirePermissions('receivables:read', 'receivables:reverse')
  reverse(
    @Param('id', ParseIntPipe) id: number,
    @Param('eventId', ParseIntPipe) event: number,
    @Body() dto: ReverseReceiptDto,
    @Req() req: Request,
  ) {
    return this.r.reverse(id, event, dto, this.actor(req));
  }
  @Post('receivables/:id/cancel')
  @RequirePermissions('receivables:read', 'receivables:edit')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinanceCommandDto,
    @Req() req: Request,
  ) {
    return this.r.cancel(id, dto, this.actor(req));
  }
  @Get('cash-flow')
  @RequirePermissions('cash-flow:read')
  flow(@Query() f: FinanceFilterDto, @Req() req: Request) {
    return this.cash.report(f, this.actor(req));
  }
  @Post('exports')
  @RequirePermissions('finance:export', 'export-jobs:create')
  export(@Body() dto: FinanceExportDto, @Req() req: Request) {
    return this.exports.create(dto, this.actor(req));
  }
  @Get('exports/:id')
  @RequirePermissions('finance:export')
  status(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.exports.status(id, this.actor(req));
  }
  @Get('exports/:id/download')
  @RequirePermissions('finance:export', 'export-jobs:download')
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
