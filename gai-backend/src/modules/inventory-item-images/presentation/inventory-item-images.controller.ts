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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
} from '../../../common/swagger/api-error-responses';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import {
  ConfirmInventoryItemImageUploadDto,
  CreateInventoryItemImageUploadDto,
} from '../application/dto/inventory-item-image-inputs';
import {
  InventoryItemImageDownloadUrlResponseDto,
  InventoryItemImageListResponseDto,
  InventoryItemImageResponseDto,
  InventoryItemImageUploadUrlResponseDto,
} from '../application/dto/inventory-item-image-response.dto';
import { ListInventoryItemImagesQueryDto } from '../application/dto/list-inventory-item-images-query.dto';
import { InventoryItemImageActorContext } from '../application/services/inventory-item-image-scope.service';
import { ConfirmInventoryItemImageUploadUseCase } from '../application/use-cases/confirm-inventory-item-image-upload.use-case';
import { CreateInventoryItemImageDownloadUrlUseCase } from '../application/use-cases/create-inventory-item-image-download-url.use-case';
import { CreateInventoryItemImageUploadUrlUseCase } from '../application/use-cases/create-inventory-item-image-upload-url.use-case';
import { GetInventoryItemImageUseCase } from '../application/use-cases/get-inventory-item-image.use-case';
import { ListInventoryItemImagesUseCase } from '../application/use-cases/list-inventory-item-images.use-case';
import { RemoveInventoryItemImageUseCase } from '../application/use-cases/remove-inventory-item-image.use-case';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Inventory Item Images')
@ApiBearerAuth()
@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class InventoryItemImagesController {
  constructor(
    private readonly createUploadUrl: CreateInventoryItemImageUploadUrlUseCase,
    private readonly confirmUpload: ConfirmInventoryItemImageUploadUseCase,
    private readonly listImages: ListInventoryItemImagesUseCase,
    private readonly getImage: GetInventoryItemImageUseCase,
    private readonly createDownloadUrl: CreateInventoryItemImageDownloadUrlUseCase,
    private readonly removeImage: RemoveInventoryItemImageUseCase,
  ) {}

  @Post('projects/:projectId/inventory-items/:itemId/images/upload-url')
  @HttpCode(201)
  @RequirePermissions('inventory-item-images:create')
  @ApiOperation({ summary: 'Solicitar upload URL de imagem do item' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'itemId', type: 'integer', format: 'int64' })
  @ApiCreatedResponse({ type: InventoryItemImageUploadUrlResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Mutacao bloqueada',
    'Project status blocks this operation',
  )
  async requestUploadUrl(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CreateInventoryItemImageUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createUploadUrl.execute(
      projectId,
      itemId,
      dto,
      this.toActor(req),
    );
  }

  @Post(
    'projects/:projectId/inventory-items/:itemId/images/:imageId/confirm-upload',
  )
  @HttpCode(200)
  @RequirePermissions('inventory-item-images:update')
  @ApiOperation({ summary: 'Confirmar upload de imagem do item' })
  @ApiOkResponse({ type: InventoryItemImageResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Mutacao bloqueada',
    'Project status blocks this operation',
  )
  async confirmUploadUrl(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body() dto: ConfirmInventoryItemImageUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.confirmUpload.execute(
      projectId,
      itemId,
      imageId,
      dto ?? {},
      this.toActor(req),
    );
  }

  @Get('projects/:projectId/inventory-items/:itemId/images')
  @RequirePermissions('inventory-item-images:read')
  @ApiOperation({ summary: 'Listar imagens do item' })
  @ApiOkResponse({ type: InventoryItemImageListResponseDto })
  async list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query() query: ListInventoryItemImagesQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listImages.execute(projectId, itemId, query, this.toActor(req));
  }

  @Get('projects/:projectId/inventory-items/:itemId/images/:imageId')
  @RequirePermissions('inventory-item-images:read')
  @ApiOperation({ summary: 'Consultar imagem do item' })
  @ApiOkResponse({ type: InventoryItemImageResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getImage.execute(imageId, this.toActor(req), {
      projectId,
      itemId,
    });
  }

  @Post(
    'projects/:projectId/inventory-items/:itemId/images/:imageId/download-url',
  )
  @HttpCode(200)
  @RequirePermissions('inventory-item-images:download')
  @ApiOperation({ summary: 'Gerar download URL de imagem do item' })
  @ApiOkResponse({ type: InventoryItemImageDownloadUrlResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Imagem indisponivel',
    'Only uploaded images can be downloaded',
  )
  async requestDownloadUrl(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createDownloadUrl.execute(imageId, this.toActor(req), {
      projectId,
      itemId,
    });
  }

  @Post('projects/:projectId/inventory-items/:itemId/images/:imageId/remove')
  @HttpCode(200)
  @RequirePermissions('inventory-item-images:remove')
  @ApiOperation({ summary: 'Remover imagem logicamente' })
  @ApiOkResponse({ type: InventoryItemImageResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Mutacao bloqueada',
    'Project status blocks this operation',
  )
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.removeImage.execute(
      projectId,
      itemId,
      imageId,
      this.toActor(req),
    );
  }

  @Get('inventory-item-images/:id')
  @RequirePermissions('inventory-item-images:read')
  @ApiOperation({ summary: 'Consultar imagem globalmente' })
  @ApiOkResponse({ type: InventoryItemImageResponseDto })
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getImage.execute(id, this.toActor(req));
  }

  @Post('inventory-item-images/:id/download-url')
  @HttpCode(200)
  @RequirePermissions('inventory-item-images:download')
  @ApiOperation({ summary: 'Gerar download URL globalmente' })
  @ApiOkResponse({ type: InventoryItemImageDownloadUrlResponseDto })
  async requestDownloadUrlById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createDownloadUrl.execute(id, this.toActor(req));
  }

  private toActor(req: AuthenticatedRequest): InventoryItemImageActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
