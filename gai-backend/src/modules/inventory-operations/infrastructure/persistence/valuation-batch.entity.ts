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
import type { PreviewValuationBatchDto } from '../../application/valuation-batch.dto';
import type { valuationValues } from '../../application/valuation.policy';
@Entity('asset_valuation_batches')
@Index(
  'uq_valuation_batch_command',
  ['organizationId', 'projectId', 'commandKey'],
  { unique: true },
)
@Index('idx_valuation_batches_project', ['organizationId', 'projectId', 'id'])
export class ValuationBatch {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'command_key', length: 80 }) commandKey!: string;
  @Column({ length: 64 }) fingerprint!: string;
  @Column({ name: 'preview_hash', length: 64 }) previewHash!: string;
  @Column({ type: 'json' }) request!: PreviewValuationBatchDto;
  @Column({ length: 20, default: 'preview' }) status!: string;
  @Column({ type: 'int', default: 1 }) revision!: number;
  @Column({ type: 'int' }) total!: number;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN })
  createdById!: number;
  @Column({ name: 'confirmed_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  confirmedById!: number | null;
  @Column({
    name: 'confirmed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  confirmedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt!: Date;
}
export interface ValuationItemSnapshot {
  id: number;
  old_plate: string | null;
  new_plate: string | null;
  description: string | null;
  status: string;
  last_valuation: Record<string, unknown> | null;
  version: string;
}
@Entity('asset_valuation_batch_rows')
@Index('uq_valuation_batch_item', ['batchId', 'inventoryItemId'], {
  unique: true,
})
export class ValuationBatchRow {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'batch_id', ...FOREIGN_KEY_COLUMN }) batchId!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemId!: number;
  @Column({ type: 'json' }) snapshot!: ValuationItemSnapshot;
  @Column({ type: 'json' }) proposed!: ReturnType<typeof valuationValues>;
  @Column({ name: 'valuation_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  valuationId!: number | null;
}
