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
import type { Request } from 'express';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import {
  FinanceSettingsQueryDto,
  PublishFinanceSettingsDto,
} from './finance-settings.dto';
import { FinanceSettingsService } from './finance-settings.service';

@Controller('finance-settings')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class FinanceSettingsController {
  constructor(private readonly service: FinanceSettingsService) {}

  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }

  @Get()
  @RequirePermissions('finance-settings:read')
  overview(@Query() query: FinanceSettingsQueryDto, @Req() req: Request) {
    return this.service.overview(this.actor(req), query.organization_id);
  }

  @Get('defaults')
  @RequirePermissions('finance-settings:read')
  defaults() {
    return this.service.defaults();
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('finance-settings:read', 'finance-settings:update')
  publish(
    @Body() dto: PublishFinanceSettingsDto,
    @Query() query: FinanceSettingsQueryDto,
    @Req() req: Request,
  ) {
    return this.service.publish(dto, this.actor(req), query.organization_id);
  }
}
