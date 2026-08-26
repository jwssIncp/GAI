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
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import {
  ConsolidateReconciliationDto,
  CreateAssetValuationDto,
  CreateInventoryObservationDto,
  CreateInventorySessionDto,
  InventoryOperationResponseDto,
  InventoryOperationListQueryDto,
  InventoryObservationListQueryDto,
  InventorySessionListQueryDto,
  ReconciliationListQueryDto,
  RequestReinventoryDto,
} from '../application/inventory-operation.dto';
import {
  InventoryOperationActor,
  InventoryOperationsService,
} from '../application/inventory-operations.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Inventory Operations')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class InventoryOperationsController {
  constructor(private readonly service: InventoryOperationsService) {}

  @Post('inventory-sessions')
  @HttpCode(201)
  @RequirePermissions('inventory-sessions:create')
  @ApiOperation({ summary: 'Criar campanha/sessao de inventario' })
  @ApiCreatedResponse({ type: InventoryOperationResponseDto })
  createSession(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateInventorySessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createSession(projectId, dto, this.actor(req));
  }

  @Get('inventory-sessions')
  @RequirePermissions('inventory-sessions:read')
  @ApiOperation({ summary: 'Listar sessoes de inventario' })
  listSessions(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: InventorySessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listSessions(projectId, query, this.actor(req));
  }

  @Get('inventory-sessions/:sessionId')
  @RequirePermissions('inventory-sessions:read')
  @ApiOperation({ summary: 'Consultar sessao de inventario' })
  getSession(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getSession(projectId, sessionId, this.actor(req));
  }

  @Post('inventory-sessions/:sessionId/start')
  @HttpCode(200)
  @RequirePermissions('inventory-sessions:update')
  @ApiOperation({ summary: 'Iniciar sessao e primeira rodada' })
  startSession(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.startSession(projectId, sessionId, this.actor(req));
  }

  @Post('inventory-sessions/:sessionId/reinventory')
  @HttpCode(201)
  @RequirePermissions('inventory-rounds:reinventory')
  @ApiOperation({
    summary: 'Solicitar reinventario preservando a observacao anterior',
  })
  requestReinventory(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: RequestReinventoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.requestReinventory(
      projectId,
      sessionId,
      dto,
      this.actor(req),
    );
  }

  @Post('inventory-sessions/:sessionId/rounds/:roundId/observations')
  @HttpCode(201)
  @RequirePermissions('inventory-observations:create')
  @ApiOperation({ summary: 'Registrar observacao imutavel de campo' })
  createObservation(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: CreateInventoryObservationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.recordObservation(
      projectId,
      sessionId,
      roundId,
      dto,
      this.actor(req),
    );
  }

  @Get('inventory-sessions/:sessionId/observations')
  @RequirePermissions('inventory-sessions:read')
  @ApiOperation({ summary: 'Listar historico de observacoes da sessao' })
  listObservations(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Query() query: InventoryObservationListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listObservations(
      projectId,
      sessionId,
      query,
      this.actor(req),
    );
  }

  @Post('inventory-sessions/:sessionId/rounds/:roundId/finish')
  @HttpCode(200)
  @RequirePermissions('inventory-sessions:update')
  @ApiOperation({ summary: 'Finalizar rodada de inventario' })
  finishRound(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.finishRound(
      projectId,
      sessionId,
      roundId,
      this.actor(req),
    );
  }

  @Post('inventory-sessions/:sessionId/reconciliations')
  @HttpCode(201)
  @RequirePermissions('reconciliations:create')
  @ApiOperation({ summary: 'Executar conciliacao fisico-contabil versionada' })
  reconcile(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reconcile(projectId, sessionId, this.actor(req));
  }

  @Get('inventory-sessions/:sessionId/reconciliations')
  @RequirePermissions('reconciliations:read')
  @ApiOperation({ summary: 'Listar execucoes e resultados de conciliacao' })
  listReconciliations(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Query() query: ReconciliationListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listReconciliations(
      projectId,
      sessionId,
      query,
      this.actor(req),
    );
  }

  @Post('inventory-sessions/:sessionId/reconciliations/:id/consolidate')
  @HttpCode(201)
  @RequirePermissions('consolidations:create')
  @ApiOperation({ summary: 'Consolidar decisao e snapshot de evidencia' })
  consolidate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConsolidateReconciliationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.consolidate(
      projectId,
      sessionId,
      id,
      dto,
      this.actor(req),
    );
  }

  @Post('inventory-items/:itemId/valuations')
  @HttpCode(201)
  @RequirePermissions('asset-valuations:create')
  @ApiOperation({ summary: 'Registrar avaliacao manual imutavel' })
  createValuation(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CreateAssetValuationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createValuation(
      projectId,
      itemId,
      dto,
      this.actor(req),
    );
  }

  @Get('inventory-items/:itemId/valuations')
  @RequirePermissions('asset-valuations:read')
  @ApiOperation({ summary: 'Listar historico de avaliacoes manuais' })
  listValuations(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query() query: InventoryOperationListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listValuations(
      projectId,
      itemId,
      query,
      this.actor(req),
    );
  }

  @Get('inventory-items/:itemId/plate-history')
  @RequirePermissions('plate-history:read')
  @ApiOperation({ summary: 'Listar historico de evidencias de placa' })
  listPlateHistory(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query() query: InventoryOperationListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listPlateHistory(
      projectId,
      itemId,
      query,
      this.actor(req),
    );
  }

  private actor(req: AuthenticatedRequest): InventoryOperationActor {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
