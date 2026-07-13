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
  ProjectFieldAgentListResponseDto,
  ProjectFieldAgentResponseDto,
} from '../application/dto/field-agent-response.dto';
import {
  AssignProjectFieldAgentDto,
  ListProjectFieldAgentsQueryDto,
  UpdateProjectFieldAgentDto,
} from '../application/dto/project-field-agent.dto';
import { FieldAgentActorContext } from '../application/services/field-agent-scope.service';
import { AssignProjectFieldAgentUseCase } from '../application/use-cases/assign-project-field-agent.use-case';
import { ListProjectFieldAgentsUseCase } from '../application/use-cases/list-project-field-agents.use-case';
import { RemoveProjectFieldAgentUseCase } from '../application/use-cases/remove-project-field-agent.use-case';
import { UpdateProjectFieldAgentUseCase } from '../application/use-cases/update-project-field-agent.use-case';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Project Field Agents')
@ApiBearerAuth()
@Controller('projects/:projectId/field-agents')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ProjectFieldAgentsController {
  constructor(
    private readonly assignProjectFieldAgent: AssignProjectFieldAgentUseCase,
    private readonly listProjectFieldAgents: ListProjectFieldAgentsUseCase,
    private readonly updateProjectFieldAgent: UpdateProjectFieldAgentUseCase,
    private readonly removeProjectFieldAgent: RemoveProjectFieldAgentUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('project-field-agents:assign')
  @ApiOperation({ summary: 'Vincular field agent ao project' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiCreatedResponse({ type: ProjectFieldAgentResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Mutacao bloqueada',
    'Project status blocks this operation',
  )
  async assign(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: AssignProjectFieldAgentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assignProjectFieldAgent.execute(
      projectId,
      dto,
      this.toActor(req),
    );
  }

  @Get()
  @RequirePermissions('project-field-agents:read')
  @ApiOperation({ summary: 'Listar field agents do project' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: ProjectFieldAgentListResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListProjectFieldAgentsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listProjectFieldAgents.execute(
      projectId,
      query,
      this.toActor(req),
    );
  }

  @Patch(':assignmentId')
  @RequirePermissions('project-field-agents:update')
  @ApiOperation({ summary: 'Atualizar vinculo de field agent' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'assignmentId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: ProjectFieldAgentResponseDto })
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
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: UpdateProjectFieldAgentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateProjectFieldAgent.execute(
      projectId,
      assignmentId,
      dto,
      this.toActor(req),
    );
  }

  @Post(':assignmentId/remove')
  @HttpCode(200)
  @RequirePermissions('project-field-agents:remove')
  @ApiOperation({ summary: 'Remover vinculo de field agent' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'assignmentId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: ProjectFieldAgentResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Mutacao bloqueada',
    'Project status blocks this operation',
  )
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.removeProjectFieldAgent.execute(
      projectId,
      assignmentId,
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
