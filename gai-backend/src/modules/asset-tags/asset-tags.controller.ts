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
import { AssetTagOrderInputDto, AssetTagOrderQueryDto } from './asset-tag.dto';
import { AssetTagsService } from './asset-tags.service';

/** Financeiro › Placas de patrimônio (doc 06 §5). */
@Controller('asset-tag-orders')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class AssetTagsController {
  constructor(private readonly service: AssetTagsService) {}

  private actor(req: Request) {
    const user = (req as Request & { user: AuthenticatedUser }).user;
    return {
      id: user.id,
      systemRoles: user.systemRoles,
      organizationId: user.organizationId,
    };
  }

  @Get()
  @RequirePermissions('asset-tag-orders:read')
  list(@Query() q: AssetTagOrderQueryDto, @Req() req: Request) {
    return this.service.list(q, this.actor(req));
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('asset-tag-orders:read', 'asset-tag-orders:edit')
  create(@Body() dto: AssetTagOrderInputDto, @Req() req: Request) {
    return this.service.create(dto, this.actor(req));
  }

  @Patch(':id')
  @RequirePermissions('asset-tag-orders:read', 'asset-tag-orders:edit')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssetTagOrderInputDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, this.actor(req));
  }

  @Delete(':id')
  @RequirePermissions('asset-tag-orders:read', 'asset-tag-orders:edit')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.remove(id, this.actor(req));
  }
}
