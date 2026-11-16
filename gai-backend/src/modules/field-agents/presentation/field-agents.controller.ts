import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
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
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { safeSpreadsheetText } from '../../project-dashboard/presentation/organization-overview.controller';
import { hasAllPermissions } from '../../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../../auth/domain/ports/permission-resolver.port';
import {
  ConfirmFieldAgentDocumentUploadDto,
  CreateFieldAgentDocumentUploadDto,
  FieldAgentBatchDeleteDto,
  FieldAgentUsageQueryDto,
} from '../application/dto/field-agent-records.dto';
import { FieldAgentRecordsService } from '../application/services/field-agent-records.service';
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
import { DeleteFieldAgentUseCase } from '../application/use-cases/delete-field-agent.use-case';
import { GetFieldAgentUseCase } from '../application/use-cases/get-field-agent.use-case';
import { ListFieldAgentsUseCase } from '../application/use-cases/list-field-agents.use-case';
import { UpdateFieldAgentStatusUseCase } from '../application/use-cases/update-field-agent-status.use-case';
import { UpdateFieldAgentUseCase } from '../application/use-cases/update-field-agent.use-case';
import { FieldAgentActorContext } from '../application/services/field-agent-scope.service';
import { FieldAgentManagementService } from '../application/services/field-agent-management.service';
import {
  CreateFieldAgentTemporaryAccessDto,
  FieldAgentPageDto,
  FieldAgentUserOptionsDto,
  InviteFieldAgentUserDto,
} from '../application/dto/field-agent-management.dto';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Field Agents')
@ApiBearerAuth()
@Controller('field-agents')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class FieldAgentsController {
  constructor(
    private readonly management: FieldAgentManagementService,
    private readonly createFieldAgent: CreateFieldAgentUseCase,
    private readonly deleteFieldAgent: DeleteFieldAgentUseCase,
    private readonly listFieldAgents: ListFieldAgentsUseCase,
    private readonly getFieldAgent: GetFieldAgentUseCase,
    private readonly updateFieldAgent: UpdateFieldAgentUseCase,
    private readonly updateFieldAgentStatus: UpdateFieldAgentStatusUseCase,
    private readonly records: FieldAgentRecordsService,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions: PermissionResolver,
  ) {}

  @Get('context')
  @RequirePermissions('field-agents:read')
  context(@Req() req: AuthenticatedRequest) {
    return this.management.context(this.toActor(req));
  }

  @Get('summary')
  @RequirePermissions('field-agents:read')
  @ApiOperation({ summary: 'Indicadores da lista: total e UFs' })
  summary(@Req() req: AuthenticatedRequest) {
    return this.records.summary(this.toActor(req));
  }

  @Get('export')
  @RequirePermissions('field-agents:read', 'field-agents:export')
  @ApiOperation({ summary: 'Exportar a lista filtrada (XLSX)' })
  async export(
    @Query() query: ListFieldAgentsQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const rows = (await this.records.exportRows(query, this.toActor(req))).map(
      (row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            safeSpreadsheetText(String(value)),
          ]),
        ),
    );
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: [
        'Nome',
        'E-mail',
        'Telefone',
        'UF',
        'CPF/CNPJ',
        'Status',
        'Acesso ao app',
      ],
    });
    XLSX.utils.book_append_sheet(workbook, sheet, 'Inventariantes');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="inventariantes.xlsx"',
    );
    return res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  @Get('financial-usage')
  @RequirePermissions('field-agents:read')
  @ApiOperation({
    summary: 'Lançamentos (diárias e despesas) ligados aos inventariantes',
  })
  financialUsage(
    @Query() query: FieldAgentUsageQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.financialUsage(query.ids, this.toActor(req));
  }

  @Post('batch-delete')
  @HttpCode(200)
  @RequirePermissions('field-agents:delete')
  @ApiOperation({ summary: 'Excluir inventariantes logicamente, em lote' })
  batchDelete(
    @Body() dto: FieldAgentBatchDeleteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.batchDelete(dto.ids, this.toActor(req));
  }

  @Get(':id/documents')
  @RequirePermissions('field-agents:read', 'field-agent-documents:read')
  listDocuments(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.listDocuments(id, this.toActor(req));
  }

  @Post(':id/documents/upload-url')
  @HttpCode(201)
  @RequirePermissions('field-agents:read', 'field-agent-documents:upload')
  createDocumentUpload(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFieldAgentDocumentUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.createDocumentUpload(id, dto, this.toActor(req));
  }

  @Post(':id/documents/:documentId/confirm-upload')
  @HttpCode(200)
  @RequirePermissions('field-agents:read', 'field-agent-documents:upload')
  confirmDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() dto: ConfirmFieldAgentDocumentUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.confirmDocument(id, documentId, dto, this.toActor(req));
  }

  @Post(':id/documents/:documentId/download-url')
  @HttpCode(200)
  @RequirePermissions('field-agents:read', 'field-agent-documents:read')
  downloadDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.downloadDocument(id, documentId, this.toActor(req));
  }

  @Post(':id/documents/:documentId/remove')
  @HttpCode(200)
  @RequirePermissions('field-agents:read', 'field-agent-documents:remove')
  removeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.removeDocument(id, documentId, this.toActor(req));
  }

  @Get('user-options')
  @RequirePermissions('field-agents:read', 'users:read')
  userOptions(
    @Query() query: FieldAgentUserOptionsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.userOptions(query, this.toActor(req));
  }

  @Get(':id/projects')
  @RequirePermissions('field-agents:read', 'project-field-agents:read')
  projects(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FieldAgentPageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.projects(id, query, this.toActor(req));
  }

  @Get(':id/record')
  @RequirePermissions('field-agents:read')
  historicalRecord(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.detail(id, this.toActor(req), true);
  }

  @Get(':id/history')
  @RequirePermissions('field-agents:read')
  history(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FieldAgentPageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.history(id, query, this.toActor(req));
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions('field-agents:reactivate')
  restore(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.restore(id, this.toActor(req));
  }

  @Post(':id/invite')
  @HttpCode(201)
  @RequirePermissions('field-agents:update', 'users:write')
  invite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InviteFieldAgentUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.invite(id, dto, this.toActor(req));
  }

  @Post(':id/access/temporary-password')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @RequirePermissions('field-agents:update', 'users:write')
  @ApiOperation({
    summary: 'Criar acesso do inventariante com senha temporária',
    description:
      'Só ORG_ADMIN. Gera a senha (devolvida UMA vez em temporary_password); troca obrigatória no 1º acesso. 201 | 400 | 403 | 404 | 409 | 429',
  })
  createTemporaryAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFieldAgentTemporaryAccessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.createTemporaryAccess(id, dto, this.toActor(req));
  }

  @Post(':id/access/temporary-password/reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @RequirePermissions('field-agents:update', 'users:write')
  @ApiOperation({
    summary: 'Redefinir a senha temporária do inventariante',
    description:
      'Só ORG_ADMIN. Nova senha devolvida UMA vez; encerra sessões, refresh tokens do app e convite pendente. 200 | 403 | 404 | 409 NOT_FIELD_AGENT_ACCOUNT/CONFLICT | 429',
  })
  resetTemporaryAccess(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.resetTemporaryAccess(id, this.toActor(req));
  }

  @Post(':id/access/revoke')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @RequirePermissions('field-agents:update', 'users:write')
  @ApiOperation({
    summary: 'Revogar o acesso do inventariante',
    description:
      'Só ORG_ADMIN. Senha invalidada, conta INACTIVE, sessões e refresh tokens encerrados. 200 | 403 | 404 | 409 | 429',
  })
  revokeAccess(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.revokeAccess(id, this.toActor(req));
  }

  @Post(':id/resend-invitation')
  @HttpCode(200)
  @RequirePermissions('field-agents:update', 'users:write')
  resend(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.management.resend(id, this.toActor(req));
  }

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
    'Organização ou usuário fora do escopo permitido.',
  )
  async create(
    @Body() dto: CreateFieldAgentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    // Vincular projetos no cadastro exige a mesma permissão do vínculo pelo projeto.
    if (
      dto.project_ids?.length &&
      !(await hasAllPermissions(
        req.user!,
        ['project-field-agents:assign'],
        this.permissions,
      ))
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Permissão necessária para vincular projetos: project-field-agents:assign',
      });
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
    await this.getFieldAgent.execute(id, this.toActor(req));
    return this.management.detail(id, this.toActor(req));
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
  @ApiConflictResponse(
    'Conflito de escopo',
    'Usuário fora do escopo permitido.',
  )
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

  @Post(':id/block')
  @HttpCode(200)
  @RequirePermissions('field-agents:block')
  @ApiOperation({ summary: 'Bloquear field agent' })
  @ApiOkResponse({ type: FieldAgentResponseDto })
  async block(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateFieldAgentStatus.execute(id, 'block', this.toActor(req));
  }

  @Post(':id/unblock')
  @HttpCode(200)
  @RequirePermissions('field-agents:unblock')
  @ApiOperation({ summary: 'Desbloquear field agent' })
  @ApiOkResponse({ type: FieldAgentResponseDto })
  async unblock(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateFieldAgentStatus.execute(
      id,
      'unblock',
      this.toActor(req),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('field-agents:delete')
  @ApiOperation({ summary: 'Excluir field agent logicamente' })
  @ApiNotFoundResponse()
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.deleteFieldAgent.execute(id, this.toActor(req));
  }

  private toActor(req: AuthenticatedRequest): FieldAgentActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
