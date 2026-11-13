import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import { safeSpreadsheetText } from '../../project-dashboard/presentation/organization-overview.controller';
import {
  BatchPayDto,
  ChangePaymentDateDto,
  ConsolidatedPaymentsQueryDto,
  PaymentIdsDto,
} from '../application/dto/field-agent-payments.dto';
import { FieldAgentPaymentsService } from '../application/services/field-agent-payments.service';
import type { PaymentsExpensesActorContext } from '../application/services/payments-expenses-scope.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
const STATUS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

/** Financeiro › Pagamento de inventariantes (doc 06 §4): todos os projetos da organização. */
@Controller('field-agent-payments')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class FieldAgentPaymentsController {
  constructor(private readonly service: FieldAgentPaymentsService) {}

  private actor(req: AuthenticatedRequest): PaymentsExpensesActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }

  @Get()
  @RequirePermissions('payments:read')
  list(
    @Query() query: ConsolidatedPaymentsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(query, this.actor(req));
  }

  @Get('export')
  @RequirePermissions('payments:read', 'payments:export')
  async export(
    @Query() query: ConsolidatedPaymentsQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const data = await this.service.list(query, this.actor(req));
    const n = (v: string) => Number(v);
    const rows = data.items.map((r) => ({
      Status: STATUS[r.status] ?? r.status,
      Atrasado: r.overdue ? 'Sim' : 'Não',
      Projeto: safeSpreadsheetText(r.project_name),
      Inventariante: safeSpreadsheetText(r.field_agent_name),
      UF: r.state ?? '',
      'Data inicial': r.start_date,
      'Data final': r.end_date,
      'Data prevista de pagamento': r.expected_payment_date ?? '',
      'Data de pagamento': r.payment_date ?? '',
      Dias: r.days,
      Diária: n(r.daily_rate),
      Adicional: n(r.additional_amount),
      Total: n(r.total_amount),
      Descontos: n(r.discount_amount),
      Final: n(r.final_amount),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      'Pagamentos',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        data.summary.rows.map((a) => ({
          Inventariante: safeSpreadsheetText(a.name),
          Lançamentos: a.entries,
          Dias: a.days,
          Final: n(a.final),
          Pago: n(a.paid),
          'Em aberto': n(a.open),
        })),
      ),
      'Resumo por inventariante',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="pagamento-inventariantes.xlsx"',
    );
    return res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  @Post('pay')
  @HttpCode(200)
  @RequirePermissions('payments:read', 'payments:mark-as-paid')
  pay(@Body() dto: BatchPayDto, @Req() req: AuthenticatedRequest) {
    return this.service.pay(dto, this.actor(req));
  }

  @Post('revert')
  @HttpCode(200)
  @RequirePermissions('payments:read', 'payments:revert-payment')
  revert(@Body() dto: PaymentIdsDto, @Req() req: AuthenticatedRequest) {
    return this.service.revert(dto.ids, this.actor(req));
  }

  @Post(':id/date')
  @HttpCode(200)
  @RequirePermissions('payments:read', 'payments:reschedule')
  changeDate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePaymentDateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.changeDate(id, dto, this.actor(req));
  }
}
