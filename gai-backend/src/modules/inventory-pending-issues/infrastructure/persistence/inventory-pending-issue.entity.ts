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
import { JsonRecord } from '../../domain/entities/inventory-pending-issue';
import { InventoryPendingIssueSeverity } from '../../domain/enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../../domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../../domain/enums/inventory-pending-issue-type.enum';

@Entity('inventory_pending_issues')
@Index('idx_inventory_pending_issues_project_status', ['projectId', 'status'])
@Index('idx_inventory_pending_issues_project_type', ['projectId', 'type'])
@Index('idx_inventory_pending_issues_inventory_item', ['inventoryItemId'])
@Index('idx_inventory_pending_issues_accounting_item', ['accountingItemId'])
export class InventoryPendingIssueEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  inventoryItemId!: number | null;

  @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  accountingItemId!: number | null;

  @Column({ type: 'varchar', length: 60 })
  type!: InventoryPendingIssueType;

  @Column({
    type: 'varchar',
    length: 20,
    default: InventoryPendingIssueStatus.OPEN,
  })
  status!: InventoryPendingIssueStatus;

  @Column({
    type: 'varchar',
    length: 20,
    default: InventoryPendingIssueSeverity.MEDIUM,
  })
  severity!: InventoryPendingIssueSeverity;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'old_value', type: 'json', nullable: true })
  oldValue!: JsonRecord | null;

  @Column({ name: 'new_value', type: 'json', nullable: true })
  newValue!: JsonRecord | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes!: string | null;

  @Column({ name: 'resolved_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  resolvedById!: number | null;

  @Column({
    name: 'resolved_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  resolvedAt!: Date | null;

  @Column({ name: 'ignored_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  ignoredById!: number | null;

  @Column({
    name: 'ignored_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  ignoredAt!: Date | null;

  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;

  @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  updatedById!: number | null;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

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
