import { Column, Entity, PrimaryColumn } from 'typeorm';
import { FOREIGN_KEY_COLUMN } from '../../../../common/persistence/entity-id.columns';

/** One row per project; `last_seq` is the last change sequence handed out. */
@Entity('inventory_item_sync_counters')
export class InventoryItemSyncCounterEntity {
  @PrimaryColumn({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ name: 'last_seq', ...FOREIGN_KEY_COLUMN, default: 0 })
  lastSeq!: number;
}
