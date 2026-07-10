import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../../../common/persistence/entity-id.columns';
import { InventoryItemImageStatus } from '../../domain/enums/inventory-item-image-status.enum';

@Entity('inventory_item_images')
@Index('idx_inventory_item_images_item_status', ['inventoryItemId', 'status'])
@Index('idx_inventory_item_images_organization_item', [
  'organizationId',
  'inventoryItemId',
])
@Index('idx_inventory_item_images_uploaded_by_id', ['uploadedById'])
export class InventoryItemImageEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemId!: number;

  @Column({ name: 'storage_provider', type: 'varchar', length: 30 })
  storageProvider!: string;

  @Column({ type: 'varchar', length: 255 })
  bucket!: string;

  @Column({ type: 'varchar', length: 1024 })
  path!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', ...FOREIGN_KEY_COLUMN })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum!: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: InventoryItemImageStatus.PENDING_UPLOAD,
  })
  status!: InventoryItemImageStatus;

  @Column({ name: 'uploaded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  uploadedById!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;
}
