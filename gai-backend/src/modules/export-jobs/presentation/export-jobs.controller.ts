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
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ErrorResponseDto } from '../../../common/swagger/error-response.dto';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import { CreateExportJobDto } from '../application/dto/export-job-inputs.dto';
import { ExportJobListQueryDto } from '../application/dto/export-job-query.dto';
import {
  ExportJobDownloadUrlResponseDto,
  ExportJobListResponseDto,
  ExportJobResponseDto,
} from '../application/dto/export-job-response.dto';
import {
  ExportJobActorContext,
  ExportJobsService,
} from '../application/services/export-jobs.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Export Jobs')
@ApiBearerAuth()
@ApiBadRequestResponse({
  description: 'Parametros ou payload invalidos',
  type: ErrorResponseDto,
})
@ApiUnauthorizedResponse({
  description: 'Sessao ausente ou invalida',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Permissao ou escopo insuficiente',
  type: ErrorResponseDto,
})
@ApiNotFoundResponse({
  description: 'Projeto ou export job nao encontrado',
  type: ErrorResponseDto,
})
@Controller('projects/:projectId/export-jobs')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ExportJobsController {
  constructor(private readonly service: ExportJobsService) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('export-jobs:create')
  @ApiOperation({ summary: 'Solicitar exportacao XLSX do projeto' })
  @ApiCreatedResponse({ type: ExportJobResponseDto })
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateExportJobDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(projectId, dto, this.toActor(req));
  }

  @Get()
  @RequirePermissions('export-jobs:read')
  @ApiOperation({ summary: 'Listar exportacoes do projeto' })
  @ApiOkResponse({ type: ExportJobListResponseDto })
  list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ExportJobListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(projectId, query, this.toActor(req));
  }

  @Get(':jobId/download')
  @RequirePermissions('export-jobs:download')
  @ApiOperation({ summary: 'Baixar XLSX por endpoint autenticado' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    schema: { type: 'string', format: 'binary' },
  })
  @ApiConflictResponse({
    description: 'Arquivo ainda nao esta disponivel',
    type: ErrorResponseDto,
  })
  @ApiGoneResponse({
    description: 'Arquivo de exportacao expirado',
    type: ErrorResponseDto,
  })
  async download(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Req() req: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.service.download(
      projectId,
      jobId,
      this.toActor(req),
    );
    const fileName = file.fileName.replace(/["\r\n]/g, '_');
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.sizeBytes));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('ETag', `"${file.checksum}"`);
    response.status(200).send(file.content);
  }

  @Get(':jobId')
  @RequirePermissions('export-jobs:read')
  @ApiOperation({ summary: 'Consultar exportacao do projeto' })
  @ApiOkResponse({ type: ExportJobResponseDto })
  get(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.get(projectId, jobId, this.toActor(req));
  }

  @Post(':jobId/download-url')
  @HttpCode(200)
  @RequirePermissions('export-jobs:download')
  @ApiOperation({ summary: 'Obter URL autenticada para download' })
  @ApiOkResponse({ type: ExportJobDownloadUrlResponseDto })
  @ApiConflictResponse({
    description: 'Arquivo ainda nao esta disponivel',
    type: ErrorResponseDto,
  })
  @ApiGoneResponse({
    description: 'Arquivo de exportacao expirado',
    type: ErrorResponseDto,
  })
  createDownloadUrl(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createDownloadUrl(projectId, jobId, this.toActor(req));
  }

  @Post(':jobId/cancel')
  @HttpCode(200)
  @RequirePermissions('export-jobs:cancel')
  @ApiOperation({ summary: 'Cancelar exportacao pendente ou em processamento' })
  @ApiOkResponse({ type: ExportJobResponseDto })
  @ApiConflictResponse({
    description: 'Status nao permite cancelamento',
    type: ErrorResponseDto,
  })
  cancel(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancel(projectId, jobId, this.toActor(req));
  }

  @Post(':jobId/retry')
  @HttpCode(201)
  @RequirePermissions('export-jobs:retry')
  @ApiOperation({ summary: 'Criar nova tentativa para exportacao terminal' })
  @ApiCreatedResponse({ type: ExportJobResponseDto })
  @ApiConflictResponse({
    description: 'Status nao permite retry ou ja existe retry ativo',
    type: ErrorResponseDto,
  })
  retry(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.retry(projectId, jobId, this.toActor(req));
  }

  private toActor(req: AuthenticatedRequest): ExportJobActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
