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
  CreateCatalogAssetDto,
  UpdateCatalogAssetDto,
} from '../application/dto/catalog-asset-inputs';
import {
  CatalogAssetListResponseDto,
  CatalogAssetResponseDto,
} from '../application/dto/catalog-asset-response.dto';
import { ListCatalogAssetsQueryDto } from '../application/dto/list-catalog-assets-query.dto';
import { CatalogAssetActorContext } from '../application/services/catalog-asset-scope.service';
import { CreateCatalogAssetUseCase } from '../application/use-cases/create-catalog-asset.use-case';
import { GetCatalogAssetUseCase } from '../application/use-cases/get-catalog-asset.use-case';
import { ListCatalogAssetsUseCase } from '../application/use-cases/list-catalog-assets.use-case';
import { UpdateCatalogAssetStatusUseCase } from '../application/use-cases/update-catalog-asset-status.use-case';
import { UpdateCatalogAssetUseCase } from '../application/use-cases/update-catalog-asset.use-case';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Catalog Assets')
@ApiBearerAuth()
@Controller('catalog-assets')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class CatalogAssetsController {
  constructor(
    private readonly createCatalogAsset: CreateCatalogAssetUseCase,
    private readonly listCatalogAssets: ListCatalogAssetsUseCase,
    private readonly getCatalogAsset: GetCatalogAssetUseCase,
    private readonly updateCatalogAsset: UpdateCatalogAssetUseCase,
    private readonly updateCatalogAssetStatus: UpdateCatalogAssetStatusUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('catalog-assets:create')
  @ApiOperation({ summary: 'Criar catalog asset' })
  @ApiCreatedResponse({ type: CatalogAssetResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse('Conflito', 'Catalog asset description already exists')
  async create(
    @Body() dto: CreateCatalogAssetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createCatalogAsset.execute(dto, this.toActor(req));
  }

  @Get()
  @RequirePermissions('catalog-assets:read')
  @ApiOperation({ summary: 'Listar catalog assets (paginado)' })
  @ApiOkResponse({ type: CatalogAssetListResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async list(
    @Query() query: ListCatalogAssetsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listCatalogAssets.execute(query, this.toActor(req));
  }

  @Get(':id')
  @RequirePermissions('catalog-assets:read')
  @ApiOperation({ summary: 'Consultar catalog asset por ID' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: CatalogAssetResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getCatalogAsset.execute(id, this.toActor(req));
  }

  @Patch(':id')
  @RequirePermissions('catalog-assets:update')
  @ApiOperation({ summary: 'Atualizar catalog asset' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: CatalogAssetResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse('Conflito', 'Catalog asset description already exists')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatalogAssetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateCatalogAsset.execute(id, dto, this.toActor(req));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions('catalog-assets:deactivate')
  @ApiOperation({ summary: 'Desativar catalog asset' })
  @ApiOkResponse({ type: CatalogAssetResponseDto })
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateCatalogAssetStatus.execute(
      id,
      'deactivate',
      this.toActor(req),
    );
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @RequirePermissions('catalog-assets:reactivate')
  @ApiOperation({ summary: 'Reativar catalog asset' })
  @ApiOkResponse({ type: CatalogAssetResponseDto })
  async reactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateCatalogAssetStatus.execute(
      id,
      'reactivate',
      this.toActor(req),
    );
  }

  private toActor(req: AuthenticatedRequest): CatalogAssetActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
