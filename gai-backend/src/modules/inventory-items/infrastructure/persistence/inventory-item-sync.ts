import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  InsertEvent,
  QueryFailedError,
  UpdateEvent,
} from 'typeorm';
import { InventoryItemImageEntity } from '../../../inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { InventoryItemEntity } from './inventory-item.entity';

/**
 * Takes the next sequence of a project inside the caller's transaction. The
 * upsert locks the counter row until commit, so concurrent writers of the same
 * project commit in sequence order and a reader never sees seq N+1 committed
 * while N is still pending (no gaps can be skipped by a cursor).
 */
export async function nextProjectSyncSeq(
  manager: EntityManager,
  projectId: number,
): Promise<number> {
  const mysql = manager.connection.options.type === 'mysql';
  await manager.query(
    mysql
      ? 'INSERT INTO inventory_item_sync_counters (project_id, last_seq) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_seq = last_seq + 1'
      : 'INSERT INTO inventory_item_sync_counters (project_id, last_seq) VALUES (?, 1) ON CONFLICT(project_id) DO UPDATE SET last_seq = last_seq + 1',
    [projectId],
  );
  const rows = await manager.query<Array<{ seq: string | number }>>(
    'SELECT last_seq AS seq FROM inventory_item_sync_counters WHERE project_id = ?',
    [projectId],
  );
  return Number(rows[0].seq);
}

/** True when the error is the (project_id, external_item_id) unique key. */
export function isExternalItemIdConflict(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const message = String(error.message);
  return (
    message.includes('uq_inventory_items_project_external') ||
    message.includes(
      'inventory_items.project_id, inventory_items.external_item_id',
    )
  );
}

/**
 * Every write of an inventory item (web, import, mobile) takes a new sync
 * sequence; image writes bump their item so photo changes are synchronized too.
 * Applies to entity saves; bulk QueryBuilder updates on these tables must call
 * nextProjectSyncSeq themselves.
 */
@Injectable()
export class InventoryItemSyncSubscriber implements EntitySubscriberInterface<
  InventoryItemEntity | InventoryItemImageEntity
> {
  constructor(dataSource: DataSource) {
    if (
      !dataSource.subscribers.some(
        (s) => s instanceof InventoryItemSyncSubscriber,
      )
    )
      dataSource.subscribers.push(this);
  }

  async beforeInsert(
    event: InsertEvent<InventoryItemEntity | InventoryItemImageEntity>,
  ): Promise<void> {
    if (this.isItem(event))
      await this.stamp(event.manager, event.entity as InventoryItemEntity);
  }

  async beforeUpdate(
    event: UpdateEvent<InventoryItemEntity | InventoryItemImageEntity>,
  ): Promise<void> {
    if (event.entity && this.isItem(event))
      await this.stamp(event.manager, event.entity as InventoryItemEntity);
  }

  async afterInsert(
    event: InsertEvent<InventoryItemEntity | InventoryItemImageEntity>,
  ): Promise<void> {
    if (this.isImage(event))
      await this.bumpItem(
        event.manager,
        (event.entity as InventoryItemImageEntity).inventoryItemId,
      );
  }

  async afterUpdate(
    event: UpdateEvent<InventoryItemEntity | InventoryItemImageEntity>,
  ): Promise<void> {
    if (event.entity && this.isImage(event))
      await this.bumpItem(
        event.manager,
        (event.entity as InventoryItemImageEntity).inventoryItemId ??
          (event.databaseEntity as InventoryItemImageEntity | undefined)
            ?.inventoryItemId,
      );
  }

  private isItem(event: { metadata: { target: unknown } }): boolean {
    return event.metadata.target === InventoryItemEntity;
  }

  private isImage(event: { metadata: { target: unknown } }): boolean {
    return event.metadata.target === InventoryItemImageEntity;
  }

  private async stamp(
    manager: EntityManager,
    item: InventoryItemEntity,
  ): Promise<void> {
    if (!item.projectId) return;
    item.syncSeq = await nextProjectSyncSeq(manager, Number(item.projectId));
  }

  private async bumpItem(
    manager: EntityManager,
    itemId: number | undefined,
  ): Promise<void> {
    if (!itemId) return;
    const rows = await manager.query<Array<{ projectId: string | number }>>(
      'SELECT project_id AS projectId FROM inventory_items WHERE id = ?',
      [itemId],
    );
    if (!rows.length) return;
    const seq = await nextProjectSyncSeq(manager, Number(rows[0].projectId));
    await manager.query(
      'UPDATE inventory_items SET sync_seq = ? WHERE id = ?',
      [seq, itemId],
    );
  }
}
