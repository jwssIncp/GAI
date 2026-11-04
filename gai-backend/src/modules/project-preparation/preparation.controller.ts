import {
  Body,
  Controller,
  Delete,
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import { ProjectActorContext } from '../projects/application/services/project-scope.service';
import {
  CommunicationQueryDto,
  CreatePreparationDto,
  CreateTemplateDto,
  HistoryQueryDto,
  RevisionDto,
  SaveAnswersDto,
  UpdatePreparationDto,
  UpdateTemplateDto,
} from './preparation.dto';
import { PreparationService } from './preparation.service';
interface PreparationRequest extends Request {
  user?: AuthenticatedUser;
}
function actor(req: PreparationRequest): ProjectActorContext {
  return {
    id: req.user!.id,
    organizationId: req.user!.organizationId,
    systemRoles: req.user!.systemRoles,
    permissions: req.user!.permissions,
  };
}

@ApiTags('Project Preparation Templates')
@ApiBearerAuth()
@Controller('organizations/:organizationId/preparation-templates')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class PreparationTemplatesController {
  constructor(private readonly service: PreparationService) {}
  @Get()
  @RequirePermissions('project-preparation:read')
  @ApiOperation({
    summary: 'Listar modelos da organização, incluindo arquivados',
  })
  list(
    @Param('organizationId', ParseIntPipe) org: number,
    @Req() req: PreparationRequest,
  ) {
    return this.service.listTemplates(org, actor(req));
  }
  @Post()
  @RequirePermissions('project-preparation:read', 'project-preparation:edit')
  @ApiOperation({ summary: 'Criar modelo e versão imutável inicial' })
  create(
    @Param('organizationId', ParseIntPipe) org: number,
    @Body() dto: CreateTemplateDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.createTemplate(org, dto, actor(req));
  }
  @Get(':id')
  @RequirePermissions('project-preparation:read')
  @ApiOperation({ summary: 'Consultar modelo atual e índice de versões' })
  get(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: PreparationRequest,
  ) {
    return this.service.getTemplate(org, id, actor(req));
  }
  @Get(':id/versions/:version')
  @RequirePermissions('project-preparation:read')
  @ApiOperation({ summary: 'Consultar versão histórica imutável' })
  version(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: PreparationRequest,
  ) {
    return this.service.getVersion(org, id, version, actor(req));
  }
  @Patch(':id')
  @RequirePermissions('project-preparation:read', 'project-preparation:edit')
  @ApiOperation({
    summary: 'Publicar próxima versão; exige expected_version atual',
  })
  update(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.updateTemplate(org, id, dto, actor(req));
  }
  @Delete(':id')
  @RequirePermissions('project-preparation:read', 'project-preparation:edit')
  @ApiOperation({
    summary:
      'Arquivar modelo sem excluir versões ou instâncias; revision é current_version',
  })
  archive(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisionDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.archiveTemplate(org, id, dto.revision, actor(req));
  }
  @Post(':id/clone')
  @RequirePermissions('project-preparation:read', 'project-preparation:edit')
  @ApiOperation({
    summary: 'Clonar modelo exclusivamente dentro da organização de origem',
  })
  clone(
    @Param('organizationId', ParseIntPipe) org: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: PreparationRequest,
  ) {
    return this.service.cloneTemplate(org, id, actor(req));
  }
}

@ApiTags('Project Preparation')
@ApiBearerAuth()
@Controller('projects/:projectId/preparations')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ProjectPreparationController {
  constructor(private readonly service: PreparationService) {}
  @Get('context')
  @RequirePermissions('project-preparation:read')
  @ApiOperation({
    summary:
      'Dados autorizados do projeto, empresa, unidades vinculadas e responsáveis existentes',
  })
  context(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: PreparationRequest,
  ) {
    return this.service.context(projectId, actor(req));
  }
  @Get()
  @RequirePermissions('project-preparation:read')
  @ApiOperation({ summary: 'Listar instâncias independentes do projeto' })
  list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: PreparationRequest,
  ) {
    return this.service.list(projectId, actor(req));
  }
  @Post()
  @RequirePermissions('project-preparation:read', 'project-preparation:edit')
  @ApiOperation({
    summary: 'Criar instância com snapshot imutável de versão do modelo',
  })
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreatePreparationDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.create(projectId, dto, actor(req));
  }
  @Get(':id')
  @RequirePermissions('project-preparation:read')
  @ApiOperation({
    summary:
      'Consultar respostas, aplicabilidade e progresso calculados no backend',
  })
  get(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: PreparationRequest,
  ) {
    return this.service.get(projectId, id, actor(req));
  }
  @Patch(':id')
  @RequirePermissions('project-preparation:read', 'project-preparation:edit')
  @ApiOperation({
    summary: 'Editar responsáveis, datas e observações com controle de revisão',
  })
  update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePreparationDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.update(projectId, id, dto, actor(req));
  }
  @Patch(':id/answers')
  @RequirePermissions('project-preparation:read', 'project-preparation:edit')
  @ApiOperation({
    summary:
      'Salvar lote atômico de respostas tipadas e validar condições no servidor',
  })
  answers(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveAnswersDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.saveAnswers(projectId, id, dto, actor(req));
  }
  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('project-preparation:read', 'project-preparation:approve')
  @ApiOperation({
    summary: 'Aprovar após resolver perguntas obrigatórias aplicáveis',
  })
  approve(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisionDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.transition(
      projectId,
      id,
      dto.revision,
      'approve',
      actor(req),
    );
  }
  @Post(':id/reopen')
  @HttpCode(200)
  @RequirePermissions('project-preparation:read', 'project-preparation:approve')
  @ApiOperation({ summary: 'Reabrir aprovação mantendo respostas e histórico' })
  reopen(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisionDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.transition(
      projectId,
      id,
      dto.revision,
      'reopen',
      actor(req),
    );
  }
  @Delete(':id')
  @RequirePermissions('project-preparation:read', 'project-preparation:edit')
  @ApiOperation({ summary: 'Arquivar instância sem exclusão física' })
  archive(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisionDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.transition(
      projectId,
      id,
      dto.revision,
      'archive',
      actor(req),
    );
  }
  @Get(':id/history')
  @RequirePermissions('project-preparation:read')
  @ApiOperation({
    summary: 'Histórico com ator, data, antes/depois e cursor before_id',
  })
  history(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: HistoryQueryDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.history(projectId, id, actor(req), query.before_id);
  }
  @Get(':id/communication')
  @RequirePermissions('project-preparation:read')
  @ApiOperation({
    summary: 'Gerar prévia de texto autorizada; não envia mensagens',
  })
  communication(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: CommunicationQueryDto,
    @Req() req: PreparationRequest,
  ) {
    return this.service.communication(projectId, id, actor(req), query.channel);
  }
}
