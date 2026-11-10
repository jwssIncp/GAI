import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import {
  SessionAuthGuard,
  type AuthenticatedUser,
} from '../auth/presentation/guards/session-auth.guard';
import {
  ConfirmExpenseAttachmentUploadDto,
  CreateExpenseAttachmentUploadDto,
} from '../payments-expenses/application/dto/payments-expenses-inputs';
import {
  MobileExpenseCreateDto,
  MobileImportConfirmDto,
  MobileImportErrorsQueryDto,
  MobileImportFileDto,
  MobileImportPayloadDto,
  MobileImportSessionCreateDto,
  MobilePlateCheckQueryDto,
  MobilePlateReportQueryDto,
} from './dto/mobile-operations.dto';
import { MobileExpensesService } from './mobile-expenses.service';
import { MobileImportService } from './mobile-import.service';
import { MobilePlatesService } from './mobile-plates.service';

type AuthRequest = Request & { user?: AuthenticatedUser };

@ApiTags('Mobile')
@ApiBearerAuth()
@Controller('mobile/projects/:projectId/plates')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class MobilePlatesController {
  constructor(private readonly plates: MobilePlatesService) {}

  @Get('check')
  @RequirePermissions('inventory-items:read')
  @ApiOperation({
    summary: 'Placa já existe no projeto? (nova, antiga ou antiga 2)',
  })
  check(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: MobilePlateCheckQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.plates.check(req.user!, projectId, query);
  }

  @Get('report')
  @RequirePermissions('inventory-items:read')
  @ApiOperation({
    summary: 'Pendências: placas faltantes e duplicadas (somente leitura)',
  })
  report(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: MobilePlateReportQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.plates.report(req.user!, projectId, query);
  }
}

@ApiTags('Mobile')
@ApiBearerAuth()
@Controller('mobile/projects/:projectId/expenses')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class MobileExpensesController {
  constructor(private readonly expenses: MobileExpensesService) {}

  @Post()
  @RequirePermissions('expenses:create')
  @ApiOperation({
    summary:
      'Registrar despesa do próprio inventariante (idempotente por client_expense_id)',
    description:
      '201 created | 200 existing | 400 | 403 | 409 IDEMPOTENCY_KEY_REUSED/REQUEST_IN_PROGRESS/FIELD_AGENT_INELIGIBLE',
  })
  async create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: MobileExpenseCreateDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.expenses.create(req.user!, projectId, dto);
    res.status(result.result === 'created' ? 201 : 200);
    return result;
  }

  @Get()
  @RequirePermissions('expenses:read')
  list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: MobileImportErrorsQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.expenses.list(
      req.user!,
      projectId,
      query.page,
      query.page_size,
    );
  }

  @Post(':expenseId/attachments/upload-url')
  @HttpCode(201)
  @RequirePermissions('expenses:upload-attachment')
  requestAttachment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: CreateExpenseAttachmentUploadDto,
    @Req() req: AuthRequest,
  ) {
    return this.expenses.requestAttachment(
      req.user!,
      projectId,
      expenseId,
      dto,
    );
  }

  @Post(':expenseId/attachments/:attachmentId/confirm-upload')
  @HttpCode(200)
  @RequirePermissions('expenses:upload-attachment')
  confirmAttachment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Body() dto: ConfirmExpenseAttachmentUploadDto,
    @Req() req: AuthRequest,
  ) {
    return this.expenses.confirmAttachment(
      req.user!,
      projectId,
      expenseId,
      attachmentId,
      dto,
    );
  }
}

@ApiTags('Mobile')
@ApiBearerAuth()
@Controller('mobile/projects/:projectId/import-sessions')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class MobileImportController {
  constructor(private readonly imports: MobileImportService) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('import-sessions:create')
  @ApiOperation({ summary: 'Abrir sessão de reconciliação (expira em 7 dias)' })
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: MobileImportSessionCreateDto,
    @Req() req: AuthRequest,
  ) {
    return this.imports.create(req.user!, projectId, dto);
  }

  @Get(':uuid')
  @RequirePermissions('import-sessions:read')
  status(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Req() req: AuthRequest,
  ) {
    return this.imports.status(req.user!, projectId, uuid);
  }

  @Post(':uuid/files/upload-url')
  @HttpCode(201)
  @RequirePermissions('import-files:create')
  @ApiOperation({
    summary: 'URL pré-assinada para imagem ou backup (.zip) da sessão',
  })
  requestFile(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: MobileImportFileDto,
    @Req() req: AuthRequest,
  ) {
    return this.imports.requestFile(req.user!, projectId, uuid, dto);
  }

  @Post(':uuid/files/:fileId/confirm-upload')
  @HttpCode(200)
  @RequirePermissions('import-files:create')
  confirmFile(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Body() dto: MobileImportConfirmDto,
    @Req() req: AuthRequest,
  ) {
    return this.imports.confirmFile(req.user!, projectId, uuid, fileId, dto);
  }

  @Post(':uuid/payloads')
  @HttpCode(201)
  @RequirePermissions('import-payloads:create')
  @ApiOperation({
    summary:
      'Enviar lote de itens (idempotente por payload_number/idempotency_key)',
  })
  payload(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: MobileImportPayloadDto,
    @Req() req: AuthRequest,
  ) {
    return this.imports.payload(req.user!, projectId, uuid, dto);
  }

  @Post(':uuid/finish')
  @HttpCode(200)
  @RequirePermissions('import-sessions:finish')
  finish(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Req() req: AuthRequest,
  ) {
    return this.imports.finish(req.user!, projectId, uuid);
  }

  @Get(':uuid/errors')
  @RequirePermissions('import-errors:read')
  errors(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Query() query: MobileImportErrorsQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.imports.errors(
      req.user!,
      projectId,
      uuid,
      query.page,
      query.page_size,
    );
  }
}
