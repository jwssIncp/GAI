import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { Request } from 'express';
import { IsCivilDate } from '../../common/validation/civil-date';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import { CashFlowBoardService } from './cash-flow-board.service';
import { CashFlowIndicatorsService } from './cash-flow-indicators.service';
import { ReceivableService } from './receivable.service';
import { DreMonthlyService } from '../managerial-dre/dre-monthly.service';

export class CashFlowBoardQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) project_id?: number;
  @IsOptional() @Matches(/^\d{4}$/) year?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) month?: string;
  @IsOptional() @IsCivilDate() as_of?: string;
}
export class CashFlowIndicatorsQueryDto extends CashFlowBoardQueryDto {
  @IsOptional() @Matches(/^\d{1,13}(\.\d{1,2})?$/) sim_value?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) sim_signal_month?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) sim_second_month?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) sim_third_month?: string;
  @IsOptional() @IsIn(['true', 'false']) sim_company_expenses?: string;
}
class KeysDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keys!: string[];
}
class DiscardDto extends KeysDto {
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
class InstallmentRefDto {
  @Type(() => Number) @IsInt() @Min(1) receivable_id!: number;
  @Type(() => Number) @IsInt() @Min(1) installment_id!: number;
}
class EventRefDto {
  @Type(() => Number) @IsInt() @Min(1) receivable_id!: number;
  @Type(() => Number) @IsInt() @Min(1) event_id!: number;
}
class ReceiveDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InstallmentRefDto)
  items!: InstallmentRefDto[];
  @IsCivilDate() received_on!: string;
}
class UndoReceiptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EventRefDto)
  items!: EventRefDto[];
}
class RescheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InstallmentRefDto)
  items!: InstallmentRefDto[];
  @IsCivilDate() due_on!: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}
class SettleDto extends KeysDto {
  /** Nulo desfaz a baixa. */
  @ValidateIf((_, v) => v !== null)
  @IsCivilDate()
  paid_on!: string | null;
}

/** Fluxo de caixa (etapa 7): visão, propostas de recebível, baixas de entrada e saída. */
@Controller('finance/cash-flow')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class CashFlowBoardController {
  constructor(
    private readonly board: CashFlowBoardService,
    private readonly indicatorsService: CashFlowIndicatorsService,
    private readonly receivables: ReceivableService,
    private readonly monthly: DreMonthlyService,
  ) {}

  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }

  @Get('board')
  @RequirePermissions('cash-flow:read')
  async get(@Query() q: CashFlowBoardQueryDto, @Req() req: Request) {
    const b = await this.board.board(q, this.actor(req));
    // Total do ano = resultado final da DRE mensal jan–dez (como o INVESTOR);
    // o total do fluxo continua em year.total.
    const org = this.receivables.org(this.actor(req), q.organization_id);
    const grid = await this.monthly.grid(org, b.reference.year, b.as_of);
    const dreTotal =
      grid?.lines.find((l) => l.key === 'final_result')?.total ?? null;
    return {
      ...b,
      kpis: b.kpis.map((k) =>
        k.currency === 'BRL'
          ? { ...k, year: { ...k.year, dre_total: dreTotal } }
          : k,
      ),
    };
  }

  /** Indicadores (etapa 8) e, com os campos sim_*, a simulação de venda (não grava). */
  @Get('indicators')
  @RequirePermissions('cash-flow:read')
  indicators(@Query() q: CashFlowIndicatorsQueryDto, @Req() req: Request) {
    const sim =
      q.sim_value &&
      q.sim_signal_month &&
      q.sim_second_month &&
      q.sim_third_month
        ? {
            value: q.sim_value,
            signal_month: q.sim_signal_month,
            second_month: q.sim_second_month,
            third_month: q.sim_third_month,
            company_expenses: q.sim_company_expenses === 'true',
          }
        : null;
    return this.indicatorsService.indicators(q, sim, this.actor(req));
  }

  @Post('proposals/confirm')
  @HttpCode(200)
  @RequirePermissions('cash-flow:read', 'receivables:edit')
  confirm(@Body() dto: KeysDto, @Req() req: Request) {
    return this.board.confirmProposals(dto.keys, this.actor(req));
  }

  @Post('proposals/discard')
  @HttpCode(200)
  @RequirePermissions('cash-flow:read', 'receivables:edit')
  discard(@Body() dto: DiscardDto, @Req() req: Request) {
    return this.board.discardProposals(dto.keys, dto.reason, this.actor(req));
  }

  @Post('receipts')
  @HttpCode(200)
  @RequirePermissions('cash-flow:read', 'receivables:receive')
  receive(@Body() dto: ReceiveDto, @Req() req: Request) {
    return this.board.receive(dto.items, dto.received_on, this.actor(req));
  }

  @Post('receipts/undo')
  @HttpCode(200)
  @RequirePermissions('cash-flow:read', 'receivables:reverse')
  undo(@Body() dto: UndoReceiptDto, @Req() req: Request) {
    return this.board.undoReceipts(dto.items, this.actor(req));
  }

  @Post('reschedule')
  @HttpCode(200)
  @RequirePermissions('cash-flow:read', 'receivables:reschedule')
  reschedule(@Body() dto: RescheduleDto, @Req() req: Request) {
    return this.board.reschedule(
      dto.items,
      dto.due_on,
      dto.reason,
      this.actor(req),
    );
  }

  @Post('outflows/settle')
  @HttpCode(200)
  @RequirePermissions('cash-flow:read')
  settle(@Body() dto: SettleDto, @Req() req: Request) {
    return this.board.settle(dto.keys, dto.paid_on, this.actor(req));
  }
}
