import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import {
  SessionAuthGuard,
  type AuthenticatedUser,
} from '../auth/presentation/guards/session-auth.guard';
import { FieldService } from './field.service';
import {
  FieldAddTaskDto,
  FieldArchiveTemplateDto,
  FieldCreateDto,
  FieldMessageQuery,
  FieldPageQuery,
  FieldApprovalDto,
  FieldTaskDto,
  FieldTemplateDto,
  FieldTransitionDto,
} from './field.dto';
interface FieldRequest extends Request {
  user: AuthenticatedUser;
}
function actor(req: FieldRequest) {
  return {
    id: req.user.id,
    organizationId: req.user.organizationId,
    systemRoles: req.user.systemRoles,
    permissions: req.user.permissions,
  };
}
const READ = 'field-coordination:read',
  EDIT = 'field-coordination:edit',
  COORDINATE = 'field-coordination:coordinate';
@ApiTags('Field Coordination Templates')
@ApiBearerAuth()
@Controller('organizations/:organizationId/field-templates')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class FieldTemplatesController {
  constructor(private readonly service: FieldService) {}
  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Modelos de campo paginados' })
  list(
    @Param('organizationId', ParseIntPipe) org: number,
    @Query() query: FieldPageQuery,
    @Req() req: FieldRequest,
  ) {
    return this.service.templates(org, query, actor(req));
  }
  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Modelo atual de campo' })
  get(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FieldRequest,
  ) {
    return this.service.template(org, id, actor(req));
  }
  @Get(':id/versions/:version')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Versão imutável de modelo de campo' })
  version(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: FieldRequest,
  ) {
    return this.service.template(org, id, actor(req), version);
  }
  @Post()
  @RequirePermissions(READ, EDIT)
  @ApiOperation({ summary: 'Criar modelo e primeira versão de campo' })
  create(
    @Param('organizationId', ParseIntPipe) org: number,
    @Body() dto: FieldTemplateDto,
    @Req() req: FieldRequest,
  ) {
    return this.service.saveTemplate(org, dto, actor(req));
  }
  @Patch(':id')
  @RequirePermissions(READ, EDIT)
  @ApiOperation({ summary: 'Publicar versão com expected_version' })
  update(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FieldTemplateDto,
    @Req() req: FieldRequest,
  ) {
    return this.service.saveTemplate(org, dto, actor(req), id);
  }
  @Post(':id/archive')
  @RequirePermissions(READ, EDIT)
  @ApiOperation({
    summary: 'Arquivar ou restaurar modelo sem alterar instâncias',
  })
  archive(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FieldArchiveTemplateDto,
    @Req() req: FieldRequest,
  ) {
    return this.service.archiveTemplate(org, id, dto, actor(req));
  }
}
@ApiTags('Field Coordination')
@ApiBearerAuth()
@Controller('projects/:projectId/field-coordination')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class FieldController {
  constructor(private readonly service: FieldService) {}
  @Get('context')
  @RequirePermissions(READ)
  @ApiOperation({
    summary:
      'Projeto e responsáveis paginados; kind=user ou field_agent vinculado',
  })
  context(
    @Param('projectId', ParseIntPipe) project: number,
    @Query() query: FieldPageQuery,
    @Req() req: FieldRequest,
  ) {
    return this.service.context(project, actor(req), query);
  }
  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Checklists de campo do projeto, paginados' })
  list(
    @Param('projectId', ParseIntPipe) project: number,
    @Query() query: FieldPageQuery,
    @Req() req: FieldRequest,
  ) {
    return this.service.list(project, query, actor(req));
  }
  @Post()
  @RequirePermissions(READ, EDIT)
  @ApiOperation({
    summary: 'Criar checklist com snapshot e command_key idempotente',
  })
  create(
    @Param('projectId', ParseIntPipe) project: number,
    @Body() dto: FieldCreateDto,
    @Req() req: FieldRequest,
  ) {
    return this.service.create(project, dto, actor(req));
  }
  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Checklist e revisão corrente' })
  get(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FieldRequest,
  ) {
    return this.service.get(project, id, actor(req));
  }
  @Get(':id/tasks')
  @RequirePermissions(READ)
  @ApiOperation({
    summary:
      'Tarefas paginadas por responsável, etapa, estado, prioridade e prazo',
  })
  tasks(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FieldPageQuery,
    @Req() req: FieldRequest,
  ) {
    return this.service.tasks(project, id, query, actor(req));
  }
  @Post(':id/tasks')
  @RequirePermissions(READ, EDIT)
  @ApiOperation({
    summary: 'Adicionar tarefa local com ID estável sem alterar o modelo',
  })
  add(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FieldAddTaskDto,
    @Req() req: FieldRequest,
  ) {
    return this.service.addTask(project, id, dto, actor(req));
  }
  @Patch(':id/tasks/:taskId')
  @RequirePermissions(READ, EDIT)
  @ApiOperation({
    summary:
      'Editar/avançar tarefa; reabertura também exige coordinate e motivo novo',
  })
  update(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) task: number,
    @Body() dto: FieldTaskDto,
    @Req() req: FieldRequest,
  ) {
    return this.service.updateTask(project, id, task, dto, actor(req));
  }
  @Post(':id/tasks/:taskId/approve')
  @RequirePermissions(READ, COORDINATE)
  @ApiOperation({ summary: 'Aprovar tarefa concluída na revisão informada' })
  approve(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) task: number,
    @Body() dto: FieldApprovalDto,
    @Req() req: FieldRequest,
  ) {
    return this.service.updateTask(project, id, task, dto, actor(req), true);
  }
  @Get(':id/dashboard')
  @RequirePermissions(READ)
  @ApiOperation({
    summary:
      'Agregações SQL de campo por etapa/responsável e denominadores explícitos',
  })
  dashboard(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FieldRequest,
  ) {
    return this.service.dashboard(project, id, actor(req));
  }
  @Get(':id/readiness')
  @RequirePermissions(READ)
  @ApiOperation({
    summary:
      'Impedimentos estruturados de conclusão em todas as etapas obrigatórias',
  })
  readiness(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FieldRequest,
  ) {
    return this.service.blockers(project, id, actor(req));
  }
  @Post(':id/transition')
  @RequirePermissions(READ, COORDINATE)
  @ApiOperation({
    summary:
      'Concluir, reabrir com motivo ou arquivar; revisão e command_key obrigatórios',
  })
  transition(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FieldTransitionDto,
    @Req() req: FieldRequest,
  ) {
    return this.service.transition(project, id, dto, actor(req));
  }
  @Get(':id/history')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Histórico com cursor before_id' })
  history(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FieldPageQuery,
    @Req() req: FieldRequest,
  ) {
    return this.service.history(project, id, query, actor(req));
  }
  @Get(':id/message')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Prévia limitada de orientações; nenhum envio' })
  message(
    @Param('projectId', ParseIntPipe) project: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FieldMessageQuery,
    @Req() req: FieldRequest,
  ) {
    return this.service.message(project, id, query, actor(req));
  }
}
