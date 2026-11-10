import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Not, QueryFailedError } from 'typeorm';
import type { AuthenticatedUser } from '../auth/presentation/guards/session-auth.guard';
import { identityTransaction } from '../auth/infrastructure/persistence/identity-transaction';
import { InventoryItemScopeService } from '../inventory-items/application/services/inventory-item-scope.service';
import { InventoryItemAuditOperation } from '../inventory-items/domain/enums/inventory-item-audit-operation.enum';
import { InventoryItemStatus } from '../inventory-items/domain/enums/inventory-item-status.enum';
import { InventoryItemAuditLogEntity } from '../inventory-items/infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryItemEntity } from '../inventory-items/infrastructure/persistence/inventory-item.entity';
import { isExternalItemIdConflict } from '../inventory-items/infrastructure/persistence/inventory-item-sync';
import { InventoryItemImageStatus } from '../inventory-item-images/domain/enums/inventory-item-image-status.enum';
import { InventoryItemImageEntity } from '../inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import {
  EXTERNAL_ITEM_ID_PATTERN,
  MobileItemListQueryDto,
  MobileItemUpsertDto,
} from './dto/mobile-items.dto';
import {
  MobileAccessService,
  MobileProjectAccess,
} from './mobile-access.service';

type Kind = 'text' | 'plate' | 'int' | 'money';
type Writable = Exclude<
  keyof MobileItemUpsertDto,
  'base_version' | 'extra_fields'
>;
const FIELDS: Array<[Writable, keyof InventoryItemEntity, Kind]> = [
  ['sequence', 'sequence', 'text'],
  ['old_plate', 'oldPlate', 'plate'],
  ['old_plate_2', 'oldPlate2', 'plate'],
  ['new_plate', 'newPlate', 'plate'],
  ['unit_text', 'unitText', 'text'],
  ['address_text', 'addressText', 'text'],
  ['location_text', 'locationText', 'text'],
  ['description', 'description', 'text'],
  ['brand', 'brand', 'text'],
  ['model', 'model', 'text'],
  ['serial_number', 'serialNumber', 'text'],
  ['capacity', 'capacity', 'text'],
  ['year', 'year', 'int'],
  ['notes', 'notes', 'text'],
  ['used_value', 'usedValue', 'money'],
  ['new_value', 'newValue', 'money'],
];
const DELETED = [InventoryItemStatus.INACTIVE, InventoryItemStatus.REMOVED];
const MAX_EXTRA_FIELDS = 100;

type Changes = Record<string, { before: unknown; after: unknown }>;
export type MobileItemImage = ReturnType<MobileItemsService['imageView']>;

/**
 * Mobile item API over the shared inventory tables. Identity is the device id
 * (`external_item_id`, unique per project); `version` is the item's sync
 * sequence. Writes are serialized per project by the sync counter lock, so the
 * upsert is safe under retries and concurrent devices; the unique key is the
 * last line of defence (retried once).
 */
@Injectable()
export class MobileItemsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: MobileAccessService,
    private readonly scope: InventoryItemScopeService,
  ) {}

  async upsert(
    actor: AuthenticatedUser,
    projectId: number,
    externalId: string,
    dto: MobileItemUpsertDto,
  ) {
    this.assertExternalId(externalId);
    const access = await this.access.assertProject(actor, projectId, true);
    this.assertExtraFields(dto.extra_fields);
    for (let attempt = 0; ; attempt++) {
      try {
        return await identityTransaction(this.db, (manager) =>
          this.upsertTx(manager, actor, access, externalId, dto),
        );
      } catch (error) {
        if (attempt < 2 && this.isRetryable(error)) continue;
        throw error;
      }
    }
  }

  async remove(
    actor: AuthenticatedUser,
    projectId: number,
    externalId: string,
    baseVersion?: number,
  ) {
    this.assertExternalId(externalId);
    const access = await this.access.assertProject(actor, projectId, true);
    return identityTransaction(this.db, async (manager) => {
      await this.lockProject(manager, projectId);
      const existing = await this.find(manager, projectId, externalId);
      if (!existing)
        throw new NotFoundException({
          code: 'ITEM_NOT_FOUND',
          message: 'Item não encontrado neste projeto.',
        });
      if (this.isDeleted(existing))
        return {
          result: 'already_deleted' as const,
          item: this.view(existing),
        };
      if (baseVersion !== undefined && baseVersion !== existing.syncSeq)
        this.conflict('VERSION_CONFLICT', existing);
      const before = existing.status;
      existing.status = InventoryItemStatus.INACTIVE;
      existing.deletedAt = new Date();
      existing.updatedById = actor.id;
      const saved = await manager
        .getRepository(InventoryItemEntity)
        .save(existing);
      await this.audit(
        manager,
        saved,
        InventoryItemAuditOperation.DEACTIVATE,
        actor,
        access,
        {
          status: { before, after: InventoryItemStatus.INACTIVE },
        },
      );
      return { result: 'deleted' as const, item: this.view(saved) };
    });
  }

  async get(actor: AuthenticatedUser, projectId: number, externalId: string) {
    this.assertExternalId(externalId);
    await this.access.assertProject(actor, projectId, false);
    const item = await this.find(this.db.manager, projectId, externalId);
    if (!item)
      throw new NotFoundException({
        code: 'ITEM_NOT_FOUND',
        message: 'Item não encontrado neste projeto.',
      });
    const images = await this.imagesOf([item.id]);
    return this.view(item, images.get(item.id) ?? []);
  }

  async list(
    actor: AuthenticatedUser,
    projectId: number,
    query: MobileItemListQueryDto,
  ) {
    await this.access.assertProject(actor, projectId, false);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 50;
    const qb = this.db
      .getRepository(InventoryItemEntity)
      .createQueryBuilder('item')
      .withDeleted()
      .where('item.projectId = :projectId', { projectId });
    if (query.include_deleted !== 'true') qb.andWhere('item.deletedAt IS NULL');
    const newPlate = this.scope.normalizePlate(query.new_plate);
    if (newPlate) qb.andWhere('item.newPlate = :newPlate', { newPlate });
    // "Old plate" matches both old plate columns (legacy placa_antiga_2).
    const oldPlate = this.scope.normalizePlate(query.old_plate);
    if (oldPlate)
      qb.andWhere('(item.oldPlate = :oldPlate OR item.oldPlate2 = :oldPlate)', {
        oldPlate,
      });
    if (query.search)
      qb.andWhere(
        '(item.description LIKE :search OR item.newPlate LIKE :search OR item.oldPlate LIKE :search OR item.oldPlate2 LIKE :search OR item.externalItemId LIKE :search)',
        { search: `%${query.search.replace(/[%_\\]/g, '\\$&')}%` },
      );
    const [rows, total] = await qb
      .orderBy('item.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const images = await this.imagesOf(rows.map((row) => row.id));
    return {
      items: rows.map((row) => this.view(row, images.get(row.id) ?? [])),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /**
   * Incremental download ordered by (version, id). Includes deleted items as
   * tombstones and items without external id (read-only for the app). The
   * cursor is bound to the project and safe to resume after failures.
   */
  async sync(
    actor: AuthenticatedUser,
    projectId: number,
    cursor: string | undefined,
    limit = 200,
  ) {
    await this.access.assertProject(actor, projectId, false);
    const from = this.decodeCursor(cursor, projectId);
    const rows = await this.db
      .getRepository(InventoryItemEntity)
      .createQueryBuilder('item')
      .withDeleted()
      .where('item.projectId = :projectId', { projectId })
      .andWhere(
        '(item.syncSeq > :seq OR (item.syncSeq = :seq AND item.id > :id))',
        { seq: from.seq, id: from.id },
      )
      .orderBy('item.syncSeq', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .take(limit + 1)
      .getMany();
    const page = rows.slice(0, limit);
    const images = await this.imagesOf(page.map((row) => row.id));
    const last = page[page.length - 1];
    return {
      items: page.map((row) => this.view(row, images.get(row.id) ?? [])),
      next_cursor: last
        ? this.encodeCursor(projectId, last.syncSeq, Number(last.id))
        : this.encodeCursor(projectId, from.seq, from.id),
      has_more: rows.length > limit,
      server_time: new Date().toISOString(),
    };
  }

  /** Item of the project addressed by external id (writes need it live). */
  async resolveItem(
    actor: AuthenticatedUser,
    projectId: number,
    externalId: string,
    mutate: boolean,
  ): Promise<{ item: InventoryItemEntity; access: MobileProjectAccess }> {
    this.assertExternalId(externalId);
    const access = await this.access.assertProject(actor, projectId, mutate);
    const item = await this.find(this.db.manager, projectId, externalId);
    if (!item)
      throw new NotFoundException({
        code: 'ITEM_NOT_FOUND',
        message: 'Item não encontrado neste projeto.',
      });
    if (mutate && this.isDeleted(item)) this.conflict('ITEM_DELETED', item);
    return { item, access };
  }

  async currentVersion(itemId: number): Promise<number> {
    const row = await this.db
      .getRepository(InventoryItemEntity)
      .findOne({ where: { id: itemId }, withDeleted: true });
    return row?.syncSeq ?? 0;
  }

  private async upsertTx(
    manager: EntityManager,
    actor: AuthenticatedUser,
    access: MobileProjectAccess,
    externalId: string,
    dto: MobileItemUpsertDto,
  ) {
    const projectId = access.project.id;
    await this.lockProject(manager, projectId);
    const repo = manager.getRepository(InventoryItemEntity);
    const existing = await this.find(manager, projectId, externalId);
    if (!existing) {
      if (dto.base_version)
        throw new NotFoundException({
          code: 'ITEM_NOT_FOUND',
          message:
            'O item informado com base_version não existe neste projeto.',
        });
      const created = repo.create({
        organizationId: access.organizationId,
        projectId,
        externalItemId: externalId,
        source: 'mobile_app',
        status: InventoryItemStatus.PENDING,
        metadata: null,
        createdById: actor.id,
        updatedById: actor.id,
      });
      const changes = this.applyDto(created, dto);
      const saved = await repo.save(created);
      await this.audit(
        manager,
        saved,
        InventoryItemAuditOperation.CREATE,
        actor,
        access,
        changes,
      );
      return { result: 'created' as const, item: this.view(saved, []) };
    }
    if (this.isDeleted(existing)) this.conflict('ITEM_DELETED', existing);
    const probe = repo.create({ ...existing });
    const changes = this.applyDto(probe, dto);
    if (Object.keys(changes).length === 0)
      return { result: 'unchanged' as const, item: this.view(existing) };
    if (
      dto.base_version === undefined ||
      dto.base_version === null ||
      dto.base_version !== existing.syncSeq
    )
      this.conflict('VERSION_CONFLICT', existing);
    this.applyDto(existing, dto);
    existing.updatedById = actor.id;
    const saved = await repo.save(existing);
    await this.audit(
      manager,
      saved,
      InventoryItemAuditOperation.UPDATE,
      actor,
      access,
      changes,
    );
    return { result: 'updated' as const, item: this.view(saved) };
  }

  /** Applies provided fields (null clears) and returns the effective diff. */
  private applyDto(
    target: InventoryItemEntity,
    dto: MobileItemUpsertDto,
  ): Changes {
    const changes: Changes = {};
    const record = target as unknown as Record<string, unknown>;
    for (const [key, column, kind] of FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(dto, key)) continue;
      const before = this.normalize(kind, record[column]);
      const after = this.normalize(kind, dto[key]);
      if (before === after) continue;
      record[column] = after;
      changes[key] = { before, after };
    }
    const metadata: Record<string, unknown> = { ...(target.metadata ?? {}) };
    if (Object.prototype.hasOwnProperty.call(dto, 'extra_fields')) {
      const before = (metadata.extra_fields as Record<string, string>) ?? null;
      const after = this.cleanExtra(dto.extra_fields);
      if (this.stable(before) !== this.stable(after)) {
        changes.extra_fields = { before, after };
        if (after === null) delete metadata.extra_fields;
        else metadata.extra_fields = after;
      }
    }
    if (changes.extra_fields)
      target.metadata = Object.keys(metadata).length ? metadata : null;
    return changes;
  }

  private normalize(kind: Kind, value: unknown): string | number | null {
    if (value === undefined || value === null) return null;
    if (kind === 'int') return Number(value);
    if (kind === 'money') return Number(value).toFixed(2);
    const text =
      typeof value === 'string'
        ? value
        : typeof value === 'number'
          ? value.toString()
          : JSON.stringify(value);
    if (kind === 'plate') return this.scope.normalizePlate(text) ?? null;
    return this.scope.cleanText(text) ?? null;
  }

  private cleanExtra(
    value: Record<string, string> | null | undefined,
  ): Record<string, string> | null {
    if (!value) return null;
    const entries = Object.entries(value)
      .map(
        ([k, v]) => [k.trim(), typeof v === 'string' ? v.trim() : v] as const,
      )
      .filter(([k, v]) => k && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    return entries.length ? Object.fromEntries(entries) : null;
  }

  assertExtraFields(value: unknown): void {
    if (value === undefined || value === null) return;
    const entries = Object.entries(value as Record<string, unknown>);
    if (
      entries.length > MAX_EXTRA_FIELDS ||
      entries.some(
        ([k, v]) =>
          k.length > 100 ||
          (v !== null && (typeof v !== 'string' || v.length > 1000)),
      )
    )
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'extra_fields aceita até 100 campos de texto (nome ≤100, valor ≤1000 caracteres).',
      });
  }

  private stable(value: Record<string, string> | null): string {
    return value
      ? JSON.stringify(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        )
      : 'null';
  }

  private assertExternalId(externalId: string): void {
    if (!EXTERNAL_ITEM_ID_PATTERN.test(externalId))
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'external_item_id inválido: use até 100 caracteres [A-Za-z0-9._:-].',
      });
  }

  private find(manager: EntityManager, projectId: number, externalId: string) {
    return manager.getRepository(InventoryItemEntity).findOne({
      where: { projectId, externalItemId: externalId },
      withDeleted: true,
    });
  }

  /** Serializes item writes of a project (same row the sync sequence uses). */
  private async lockProject(manager: EntityManager, projectId: number) {
    if (manager.connection.options.type === 'mysql') {
      await manager.query(
        'INSERT INTO inventory_item_sync_counters (project_id, last_seq) VALUES (?, 0) ON DUPLICATE KEY UPDATE last_seq = last_seq',
        [projectId],
      );
      await manager.query(
        'SELECT last_seq FROM inventory_item_sync_counters WHERE project_id = ? FOR UPDATE',
        [projectId],
      );
    }
  }

  private isRetryable(error: unknown): boolean {
    return (
      isExternalItemIdConflict(error) ||
      (error instanceof QueryFailedError &&
        /ER_LOCK_DEADLOCK|ER_LOCK_WAIT_TIMEOUT|SQLITE_BUSY/.test(
          String(
            (error as QueryFailedError & { code?: string }).code ??
              error.message,
          ),
        ))
    );
  }

  private isDeleted(item: InventoryItemEntity): boolean {
    return !!item.deletedAt || DELETED.includes(item.status);
  }

  private conflict(
    code: 'VERSION_CONFLICT' | 'ITEM_DELETED',
    item: InventoryItemEntity,
  ): never {
    throw new ConflictException({
      code,
      message:
        code === 'ITEM_DELETED'
          ? 'O item foi excluído e não pode ser alterado nem reativado pelo aplicativo.'
          : 'O item mudou no servidor. Baixe a versão atual e reaplique a alteração.',
      details: { item: this.view(item) },
    });
  }

  private async audit(
    manager: EntityManager,
    item: InventoryItemEntity,
    operation: InventoryItemAuditOperation,
    actor: AuthenticatedUser,
    access: MobileProjectAccess,
    changes: Changes,
  ) {
    await manager.getRepository(InventoryItemAuditLogEntity).save({
      inventoryItemId: item.id,
      organizationId: item.organizationId,
      projectId: item.projectId,
      operation,
      performedBy: actor.id,
      changes: {
        ...changes,
        _context: {
          before: null,
          after: {
            channel: 'mobile',
            field_agent_id: access.agent.id,
            version: item.syncSeq,
          },
        },
      },
    });
  }

  private async imagesOf(itemIds: number[]) {
    const grouped = new Map<number, MobileItemImage[]>();
    if (!itemIds.length) return grouped;
    const images = await this.db.getRepository(InventoryItemImageEntity).find({
      where: {
        inventoryItemId: In(itemIds),
        status: Not(InventoryItemImageStatus.REMOVED),
      },
      order: { id: 'ASC' },
    });
    for (const image of images) {
      const id = Number(image.inventoryItemId);
      grouped.set(id, [...(grouped.get(id) ?? []), this.imageView(image)]);
    }
    return grouped;
  }

  imageView(image: InventoryItemImageEntity) {
    return {
      id: Number(image.id),
      status: image.status,
      original_name: image.originalName,
      mime_type: image.mimeType,
      size_bytes: Number(image.sizeBytes),
      checksum: image.checksum ?? null,
      created_at: image.createdAt.toISOString(),
    };
  }

  view(item: InventoryItemEntity, images?: MobileItemImage[]) {
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const money = (value: unknown) =>
      value === null || value === undefined ? null : Number(value).toFixed(2);
    return {
      id: Number(item.id),
      external_item_id: item.externalItemId,
      version: item.syncSeq,
      sequence: item.sequence,
      old_plate: item.oldPlate,
      old_plate_2: item.oldPlate2 ?? null,
      new_plate: item.newPlate,
      unit_text: item.unitText,
      address_text: item.addressText,
      location_text: item.locationText,
      description: item.description,
      brand: item.brand,
      model: item.model,
      serial_number: item.serialNumber,
      capacity: item.capacity,
      year: item.year,
      notes: item.notes,
      source: item.source,
      used_value: money(item.usedValue),
      new_value: money(item.newValue),
      extra_fields: (metadata.extra_fields as Record<string, string>) ?? {},
      status: item.status,
      deleted: this.isDeleted(item),
      created_by_id: item.createdById,
      updated_by_id: item.updatedById,
      created_at: item.createdAt?.toISOString() ?? null,
      updated_at: item.updatedAt?.toISOString() ?? null,
      deleted_at: item.deletedAt?.toISOString() ?? null,
      ...(images ? { images } : {}),
    };
  }

  private encodeCursor(projectId: number, seq: number, id: number): string {
    return Buffer.from(
      JSON.stringify({ v: 1, p: projectId, s: seq, i: id }),
    ).toString('base64url');
  }

  private decodeCursor(
    cursor: string | undefined,
    projectId: number,
  ): { seq: number; id: number } {
    if (!cursor) return { seq: -1, id: 0 };
    try {
      const value = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as {
        v?: unknown;
        p?: unknown;
        s?: unknown;
        i?: unknown;
      };
      if (
        value.v === 1 &&
        value.p === projectId &&
        Number.isSafeInteger(value.s) &&
        Number.isSafeInteger(value.i) &&
        (value.s as number) >= -1 &&
        (value.i as number) >= 0
      )
        return { seq: value.s as number, id: value.i as number };
    } catch {
      // fall through
    }
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Cursor inválido para este projeto. Reinicie a sincronização.',
    });
  }
}
