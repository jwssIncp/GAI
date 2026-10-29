import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  SessionAuthGuard,
  type AuthenticatedUser,
} from '../../auth/presentation/guards/session-auth.guard';
import {
  ConfirmValuationBatchDto,
  PreviewValuationBatchDto,
  ValuationSelectionRequest,
} from '../application/valuation-batch.dto';
import { InventoryOperationListQueryDto } from '../application/inventory-operation.dto';
import { ValuationBatchService } from '../application/valuation-batch.service';
interface AuthRequest extends Request {
  user: AuthenticatedUser;
}
@Controller('projects/:projectId/valuation-batches')
@ApiTags('Batch asset valuations')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ValuationBatchController {
  constructor(private readonly service: ValuationBatchService) {}
  @Post('selection')
  @RequirePermissions(
    'asset-valuations:read',
    'inventory-items:read',
    'asset-valuations:batch-create',
    'asset-valuations:create',
  )
  selection(
    @Param('projectId', ParseIntPipe) p: number,
    @Body() dto: ValuationSelectionRequest,
    @Req() r: AuthRequest,
  ) {
    return this.service.selection(p, dto.selection, r.user);
  }
  @Post('preview')
  @RequirePermissions(
    'asset-valuations:read',
    'inventory-items:read',
    'asset-valuations:batch-create',
    'asset-valuations:create',
  )
  preview(
    @Param('projectId', ParseIntPipe) p: number,
    @Body() dto: PreviewValuationBatchDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.preview(p, dto, r.user);
  }
  @Post(':id/confirm')
  @RequirePermissions(
    'asset-valuations:read',
    'inventory-items:read',
    'asset-valuations:batch-create',
    'asset-valuations:create',
  )
  confirm(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmValuationBatchDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.confirm(p, id, dto, r.user);
  }
  @Get()
  @RequirePermissions('asset-valuations:read', 'inventory-items:read')
  list(
    @Param('projectId', ParseIntPipe) p: number,
    @Query() q: InventoryOperationListQueryDto,
    @Req() r: AuthRequest,
  ) {
    return this.service.list(p, q, r.user);
  }
  @Get(':id')
  @RequirePermissions('asset-valuations:read', 'inventory-items:read')
  get(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() r: AuthRequest,
  ) {
    return this.service.get(p, id, r.user);
  }
}
