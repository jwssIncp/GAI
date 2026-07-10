import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../../../common/persistence/entity-id.columns';

@Entity('inventory_item_image_audit_logs')
@Index('idx_inventory_item_image_audit_image_created', [
  'inventoryItemImageId',
  'createdAt',
])
@Index('idx_inventory_item_image_audit_item_created', [
  'inventoryItemId',
  'createdAt',
])
export class InventoryItemImageAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'inventory_item_image_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemImageId!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemId!: number;

  @Column({ type: 'varchar', length: 50 })
  operation!: string;

  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;

  @Column({ type: 'json' })
  changes!: Record<string, { before: unknown; after: unknown }>;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
