import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
  MobileImageConfirmDto,
  MobileImageListQueryDto,
  MobileImageUploadDto,
  MobileItemDeleteQueryDto,
  MobileItemListQueryDto,
  MobileItemSyncQueryDto,
  MobileItemUpsertDto,
} from './dto/mobile-items.dto';
import { MobileImagesService } from './mobile-images.service';
import { MobileItemsService } from './mobile-items.service';

type AuthRequest = Request & { user?: AuthenticatedUser };

@ApiTags('Mobile')
@ApiBearerAuth()
@Controller('mobile/projects/:projectId/items')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class MobileItemsController {
  constructor(
    private readonly items: MobileItemsService,
    private readonly images: MobileImagesService,
  ) {}

  @Get()
  @RequirePermissions('inventory-items:read')
  @ApiOperation({ summary: 'Listar itens do projeto (paginado)' })
  list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: MobileItemListQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.items.list(req.user!, projectId, query);
  }

  @Get('sync')
  @RequirePermissions('inventory-items:read')
  @ApiOperation({
    summary: 'Sincronização incremental por cursor (inclui excluídos)',
  })
  sync(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: MobileItemSyncQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.items.sync(req.user!, projectId, query.cursor, query.limit);
  }

  @Get(':externalId')
  @RequirePermissions('inventory-items:read')
  get(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('externalId') externalId: string,
    @Req() req: AuthRequest,
  ) {
    return this.items.get(req.user!, projectId, externalId);
  }

  @Put(':externalId')
  @RequirePermissions('inventory-items:create', 'inventory-items:update')
  @ApiOperation({
    summary: 'Criar ou atualizar item (idempotente, com controle de versão)',
    description:
      '201 created | 200 updated/unchanged | 400 | 403 | 404 ITEM_NOT_FOUND | 409 VERSION_CONFLICT/ITEM_DELETED/PROJECT_STATUS_BLOCKS_OPERATION',
  })
  async upsert(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('externalId') externalId: string,
    @Body() dto: MobileItemUpsertDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.items.upsert(
      req.user!,
      projectId,
      externalId,
      dto,
    );
    res.status(result.result === 'created' ? 201 : 200);
    return result;
  }

  @Delete(':externalId')
  @HttpCode(200)
  @RequirePermissions('inventory-items:deactivate')
  @ApiOperation({
    summary: 'Excluir item (lógico e idempotente)',
    description:
      '200 deleted/already_deleted | 404 ITEM_NOT_FOUND | 409 VERSION_CONFLICT',
  })
  remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('externalId') externalId: string,
    @Query() query: MobileItemDeleteQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.items.remove(
      req.user!,
      projectId,
      externalId,
      query.base_version,
    );
  }

  @Get(':externalId/images')
  @RequirePermissions(
    'inventory-item-images:read',
    'inventory-item-images:download',
  )
  listImages(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('externalId') externalId: string,
    @Query() query: MobileImageListQueryDto,
    @Req() req: AuthRequest,
  ) {
    return this.images.list(
      req.user!,
      projectId,
      externalId,
      query.with_urls !== 'false',
    );
  }

  @Post(':externalId/images/upload-url')
  @HttpCode(201)
  @RequirePermissions('inventory-item-images:create')
  requestUpload(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('externalId') externalId: string,
    @Body() dto: MobileImageUploadDto,
    @Req() req: AuthRequest,
  ) {
    return this.images.requestUpload(req.user!, projectId, externalId, dto);
  }

  @Post(':externalId/images/:imageId/confirm-upload')
  @HttpCode(200)
  @RequirePermissions('inventory-item-images:update')
  confirm(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('externalId') externalId: string,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body() dto: MobileImageConfirmDto,
    @Req() req: AuthRequest,
  ) {
    return this.images.confirm(req.user!, projectId, externalId, imageId, dto);
  }

  @Delete(':externalId/images/:imageId')
  @HttpCode(200)
  @RequirePermissions('inventory-item-images:remove')
  removeImage(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('externalId') externalId: string,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Req() req: AuthRequest,
  ) {
    return this.images.remove(req.user!, projectId, externalId, imageId);
  }
}
