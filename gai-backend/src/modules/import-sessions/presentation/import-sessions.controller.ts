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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import {
  ConfirmImportFileUploadDto,
  CreateImportFileUploadDto,
  CreateImportPayloadDto,
  CreateImportSessionDto,
  ImportPhysicalObservationsFileDto,
} from '../application/dto/import-sessions-inputs';
import {
  ImportPagedQueryDto,
  ImportSessionListQueryDto,
} from '../application/dto/import-sessions-query.dto';
import {
  ImportFileDownloadUrlResponseDto,
  ImportFileResponseDto,
  ImportFileUploadUrlResponseDto,
  ImportPayloadErrorListResponseDto,
  ImportPayloadListResponseDto,
  ImportPayloadResponseDto,
  ImportSessionListResponseDto,
  ImportSessionResponseDto,
} from '../application/dto/import-sessions-response.dto';
import { ImportSessionActorContext } from '../application/services/import-session-scope.service';
import { ImportSessionsService } from '../application/services/import-sessions.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Import Sessions')
@ApiBearerAuth()
@Controller('projects/:projectId/import-sessions')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ImportSessionsController {
  constructor(private readonly service: ImportSessionsService) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('import-sessions:create')
  @ApiOperation({ summary: 'Criar sessao de importacao' })
  @ApiCreatedResponse({ type: ImportSessionResponseDto })
  createSession(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateImportSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createSession(projectId, dto, this.toActor(req));
  }

  @Get()
  @RequirePermissions('import-sessions:read')
  @ApiOkResponse({ type: ImportSessionListResponseDto })
  listSessions(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ImportSessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listSessions(projectId, query, this.toActor(req));
  }

  @Get('by-uuid/:sessionUuid')
  @RequirePermissions('import-sessions:read')
  @ApiOkResponse({ type: ImportSessionResponseDto })
  getSessionByUuid(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionUuid') sessionUuid: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getSessionByUuid(
      projectId,
      sessionUuid,
      this.toActor(req),
    );
  }

  @Get(':sessionId')
  @RequirePermissions('import-sessions:read')
  @ApiOkResponse({ type: ImportSessionResponseDto })
  getSession(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getSession(projectId, sessionId, this.toActor(req));
  }

  @Post(':sessionId/finish')
  @HttpCode(200)
  @RequirePermissions('import-sessions:finish')
  @ApiOkResponse({ type: ImportSessionResponseDto })
  finishSession(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.finishSession(projectId, sessionId, this.toActor(req));
  }

  @Post(':sessionId/cancel')
  @HttpCode(200)
  @RequirePermissions('import-sessions:cancel')
  @ApiOkResponse({ type: ImportSessionResponseDto })
  cancelSession(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancelSession(projectId, sessionId, this.toActor(req));
  }

  @Post(':sessionId/retry')
  @HttpCode(200)
  @RequirePermissions('import-sessions:retry')
  @ApiOkResponse({ type: ImportSessionResponseDto })
  retrySession(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.retrySession(projectId, sessionId, this.toActor(req));
  }

  @Post(':sessionId/payloads')
  @HttpCode(201)
  @RequirePermissions('import-payloads:create')
  @ApiCreatedResponse({ type: ImportPayloadResponseDto })
  receivePayload(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: CreateImportPayloadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.receivePayload(
      projectId,
      sessionId,
      dto,
      this.toActor(req),
    );
  }

  @Post(':sessionId/physical-observations/import')
  @HttpCode(201)
  @RequirePermissions('import-payloads:create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Importar XLSX de evidencias fisicas usando staging de payloads',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'payload_number', 'idempotency_key'],
      properties: {
        file: { type: 'string', format: 'binary' },
        payload_number: { type: 'integer', minimum: 1 },
        idempotency_key: { type: 'string', maxLength: 128 },
      },
    },
  })
  @ApiCreatedResponse({ type: ImportPayloadResponseDto })
  importPhysicalFile(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: ImportPhysicalObservationsFileDto,
    @UploadedFile() file: { originalname: string; buffer: Buffer },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.importPhysicalFile(
      projectId,
      sessionId,
      dto,
      file,
      this.toActor(req),
    );
  }

  @Get(':sessionId/payloads')
  @RequirePermissions('import-payloads:read')
  @ApiOkResponse({ type: ImportPayloadListResponseDto })
  listPayloads(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Query() query: ImportPagedQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listPayloads(
      projectId,
      sessionId,
      query,
      this.toActor(req),
    );
  }

  @Get(':sessionId/payloads/:payloadId')
  @RequirePermissions('import-payloads:read')
  @ApiOkResponse({ type: ImportPayloadResponseDto })
  getPayload(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('payloadId', ParseIntPipe) payloadId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getPayload(
      projectId,
      sessionId,
      payloadId,
      this.toActor(req),
    );
  }

  @Post(':sessionId/payloads/:payloadId/reprocess')
  @HttpCode(200)
  @RequirePermissions('import-payloads:reprocess')
  @ApiOkResponse({ type: ImportPayloadResponseDto })
  reprocessPayload(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('payloadId', ParseIntPipe) payloadId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reprocessPayload(
      projectId,
      sessionId,
      payloadId,
      this.toActor(req),
    );
  }

  @Get(':sessionId/errors')
  @RequirePermissions('import-errors:read')
  @ApiOkResponse({ type: ImportPayloadErrorListResponseDto })
  listSessionErrors(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Query() query: ImportPagedQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listErrors(
      projectId,
      sessionId,
      query,
      this.toActor(req),
    );
  }

  @Get(':sessionId/payloads/:payloadId/errors')
  @RequirePermissions('import-errors:read')
  @ApiOkResponse({ type: ImportPayloadErrorListResponseDto })
  listPayloadErrors(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('payloadId', ParseIntPipe) payloadId: number,
    @Query() query: ImportPagedQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listErrors(
      projectId,
      sessionId,
      query,
      this.toActor(req),
      payloadId,
    );
  }

  @Post(':sessionId/files/upload-url')
  @HttpCode(201)
  @RequirePermissions('import-files:create')
  @ApiCreatedResponse({ type: ImportFileUploadUrlResponseDto })
  createFileUploadUrl(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: CreateImportFileUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createFileUploadUrl(
      projectId,
      sessionId,
      dto,
      this.toActor(req),
    );
  }

  @Post(':sessionId/files/:fileId/confirm-upload')
  @HttpCode(200)
  @RequirePermissions('import-files:create')
  @ApiOkResponse({ type: ImportFileResponseDto })
  confirmFileUpload(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Body() dto: ConfirmImportFileUploadDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.confirmFileUpload(
      projectId,
      sessionId,
      fileId,
      dto,
      this.toActor(req),
    );
  }

  @Get(':sessionId/files')
  @RequirePermissions('import-files:read')
  @ApiOkResponse({ type: [ImportFileResponseDto] })
  listFiles(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listFiles(projectId, sessionId, this.toActor(req));
  }

  @Post(':sessionId/files/:fileId/download-url')
  @HttpCode(200)
  @RequirePermissions('import-files:download')
  @ApiOkResponse({ type: ImportFileDownloadUrlResponseDto })
  createFileDownloadUrl(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createFileDownloadUrl(
      projectId,
      sessionId,
      fileId,
      this.toActor(req),
    );
  }

  private toActor(req: AuthenticatedRequest): ImportSessionActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
