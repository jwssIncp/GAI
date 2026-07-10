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
import { CreateProjectDto } from '../application/dto/create-project.dto';
import { ListProjectsQueryDto } from '../application/dto/list-projects-query.dto';
import {
  ProjectListResponseDto,
  ProjectResponseDto,
} from '../application/dto/project-response.dto';
import { UpdateProjectDto } from '../application/dto/update-project.dto';
import { CreateProjectUseCase } from '../application/use-cases/create-project.use-case';
import { GetProjectUseCase } from '../application/use-cases/get-project.use-case';
import { ListProjectsUseCase } from '../application/use-cases/list-projects.use-case';
import { UpdateProjectStatusUseCase } from '../application/use-cases/update-project-status.use-case';
import { UpdateProjectUseCase } from '../application/use-cases/update-project.use-case';
import { ProjectActorContext } from '../application/services/project-scope.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(
    private readonly createProject: CreateProjectUseCase,
    private readonly listProjects: ListProjectsUseCase,
    private readonly getProject: GetProjectUseCase,
    private readonly updateProject: UpdateProjectUseCase,
    private readonly updateProjectStatus: UpdateProjectStatusUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('projects:create')
  @ApiOperation({ summary: 'Criar project' })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse(
    'Organization inativa',
    'Project cannot be created for inactive organization',
  )
  async create(
    @Body() dto: CreateProjectDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createProject.execute(dto, this.toActor(req));
  }

  @Get()
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Listar projects (paginado)' })
  @ApiOkResponse({ type: ProjectListResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async list(
    @Query() query: ListProjectsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listProjects.execute(query, this.toActor(req));
  }

  @Get(':id')
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Consultar project por ID' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getProject.execute(id, this.toActor(req));
  }

  @Patch(':id')
  @RequirePermissions('projects:update')
  @ApiOperation({ summary: 'Atualizar project' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Mutacao bloqueada',
    'Project status blocks this operation',
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateProject.execute(id, dto, this.toActor(req));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions('projects:deactivate')
  @ApiOperation({ summary: 'Desativar project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateProjectStatus.execute(
      id,
      'deactivate',
      this.toActor(req),
    );
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @RequirePermissions('projects:reactivate')
  @ApiOperation({ summary: 'Reativar project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  async reactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateProjectStatus.execute(
      id,
      'reactivate',
      this.toActor(req),
    );
  }

  @Post(':id/finish')
  @HttpCode(200)
  @RequirePermissions('projects:finish')
  @ApiOperation({ summary: 'Finalizar project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  async finish(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateProjectStatus.execute(id, 'finish', this.toActor(req));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('projects:cancel')
  @ApiOperation({ summary: 'Cancelar project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateProjectStatus.execute(id, 'cancel', this.toActor(req));
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermissions('projects:archive')
  @ApiOperation({ summary: 'Arquivar project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  async archive(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateProjectStatus.execute(id, 'archive', this.toActor(req));
  }

  private toActor(req: AuthenticatedRequest): ProjectActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
