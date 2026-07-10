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
import { CreateFieldAgentDto } from '../application/dto/create-field-agent.dto';
import {
  FieldAgentListResponseDto,
  FieldAgentResponseDto,
} from '../application/dto/field-agent-response.dto';
import { ListFieldAgentsQueryDto } from '../application/dto/list-field-agents-query.dto';
import { UpdateFieldAgentDto } from '../application/dto/update-field-agent.dto';
import { CreateFieldAgentUseCase } from '../application/use-cases/create-field-agent.use-case';
import { GetFieldAgentUseCase } from '../application/use-cases/get-field-agent.use-case';
import { ListFieldAgentsUseCase } from '../application/use-cases/list-field-agents.use-case';
import { UpdateFieldAgentStatusUseCase } from '../application/use-cases/update-field-agent-status.use-case';
import { UpdateFieldAgentUseCase } from '../application/use-cases/update-field-agent.use-case';
import { FieldAgentActorContext } from '../application/services/field-agent-scope.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Field Agents')
@ApiBearerAuth()
@Controller('field-agents')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class FieldAgentsController {
  constructor(
    private readonly createFieldAgent: CreateFieldAgentUseCase,
    private readonly listFieldAgents: ListFieldAgentsUseCase,
    private readonly getFieldAgent: GetFieldAgentUseCase,
    private readonly updateFieldAgent: UpdateFieldAgentUseCase,
    private readonly updateFieldAgentStatus: UpdateFieldAgentStatusUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('field-agents:create')
  @ApiOperation({ summary: 'Criar field agent' })
  @ApiCreatedResponse({ type: FieldAgentResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Conflito de escopo',
    'Invalid organization or user scope',
  )
  async create(
    @Body() dto: CreateFieldAgentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createFieldAgent.execute(dto, this.toActor(req));
  }

  @Get()
  @RequirePermissions('field-agents:read')
  @ApiOperation({ summary: 'Listar field agents (paginado)' })
  @ApiOkResponse({ type: FieldAgentListResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async list(
    @Query() query: ListFieldAgentsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listFieldAgents.execute(query, this.toActor(req));
  }

  @Get(':id')
  @RequirePermissions('field-agents:read')
  @ApiOperation({ summary: 'Consultar field agent por ID' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: FieldAgentResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getFieldAgent.execute(id, this.toActor(req));
  }

  @Patch(':id')
  @RequirePermissions('field-agents:update')
  @ApiOperation({ summary: 'Atualizar field agent' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: FieldAgentResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse('Conflito de escopo', 'Invalid user scope')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFieldAgentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateFieldAgent.execute(id, dto, this.toActor(req));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions('field-agents:deactivate')
  @ApiOperation({ summary: 'Desativar field agent' })
  @ApiOkResponse({ type: FieldAgentResponseDto })
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateFieldAgentStatus.execute(
      id,
      'deactivate',
      this.toActor(req),
    );
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @RequirePermissions('field-agents:reactivate')
  @ApiOperation({ summary: 'Reativar field agent' })
  @ApiOkResponse({ type: FieldAgentResponseDto })
  async reactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateFieldAgentStatus.execute(
      id,
      'reactivate',
      this.toActor(req),
    );
  }

  private toActor(req: AuthenticatedRequest): FieldAgentActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
