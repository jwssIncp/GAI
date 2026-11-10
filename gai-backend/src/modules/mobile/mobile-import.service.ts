import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { AuthenticatedUser } from '../auth/presentation/guards/session-auth.guard';
import {
  CreateImportPayloadDto,
  CreateImportSessionDto,
  ImportItemOperation,
  ImportPayloadItemDto,
} from '../import-sessions/application/dto/import-sessions-inputs';
import { ImportSessionResponseDto } from '../import-sessions/application/dto/import-sessions-response.dto';
import { ImportSessionScopeService } from '../import-sessions/application/services/import-session-scope.service';
import { ImportSessionsService } from '../import-sessions/application/services/import-sessions.service';
import { ImportFileType } from '../import-sessions/domain/enums/import-file-type.enum';
import { ImportSessionSource } from '../import-sessions/domain/enums/import-session-source.enum';
import { ImportSessionType } from '../import-sessions/domain/enums/import-session-type.enum';
import { ImportFileEntity } from '../import-sessions/infrastructure/persistence/import-file.entity';
import { ImportPayloadEntity } from '../import-sessions/infrastructure/persistence/import-payload.entity';
import { ImportSessionEntity } from '../import-sessions/infrastructure/persistence/import-session.entity';
import {
  MobileImportConfirmDto,
  MobileImportFileDto,
  MobileImportItemDto,
  MobileImportPayloadDto,
  MobileImportSessionCreateDto,
} from './dto/mobile-operations.dto';
import { MobileAccessService } from './mobile-access.service';
import { MobileItemsService } from './mobile-items.service';

/**
 * Mobile reconciliation (legacy import-sessions) addressed by session_uuid.
 * Delegates to the shared ImportSessionsService (with the Onda 3 fixes) acting
 * as a confined field account, so the technician only sees sessions it opened.
 */
@Injectable()
export class MobileImportService {
  constructor(
    private readonly db: DataSource,
    private readonly access: MobileAccessService,
    private readonly imports: ImportSessionsService,
    private readonly scope: ImportSessionScopeService,
    private readonly items: MobileItemsService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    projectId: number,
    dto: MobileImportSessionCreateDto,
  ) {
    const access = await this.access.assertProject(actor, projectId, true);
    const created = await this.imports.createSession(
      projectId,
      Object.assign(new CreateImportSessionDto(), {
        type: ImportSessionType.MOBILE_SYNC,
        source: ImportSessionSource.MOBILE_APP,
        expected_payloads: dto.expected_payloads,
        metadata: {
          unidade: dto.unidade?.trim() || null,
          device_label: dto.device_label?.trim() || null,
          field_agent_id: access.agent.id,
        },
      }),
      this.ctx(actor),
      { ttlHours: this.scope.mobileSessionTtlHours() },
    );
    return this.status(actor, projectId, created.session_uuid);
  }

  async status(actor: AuthenticatedUser, projectId: number, uuid: string) {
    const session = await this.resolve(actor, projectId, uuid, false);
    const success =
      Number(session.totalCreated) +
      Number(session.totalUpdated) +
      Number(session.totalDeleted);
    const expected = session.expectedPayloads
      ? Number(session.expectedPayloads)
      : null;
    const metadata = (session.metadata ?? {}) as Record<string, unknown>;
    return {
      session_uuid: session.sessionUuid,
      status: session.status,
      unidade: (metadata.unidade as string | null) ?? null,
      expires_at: session.expiresAt?.toISOString() ?? null,
      expected_payloads: expected,
      received_payloads: Number(session.receivedPayloads),
      processed_payloads: Number(session.processedPayloads),
      pending_payloads:
        expected === null
          ? null
          : Math.max(expected - Number(session.receivedPayloads), 0),
      payloads_with_errors: Number(session.failedPayloads),
      total_items: Number(session.totalItems),
      success_items: success,
      failed_items: Number(session.totalFailed),
      created_items: Number(session.totalCreated),
      updated_items: Number(session.totalUpdated),
      deleted_items: Number(session.totalDeleted),
      backup_uploaded: !!session.rawBackupPath,
      finished_at: session.finishedAt?.toISOString() ?? null,
    };
  }

  async requestFile(
    actor: AuthenticatedUser,
    projectId: number,
    uuid: string,
    dto: MobileImportFileDto,
  ) {
    const session = await this.resolve(actor, projectId, uuid, true);
    const result = await this.imports.createFileUploadUrl(
      projectId,
      session.id,
      {
        type: dto.type as ImportFileType,
        original_name: dto.original_name,
        mime_type: dto.mime_type,
        size_bytes: dto.size_bytes,
      },
      this.ctx(actor),
    );
    return {
      file_id: result.file.id,
      type: result.file.type,
      status: result.file.status,
      upload_url: result.upload_url,
      upload_headers: {
        'Content-Type': dto.mime_type,
        'Content-Length': String(dto.size_bytes),
      },
      expires_in_seconds: result.expires_in_seconds,
    };
  }

  async confirmFile(
    actor: AuthenticatedUser,
    projectId: number,
    uuid: string,
    fileId: number,
    dto: MobileImportConfirmDto,
  ) {
    const session = await this.resolve(actor, projectId, uuid, true);
    const file = await this.imports.confirmFileUpload(
      projectId,
      session.id,
      fileId,
      dto,
      this.ctx(actor),
    );
    return {
      file_id: file.id,
      type: file.type,
      status: file.status,
      size_bytes: Number(file.size_bytes),
      checksum: file.checksum,
    };
  }

  async payload(
    actor: AuthenticatedUser,
    projectId: number,
    uuid: string,
    dto: MobileImportPayloadDto,
  ) {
    const session = await this.resolve(actor, projectId, uuid, true);
    for (const item of dto.items)
      this.items.assertExtraFields(item.extra_fields);
    const fileIds = [
      ...new Set(
        dto.items.flatMap((item) => (item.images ?? []).map((i) => i.file_id)),
      ),
    ];
    const files = fileIds.length
      ? await this.db.getRepository(ImportFileEntity).find({
          where: {
            id: In(fileIds),
            importSessionId: session.id,
            organizationId: session.organizationId,
          },
        })
      : [];
    if (files.length !== fileIds.length)
      throw new BadRequestException({
        code: 'INVALID_IMAGE_FILE',
        message: 'images[].file_id deve ser um arquivo desta sessão.',
      });
    const pathOf = new Map(files.map((f) => [Number(f.id), f.path]));
    const result = await this.imports.receivePayload(
      projectId,
      session.id,
      Object.assign(new CreateImportPayloadDto(), {
        payload_number: dto.payload_number,
        idempotency_key: dto.idempotency_key,
        items: dto.items.map((item) => this.toImportItem(item, pathOf)),
      }),
      this.ctx(actor),
    );
    return {
      payload_number: result.payload_number,
      status: result.status,
      items_count: result.items_count,
      created_count: result.created_count,
      updated_count: result.updated_count,
      deleted_count: result.deleted_count,
      failed_count: result.failed_count,
    };
  }

  async finish(actor: AuthenticatedUser, projectId: number, uuid: string) {
    const session = await this.resolve(actor, projectId, uuid, true);
    await this.imports.finishSession(projectId, session.id, this.ctx(actor));
    return this.status(actor, projectId, uuid);
  }

  async errors(
    actor: AuthenticatedUser,
    projectId: number,
    uuid: string,
    page = 1,
    pageSize = 100,
  ) {
    const session = await this.resolve(actor, projectId, uuid, false);
    const list = await this.imports.listErrors(
      projectId,
      session.id,
      { page, page_size: pageSize },
      this.ctx(actor),
    );
    const payloads = await this.db.getRepository(ImportPayloadEntity).find({
      where: { importSessionId: session.id },
      select: ['id', 'payloadNumber'],
    });
    const numberOf = new Map(
      payloads.map((p) => [Number(p.id), Number(p.payloadNumber)]),
    );
    const rows = await this.db.query<
      Array<{ id: number | string; payloadId: number | string }>
    >(
      'SELECT id, import_payload_id AS payloadId FROM import_payload_errors WHERE import_session_id = ?',
      [session.id],
    );
    const payloadOf = new Map(
      rows.map((r) => [Number(r.id), Number(r.payloadId)]),
    );
    return {
      ...list,
      items: list.items.map((error) => ({
        payload_number: numberOf.get(payloadOf.get(error.id) ?? 0) ?? null,
        row_number: error.row_number,
        item_id: error.item_reference,
        error_code: error.error_code,
        error_message: error.error_message,
      })),
    };
  }

  private toImportItem(
    item: MobileImportItemDto,
    pathOf: Map<number, string>,
  ): ImportPayloadItemDto {
    const { operation, images, extra_fields: extra, ...fields } = item;
    return Object.assign(new ImportPayloadItemDto(), {
      ...fields,
      operation:
        operation === 'delete'
          ? ImportItemOperation.DELETE
          : ImportItemOperation.UPSERT,
      // null clears (same rule as PUT); absent keeps the server value.
      ...(extra !== undefined ? { metadata: { extra_fields: extra } } : {}),
      source: 'mobile_app',
      images: (images ?? []).map((image) => ({
        path: pathOf.get(image.file_id),
      })),
    });
  }

  /** Session of this project opened by this account (404 otherwise). */
  private async resolve(
    actor: AuthenticatedUser,
    projectId: number,
    uuid: string,
    mutate: boolean,
  ): Promise<ImportSessionEntity> {
    await this.access.assertProject(actor, projectId, mutate);
    const dto: ImportSessionResponseDto = await this.imports.getSessionByUuid(
      projectId,
      uuid,
      this.ctx(actor),
    );
    return this.db
      .getRepository(ImportSessionEntity)
      .findOneByOrFail({ id: dto.id });
  }

  private ctx(actor: AuthenticatedUser) {
    return {
      id: actor.id,
      systemRoles: actor.systemRoles,
      organizationId: actor.organizationId,
      confined: true,
    };
  }
}
