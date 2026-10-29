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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  SessionAuthGuard,
  AuthenticatedUser,
} from '../auth/presentation/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import {
  BudgetDataDto,
  BudgetListDto,
  BudgetTransitionDto,
  BudgetVersionDto,
  PublishPricingDto,
} from './budget.dto';
import { BudgetService } from './budget.service';
@Controller('budgets')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class BudgetController {
  constructor(private readonly service: BudgetService) {}
  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }
  @Get('pricing')
  @RequirePermissions('budgets:read')
  pricing(@Query() f: BudgetListDto, @Req() req: Request) {
    return this.service.pricing(f, this.actor(req));
  }
  @Post('pricing')
  @RequirePermissions('budgets:read', 'budgets:configure-prices')
  publish(
    @Body() dto: PublishPricingDto,
    @Query() f: BudgetListDto,
    @Req() req: Request,
  ) {
    return this.service.publish(dto, this.actor(req), f.organization_id);
  }
  @Post('simulate')
  @RequirePermissions('budgets:read', 'budgets:edit')
  simulate(@Body() dto: BudgetDataDto, @Req() req: Request) {
    return this.service.simulate(dto, this.actor(req));
  }
  @Get()
  @RequirePermissions('budgets:read')
  list(@Query() f: BudgetListDto, @Req() req: Request) {
    return this.service.list(f, this.actor(req));
  }
  @Post()
  @RequirePermissions('budgets:read', 'budgets:edit')
  create(@Body() dto: BudgetDataDto, @Req() req: Request) {
    return this.service.create(dto, this.actor(req));
  }
  @Get(':id')
  @RequirePermissions('budgets:read')
  detail(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.detail(id, this.actor(req));
  }
  @Put(':id/versions')
  @RequirePermissions('budgets:read', 'budgets:edit')
  edit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BudgetVersionDto,
    @Req() req: Request,
  ) {
    return this.service.addVersion(id, dto, this.actor(req), false);
  }
  @Post(':id/scenarios')
  @RequirePermissions('budgets:read', 'budgets:edit')
  scenario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BudgetVersionDto,
    @Req() req: Request,
  ) {
    return this.service.addVersion(id, dto, this.actor(req), true);
  }
  @Post(':id/transitions')
  @RequirePermissions('budgets:read')
  transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BudgetTransitionDto,
    @Req() req: Request,
  ) {
    return this.service.transition(id, dto, this.actor(req));
  }
  @Get(':id/proposal')
  @RequirePermissions('budgets:read')
  proposal(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.proposal(id, this.actor(req));
  }
  @Get(':id/contract-preview')
  @RequirePermissions('budgets:read', 'budgets:approve')
  conversion(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.proposal(id, this.actor(req), true);
  }
}
