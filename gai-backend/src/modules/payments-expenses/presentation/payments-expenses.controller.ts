import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import {
  ConfirmExpenseAttachmentUploadDto,
  CreateExpenseAttachmentUploadDto,
  ExpenseInputDto,
  MarkAsPaidDto,
  PaymentInputDto,
  RejectExpenseDto,
} from '../application/dto/payments-expenses-inputs';
import {
  ListExpensesQueryDto,
  ListPaymentsQueryDto,
} from '../application/dto/payments-expenses-query.dto';
import {
  AttachmentDownloadUrlResponseDto,
  AttachmentUploadUrlResponseDto,
  ExpenseAttachmentResponseDto,
  ExpenseListResponseDto,
  ExpenseResponseDto,
  PaymentListResponseDto,
  PaymentResponseDto,
  PaymentSummaryResponseDto,
} from '../application/dto/payments-expenses-response.dto';
import { PaymentsExpensesActorContext } from '../application/services/payments-expenses-scope.service';
import { PaymentsExpensesService } from '../application/services/payments-expenses.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Payments & Expenses')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class PaymentsExpensesController {
  constructor(private readonly service: PaymentsExpensesService) {}

  @Post('payments')
  @HttpCode(201)
  @RequirePermissions('payments:create')
  @ApiOperation({ summary: 'Criar pagamento' })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  createPayment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: PaymentInputDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createPayment(projectId, dto, this.toActor(req));
  }
  @Get('payments')
  @RequirePermissions('payments:read')
  @ApiOkResponse({ type: PaymentListResponseDto })
  listPayments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListPaymentsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listPayments(projectId, query, this.toActor(req));
  }
  @Get('payments/summary')
  @RequirePermissions('payments:read')
  @ApiOkResponse({ type: PaymentSummaryResponseDto })
  paymentSummary(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.paymentSummary(projectId, this.toActor(req));
  }
  @Get('payments/:id')
  @RequirePermissions('payments:read')
  @ApiOkResponse({ type: PaymentResponseDto })
  getPayment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getPayment(projectId, id, this.toActor(req));
  }
  @Patch('payments/:id')
  @RequirePermissions('payments:update')
  @ApiOkResponse({ type: PaymentResponseDto })
  updatePayment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PaymentInputDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updatePayment(projectId, id, dto, this.toActor(req));
  }
  @Post('payments/:id/approve')
  @HttpCode(200)
  @RequirePermissions('payments:approve')
  @ApiOkResponse({ type: PaymentResponseDto })
  approvePayment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.approvePayment(projectId, id, this.toActor(req));
  }
  @Post('payments/:id/mark-as-paid')
  @HttpCode(200)
  @RequirePermissions('payments:mark-as-paid')
  @ApiOkResponse({ type: PaymentResponseDto })
  markPaymentPaid(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkAsPaidDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.markPaymentPaid(projectId, id, dto, this.toActor(req));
  }
  @Post('payments/:id/cancel')
  @HttpCode(200)
  @RequirePermissions('payments:cancel')
  @ApiOkResponse({ type: PaymentResponseDto })
  cancelPayment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancelPayment(projectId, id, this.toActor(req));
  }

  @Post('expenses')
  @HttpCode(201)
  @RequirePermissions('expenses:create')
  @ApiCreatedResponse({ type: ExpenseResponseDto })
  createExpense(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ExpenseInputDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createExpense(projectId, dto, this.toActor(req));
  }
  @Get('expenses')
  @RequirePermissions('expenses:read')
  @ApiOkResponse({ type: ExpenseListResponseDto })
  listExpenses(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListExpensesQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listExpenses(projectId, query, this.toActor(req));
  }
  @Get('expenses/:id')
  @RequirePermissions('expenses:read')
  @ApiOkResponse({ type: ExpenseResponseDto })
  getExpense(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getExpense(projectId, id, this.toActor(req));
  }
  @Patch('expenses/:id')
  @RequirePermissions('expenses:update')
  @ApiOkResponse({ type: ExpenseResponseDto })
  updateExpense(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExpenseInputDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateExpense(projectId, id, dto, this.toActor(req));
  }
  @Post('expenses/:id/approve')
  @HttpCode(200)
  @RequirePermissions('expenses:approve')
  @ApiOkResponse({ type: ExpenseResponseDto })
  approveExpense(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.approveExpense(projectId, id, this.toActor(req));
  }
  @Post('expenses/:id/reject')
  @HttpCode(200)
  @RequirePermissions('expenses:reject')
  @ApiOkResponse({ type: ExpenseResponseDto })
  rejectExpense(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectExpenseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.rejectExpense(projectId, id, dto, this.toActor(req));
  }
  @Post('expenses/:id/mark-as-paid')
  @HttpCode(200)
  @RequirePermissions('expenses:mark-as-paid')
  @ApiOkResponse({ type: ExpenseResponseDto })
  markExpensePaid(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.markExpensePaid(projectId, id, this.toActor(req));
  }
  @Post('expenses/:id/cancel')
  @HttpCode(200)
  @RequirePermissions('expenses:cancel')
  @ApiOkResponse({ type: ExpenseResponseDto })
  cancelExpense(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancelExpense(projectId, id, this.toActor(req));
  }

  @Post('expenses/:expenseId/attachments/upload-url')
  @HttpCode(201)
  @RequirePermissions('expenses:upload-attachment')
  @ApiCreatedResponse({ type: AttachmentUploadUrlResponseDto })
  createAttachmentUploadUrl(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: CreateExpenseAttachmentUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createAttachmentUploadUrl(
      projectId,
      expenseId,
      dto,
      this.toActor(req),
    );
  }
  @Post('expenses/:expenseId/attachments/:attachmentId/confirm-upload')
  @HttpCode(200)
  @RequirePermissions('expenses:upload-attachment')
  @ApiOkResponse({ type: ExpenseAttachmentResponseDto })
  confirmAttachment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Body() dto: ConfirmExpenseAttachmentUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.confirmAttachment(
      projectId,
      expenseId,
      attachmentId,
      dto,
      this.toActor(req),
    );
  }
  @Get('expenses/:expenseId/attachments')
  @RequirePermissions('expenses:read')
  @ApiOkResponse({ type: [ExpenseAttachmentResponseDto] })
  listAttachments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listAttachments(
      projectId,
      expenseId,
      this.toActor(req),
    );
  }
  @Post('expenses/:expenseId/attachments/:attachmentId/download-url')
  @HttpCode(200)
  @RequirePermissions('expenses:download-attachment')
  @ApiOkResponse({ type: AttachmentDownloadUrlResponseDto })
  downloadAttachment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.downloadAttachment(
      projectId,
      expenseId,
      attachmentId,
      this.toActor(req),
    );
  }
  @Post('expenses/:expenseId/attachments/:attachmentId/remove')
  @HttpCode(200)
  @RequirePermissions('expenses:upload-attachment')
  @ApiOkResponse({ type: ExpenseAttachmentResponseDto })
  removeAttachment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeAttachment(
      projectId,
      expenseId,
      attachmentId,
      this.toActor(req),
    );
  }

  private toActor(req: AuthenticatedRequest): PaymentsExpensesActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
