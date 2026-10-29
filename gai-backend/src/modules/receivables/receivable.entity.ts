import { CIVIL_DATE_TRANSFORMER } from '../../common/persistence/civil-date.transformer';
import {
  AfterLoad,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../common/persistence/entity-id.columns';
import type { ReceivableInputDto } from './receivable.dto';
function normalize(target: object, keys: string[]) {
  const r = target as Record<string, unknown>;
  for (const k of keys)
    if (r[k] != null) {
      const n = Number(r[k]);
      if (!Number.isSafeInteger(n) || n < 1)
        throw new Error('Unsafe finance ID');
      r[k] = n;
    }
}
@Entity('receivables')
@Index('uq_receivable_source', ['organizationId', 'sourceKey'], {
  unique: true,
})
@Index('idx_receivable_cohort', ['organizationId', 'companyId', 'projectId'])
export class ReceivableEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) companyId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  projectId!: number | null;
  @Column({ name: 'contract_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  contractId!: number | null;
  @Column({ name: 'source_key', type: 'varchar', length: 100, nullable: true })
  sourceKey!: string | null;
  @Column({ type: 'json' }) data!: ReceivableInputDto & {
    source_snapshot: Record<string, unknown> | null;
  };
  @Column({ type: 'decimal', precision: 15, scale: 2 }) amount!: string;
  @Column({ type: 'varchar', length: 3 }) currency!: string;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'boolean', default: false }) cancelled!: boolean;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @AfterLoad() ids() {
    normalize(this, [
      'id',
      'organizationId',
      'companyId',
      'projectId',
      'contractId',
    ]);
  }
}
@Entity('receivable_installments')
@Index('uq_receivable_position', ['receivableId', 'position'], { unique: true })
@Index('idx_receivable_due', ['organizationId', 'dueOn'])
export class ReceivableInstallmentEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'receivable_id', ...FOREIGN_KEY_COLUMN })
  receivableId!: number;
  @Column({ type: 'int' }) position!: number;
  @Column({ type: 'varchar', length: 20 }) kind!: string;
  @Column({ name: 'due_on', type: 'date', transformer: CIVIL_DATE_TRANSFORMER })
  dueOn!: string;
  @Column({ type: 'decimal', precision: 15, scale: 2 }) amount!: string;
  @AfterLoad() ids() {
    normalize(this, ['id', 'organizationId', 'receivableId']);
  }
}
@Entity('receivable_events')
@Index('uq_finance_command', ['organizationId', 'commandKey'], { unique: true })
@Index('uq_receivable_revision', ['receivableId', 'revision'], { unique: true })
@Index('uq_receipt_reversal', ['reversesId'], { unique: true })
export class ReceivableEventEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'receivable_id', ...FOREIGN_KEY_COLUMN })
  receivableId!: number;
  @Column({ name: 'installment_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  installmentId!: number | null;
  @Column({ name: 'reverses_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  reversesId!: number | null;
  @Column({ name: 'command_key', type: 'varchar', length: 100 })
  commandKey!: string;
  @Column({ name: 'command_hash', type: 'varchar', length: 64 })
  commandHash!: string;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'varchar', length: 20 }) operation!: string;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount!: string | null;
  @Column({
    name: 'effective_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  effectiveOn!: string | null;
  @Column({ type: 'json' }) details!: Record<string, unknown>;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @AfterLoad() ids() {
    normalize(this, [
      'id',
      'organizationId',
      'receivableId',
      'installmentId',
      'reversesId',
      'actorId',
    ]);
  }
}
export const RECEIVABLE_ENTITIES = [
  ReceivableEntity,
  ReceivableInstallmentEntity,
  ReceivableEventEntity,
];
