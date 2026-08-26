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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import {
  AddAccountabilityExpenseDto,
  CreateExpenseAccountabilityDto,
  GenerateExpenseInstallmentsDto,
  ExpenseAccountabilityListQueryDto,
  ExpenseInstallmentListQueryDto,
} from './expense-accountability.dto';
import {
  ExpenseAccountabilityActor,
  ExpenseAccountabilitiesService,
} from './expense-accountabilities.service';
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Expense Accountabilities')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ExpenseAccountabilitiesController {
  constructor(private readonly service: ExpenseAccountabilitiesService) {}
  @Post('expense-accountabilities')
  @HttpCode(201)
  @RequirePermissions('expense-accountabilities:create')
  @ApiOperation({ summary: 'Abrir prestacao de contas' })
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateExpenseAccountabilityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(projectId, dto, this.actor(req));
  }
  @Get('expense-accountabilities')
  @RequirePermissions('expense-accountabilities:read')
  @ApiOperation({ summary: 'Listar prestacoes de contas' })
  list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ExpenseAccountabilityListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(projectId, query, this.actor(req));
  }
  @Get('expense-accountabilities/:id')
  @RequirePermissions('expense-accountabilities:read')
  @ApiOperation({ summary: 'Consultar prestacao e despesas vinculadas' })
  get(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.get(projectId, id, this.actor(req));
  }
  @Post('expense-accountabilities/:id/expenses')
  @HttpCode(200)
  @RequirePermissions('expense-accountabilities:update')
  @ApiOperation({ summary: 'Vincular despesa a prestacao aberta' })
  addExpense(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddAccountabilityExpenseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addExpense(projectId, id, dto, this.actor(req));
  }
  @Post('expense-accountabilities/:id/close')
  @HttpCode(200)
  @RequirePermissions('expense-accountabilities:close')
  @ApiOperation({ summary: 'Fechar prestacao e recalcular total no backend' })
  close(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.close(projectId, id, this.actor(req));
  }
  @Post('expenses/:expenseId/installments/generate')
  @HttpCode(201)
  @RequirePermissions('expense-installments:create')
  @ApiOperation({
    summary: 'Gerar parcelas cuja soma preserva o valor da despesa',
  })
  generateInstallments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: GenerateExpenseInstallmentsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.generateInstallments(
      projectId,
      expenseId,
      dto,
      this.actor(req),
    );
  }
  @Get('expenses/:expenseId/installments')
  @RequirePermissions('expense-installments:read')
  @ApiOperation({ summary: 'Listar parcelas da despesa' })
  listInstallments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Query() query: ExpenseInstallmentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listInstallments(
      projectId,
      expenseId,
      query,
      this.actor(req),
    );
  }
  private actor(req: AuthenticatedRequest): ExpenseAccountabilityActor {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
