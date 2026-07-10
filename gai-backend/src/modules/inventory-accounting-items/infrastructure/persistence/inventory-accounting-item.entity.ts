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
import { JsonRecord } from '../../domain/entities/inventory-accounting-item';
import { InventoryAccountingItemStatus } from '../../domain/enums/inventory-accounting-item-status.enum';

@Entity('inventory_accounting_items')
@Index('idx_inventory_accounting_items_project_status', ['projectId', 'status'])
@Index('idx_inventory_accounting_items_organization_project', [
  'organizationId',
  'projectId',
])
@Index('idx_inventory_accounting_items_plate', ['plate'])
@Index('idx_inventory_accounting_items_base_code', ['baseCode'])
@Index('idx_inventory_accounting_items_investor_code', ['investorCode'])
export class InventoryAccountingItemEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  plate!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'accounting_account_description',
    type: 'text',
    nullable: true,
  })
  accountingAccountDescription!: string | null;

  @Column({ type: 'text', nullable: true })
  location!: string | null;

  @Column({ name: 'acquisition_date', type: 'date', nullable: true })
  acquisitionDate!: Date | null;

  @Column({
    name: 'acquisition_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  acquisitionValue!: string | null;

  @Column({ name: 'base_code', type: 'varchar', length: 100, nullable: true })
  baseCode!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: InventoryAccountingItemStatus.PENDING,
  })
  status!: InventoryAccountingItemStatus;

  @Column({
    name: 'investor_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  investorCode!: string | null;

  @Column({ name: 'note_1', type: 'text', nullable: true })
  note1!: string | null;

  @Column({ name: 'note_2', type: 'text', nullable: true })
  note2!: string | null;

  @Column({
    name: 'new_inventory_plate',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  newInventoryPlate!: string | null;

  @Column({ name: 'inventory_description', type: 'text', nullable: true })
  inventoryDescription!: string | null;

  @Column({ name: 'inventory_location', type: 'text', nullable: true })
  inventoryLocation!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

  @Column({ name: 'imported_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importedById!: number | null;

  @Column({ name: 'import_batch_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importBatchId!: number | null;

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
