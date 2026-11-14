import {
  Body,
  Controller,
  Delete,
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
import type { Request } from 'express';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import {
  CommissionInputDto,
  CommissionQueryDto,
  PartnerInputDto,
} from './commission.dto';
import { CommissionsService } from './commissions.service';

/** Financeiro › Comissões e parceiros (doc 06 §6). */
@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  private actor(req: Request) {
    const user = (req as Request & { user: AuthenticatedUser }).user;
    return {
      id: user.id,
      systemRoles: user.systemRoles,
      organizationId: user.organizationId,
    };
  }

  @Get('commissions')
  @RequirePermissions('commissions:read')
  list(@Query() q: CommissionQueryDto, @Req() req: Request) {
    return this.service.list(q, this.actor(req));
  }

  @Post('commissions')
  @HttpCode(201)
  @RequirePermissions('commissions:read', 'commissions:edit')
  create(@Body() dto: CommissionInputDto, @Req() req: Request) {
    return this.service.create(dto, this.actor(req));
  }

  @Patch('commissions/:id')
  @RequirePermissions('commissions:read', 'commissions:edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CommissionInputDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, this.actor(req));
  }

  @Delete('commissions/:id')
  @RequirePermissions('commissions:read', 'commissions:edit')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.remove(id, this.actor(req));
  }

  @Get('commission-partners')
  @RequirePermissions('commissions:read')
  partners(@Req() req: Request) {
    return this.service.partners(this.actor(req));
  }

  @Post('commission-partners')
  @HttpCode(201)
  @RequirePermissions('commissions:read', 'commission-partners:edit')
  createPartner(@Body() dto: PartnerInputDto, @Req() req: Request) {
    return this.service.createPartner(dto, this.actor(req));
  }

  @Delete('commission-partners/:id')
  @RequirePermissions('commissions:read', 'commission-partners:edit')
  removePartner(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.removePartner(id, this.actor(req));
  }
}
