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
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import {
  CreateInventoryPendingIssueDto,
  ResolveInventoryPendingIssueDto,
  UpdateInventoryPendingIssueDto,
} from '../application/dto/inventory-pending-issue-inputs';
import {
  GenerateInventoryPendingIssuesResponseDto,
  InventoryPendingIssueListResponseDto,
  InventoryPendingIssueResponseDto,
} from '../application/dto/inventory-pending-issue-response.dto';
import { ListInventoryPendingIssuesQueryDto } from '../application/dto/list-inventory-pending-issues-query.dto';
import { InventoryPendingIssueActorContext } from '../application/services/inventory-pending-issue-scope.service';
import { InventoryPendingIssuesService } from '../application/services/inventory-pending-issues.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Inventory Pending Issues')
@ApiBearerAuth()
@Controller('projects/:projectId/pending-issues')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class InventoryPendingIssuesController {
  constructor(private readonly service: InventoryPendingIssuesService) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('inventory-pending-issues:create')
  @ApiOperation({ summary: 'Criar pendencia manual' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiCreatedResponse({ type: InventoryPendingIssueResponseDto })
  async create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateInventoryPendingIssueDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(projectId, dto, this.toActor(req));
  }

  @Get()
  @RequirePermissions('inventory-pending-issues:read')
  @ApiOperation({ summary: 'Listar pendencias do project' })
  @ApiOkResponse({ type: InventoryPendingIssueListResponseDto })
  async list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListInventoryPendingIssuesQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(projectId, query, this.toActor(req));
  }

  @Post('generate')
  @HttpCode(201)
  @RequirePermissions('inventory-pending-issues:generate')
  @ApiOperation({ summary: 'Gerar pendencias automaticamente' })
  @ApiCreatedResponse({ type: GenerateInventoryPendingIssuesResponseDto })
  async generate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.generate(projectId, this.toActor(req));
  }

  @Get(':id')
  @RequirePermissions('inventory-pending-issues:read')
  @ApiOperation({ summary: 'Consultar pendencia' })
  @ApiOkResponse({ type: InventoryPendingIssueResponseDto })
  async get(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.get(projectId, id, this.toActor(req));
  }

  @Patch(':id')
  @RequirePermissions('inventory-pending-issues:update')
  @ApiOperation({ summary: 'Atualizar pendencia' })
  @ApiOkResponse({ type: InventoryPendingIssueResponseDto })
  async update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInventoryPendingIssueDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(projectId, id, dto, this.toActor(req));
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @RequirePermissions('inventory-pending-issues:resolve')
  @ApiOperation({ summary: 'Resolver pendencia' })
  @ApiOkResponse({ type: InventoryPendingIssueResponseDto })
  async resolve(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveInventoryPendingIssueDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.resolve(projectId, id, dto, this.toActor(req));
  }

  @Post(':id/ignore')
  @HttpCode(200)
  @RequirePermissions('inventory-pending-issues:ignore')
  @ApiOperation({ summary: 'Ignorar pendencia' })
  @ApiOkResponse({ type: InventoryPendingIssueResponseDto })
  async ignore(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveInventoryPendingIssueDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.ignore(projectId, id, dto, this.toActor(req));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('inventory-pending-issues:cancel')
  @ApiOperation({ summary: 'Cancelar pendencia' })
  @ApiOkResponse({ type: InventoryPendingIssueResponseDto })
  async cancel(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancel(projectId, id, this.toActor(req));
  }

  private toActor(
    req: AuthenticatedRequest,
  ): InventoryPendingIssueActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
