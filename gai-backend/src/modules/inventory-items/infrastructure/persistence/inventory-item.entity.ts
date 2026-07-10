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
import { JsonRecord } from '../../domain/entities/inventory-item';
import { InventoryItemStatus } from '../../domain/enums/inventory-item-status.enum';

@Entity('inventory_items')
@Index('idx_inventory_items_project_status', ['projectId', 'status'])
@Index('idx_inventory_items_organization_project', [
  'organizationId',
  'projectId',
])
@Index('idx_inventory_items_old_plate', ['oldPlate'])
@Index('idx_inventory_items_new_plate', ['newPlate'])
@Index('idx_inventory_items_external_item_id', ['externalItemId'])
export class InventoryItemEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({
    name: 'external_item_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalItemId!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sequence!: string | null;

  @Column({ name: 'old_plate', type: 'varchar', length: 100, nullable: true })
  oldPlate!: string | null;

  @Column({ name: 'new_plate', type: 'varchar', length: 100, nullable: true })
  newPlate!: string | null;

  @Column({ name: 'unit_text', type: 'varchar', length: 255, nullable: true })
  unitText!: string | null;

  @Column({ name: 'address_text', type: 'text', nullable: true })
  addressText!: string | null;

  @Column({ name: 'location_text', type: 'text', nullable: true })
  locationText!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  @Column({
    name: 'serial_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  serialNumber!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  capacity!: string | null;

  @Column({ type: 'int', nullable: true })
  year!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source!: string | null;

  @Column({
    name: 'used_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  usedValue!: string | null;

  @Column({
    name: 'new_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  newValue!: string | null;

  @Column({ type: 'varchar', length: 20, default: InventoryItemStatus.PENDING })
  status!: InventoryItemStatus;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;

  @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  updatedById!: number | null;

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
