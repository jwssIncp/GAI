import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import { UpdateInventoryAccountingItemDto } from '../application/dto/inventory-accounting-item-inputs';
import {
  AccountingImportBatchListResponseDto,
  AccountingImportBatchResponseDto,
  InventoryAccountingItemListResponseDto,
  InventoryAccountingItemResponseDto,
} from '../application/dto/inventory-accounting-item-response.dto';
import {
  ListAccountingImportBatchesQueryDto,
  ListInventoryAccountingItemsQueryDto,
} from '../application/dto/list-inventory-accounting-items-query.dto';
import { InventoryAccountingItemActorContext } from '../application/services/inventory-accounting-item-scope.service';
import { InventoryAccountingItemsService } from '../application/services/inventory-accounting-items.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Inventory Accounting Items')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class InventoryAccountingItemsController {
  constructor(private readonly service: InventoryAccountingItemsService) {}

  @Post('accounting-imports')
  @HttpCode(201)
  @RequirePermissions('inventory-accounting-items:import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Importar base contabil XLSX' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: AccountingImportBatchResponseDto })
  async importAccountingItems(
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile()
    file: { originalname: string; buffer: Buffer; mimetype?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.importFile(projectId, file, this.toActor(req));
  }

  @Get('accounting-imports')
  @RequirePermissions('inventory-accounting-items:read')
  @ApiOperation({ summary: 'Listar batches de importacao contabil' })
  @ApiOkResponse({ type: AccountingImportBatchListResponseDto })
  async listBatches(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListAccountingImportBatchesQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listBatches(projectId, query, this.toActor(req));
  }

  @Get('accounting-imports/:batchId')
  @RequirePermissions('inventory-accounting-items:read')
  @ApiOperation({ summary: 'Consultar batch de importacao contabil' })
  @ApiOkResponse({ type: AccountingImportBatchResponseDto })
  async getBatch(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getBatch(projectId, batchId, this.toActor(req));
  }

  @Get('accounting-imports/:batchId/errors')
  @RequirePermissions('inventory-accounting-items:export-errors')
  @ApiOperation({ summary: 'Consultar erros de importacao contabil' })
  async getBatchErrors(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getBatchErrors(projectId, batchId, this.toActor(req));
  }

  @Get('inventory-accounting-items')
  @RequirePermissions('inventory-accounting-items:read')
  @ApiOperation({ summary: 'Listar itens contabeis do project' })
  @ApiOkResponse({ type: InventoryAccountingItemListResponseDto })
  async listItems(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListInventoryAccountingItemsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listItems(projectId, query, this.toActor(req));
  }

  @Get('inventory-accounting-items/:id')
  @RequirePermissions('inventory-accounting-items:read')
  @ApiOperation({ summary: 'Consultar item contabil' })
  @ApiOkResponse({ type: InventoryAccountingItemResponseDto })
  async getItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getItem(projectId, id, this.toActor(req));
  }

  @Patch('inventory-accounting-items/:id')
  @RequirePermissions('inventory-accounting-items:update')
  @ApiOperation({ summary: 'Atualizar item contabil' })
  @ApiOkResponse({ type: InventoryAccountingItemResponseDto })
  async updateItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInventoryAccountingItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateItem(projectId, id, dto, this.toActor(req));
  }

  @Post('inventory-accounting-items/:id/deactivate')
  @HttpCode(200)
  @RequirePermissions('inventory-accounting-items:deactivate')
  @ApiOperation({ summary: 'Desativar item contabil' })
  @ApiOkResponse({ type: InventoryAccountingItemResponseDto })
  async deactivate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.changeStatus(
      projectId,
      id,
      'deactivate',
      this.toActor(req),
    );
  }

  @Post('inventory-accounting-items/:id/reactivate')
  @HttpCode(200)
  @RequirePermissions('inventory-accounting-items:reactivate')
  @ApiOperation({ summary: 'Reativar item contabil' })
  @ApiOkResponse({ type: InventoryAccountingItemResponseDto })
  async reactivate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.changeStatus(
      projectId,
      id,
      'reactivate',
      this.toActor(req),
    );
  }

  private toActor(
    req: AuthenticatedRequest,
  ): InventoryAccountingItemActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
