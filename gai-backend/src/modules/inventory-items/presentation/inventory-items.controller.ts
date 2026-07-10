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
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from '../application/dto/inventory-item-inputs';
import {
  InventoryItemListResponseDto,
  InventoryItemResponseDto,
} from '../application/dto/inventory-item-response.dto';
import { ListInventoryItemsQueryDto } from '../application/dto/list-inventory-items-query.dto';
import { InventoryItemActorContext } from '../application/services/inventory-item-scope.service';
import { CreateInventoryItemUseCase } from '../application/use-cases/create-inventory-item.use-case';
import { GetInventoryItemUseCase } from '../application/use-cases/get-inventory-item.use-case';
import { ListInventoryItemsUseCase } from '../application/use-cases/list-inventory-items.use-case';
import { UpdateInventoryItemStatusUseCase } from '../application/use-cases/update-inventory-item-status.use-case';
import { UpdateInventoryItemUseCase } from '../application/use-cases/update-inventory-item.use-case';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Inventory Items')
@ApiBearerAuth()
@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class InventoryItemsController {
  constructor(
    private readonly createInventoryItem: CreateInventoryItemUseCase,
    private readonly listInventoryItems: ListInventoryItemsUseCase,
    private readonly getInventoryItem: GetInventoryItemUseCase,
    private readonly updateInventoryItem: UpdateInventoryItemUseCase,
    private readonly updateInventoryItemStatus: UpdateInventoryItemStatusUseCase,
  ) {}

  @Post('projects/:projectId/inventory-items')
  @HttpCode(201)
  @RequirePermissions('inventory-items:create')
  @ApiOperation({ summary: 'Criar inventory item' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiCreatedResponse({ type: InventoryItemResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Mutacao bloqueada',
    'Project status blocks this operation',
  )
  async create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateInventoryItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createInventoryItem.execute(projectId, dto, this.toActor(req));
  }

  @Get('projects/:projectId/inventory-items')
  @RequirePermissions('inventory-items:read')
  @ApiOperation({ summary: 'Listar inventory items do project' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: InventoryItemListResponseDto })
  async listByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListInventoryItemsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listInventoryItems.execute(query, this.toActor(req), projectId);
  }

  @Get('projects/:projectId/inventory-items/:id')
  @RequirePermissions('inventory-items:read')
  @ApiOperation({ summary: 'Consultar inventory item do project' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getInventoryItem.execute(id, this.toActor(req), projectId);
  }

  @Patch('projects/:projectId/inventory-items/:id')
  @RequirePermissions('inventory-items:update')
  @ApiOperation({ summary: 'Atualizar inventory item' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Mutacao bloqueada',
    'Project status blocks this operation',
  )
  async update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInventoryItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateInventoryItem.execute(
      projectId,
      id,
      dto,
      this.toActor(req),
    );
  }

  @Post('projects/:projectId/inventory-items/:id/deactivate')
  @HttpCode(200)
  @RequirePermissions('inventory-items:deactivate')
  @ApiOperation({ summary: 'Desativar inventory item' })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  async deactivate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateInventoryItemStatus.execute(
      projectId,
      id,
      'deactivate',
      this.toActor(req),
    );
  }

  @Post('projects/:projectId/inventory-items/:id/reactivate')
  @HttpCode(200)
  @RequirePermissions('inventory-items:reactivate')
  @ApiOperation({ summary: 'Reativar inventory item' })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  async reactivate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateInventoryItemStatus.execute(
      projectId,
      id,
      'reactivate',
      this.toActor(req),
    );
  }

  @Get('inventory-items')
  @RequirePermissions('inventory-items:read')
  @ApiOperation({ summary: 'Listar inventory items globalmente' })
  @ApiOkResponse({ type: InventoryItemListResponseDto })
  async list(
    @Query() query: ListInventoryItemsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listInventoryItems.execute(query, this.toActor(req));
  }

  @Get('inventory-items/:id')
  @RequirePermissions('inventory-items:read')
  @ApiOperation({ summary: 'Consultar inventory item globalmente' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: InventoryItemResponseDto })
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getInventoryItem.execute(id, this.toActor(req));
  }

  private toActor(req: AuthenticatedRequest): InventoryItemActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
