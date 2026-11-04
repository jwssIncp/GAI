import { CIVIL_DATE_TRANSFORMER } from '../../common/persistence/civil-date.transformer';
import {
  AfterLoad,
  AfterInsert,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../common/persistence/entity-id.columns';
import type {
  BudgetDataDto,
  BudgetStatus,
  PricingValuesDto,
} from './budget.dto';
import type { BudgetCalculation } from './budget.policy';
import type { VisualTemplate } from '../documents/document.contract';
// TypeORM hydrates MySQL BIGINT as strings, while the public/domain IDs are
// numbers. Test metadata uses integer IDs, so this also needs real-runtime QA.
function numericIds(target: object, keys: string[]) {
  const row = target as Record<string, unknown>;
  for (const key of keys)
    if (row[key] != null) {
      const value = Number(row[key]);
      if (!Number.isSafeInteger(value) || value < 1)
        throw new Error('Budget ID outside the safe integer range');
      row[key] = value;
    }
}
@Entity('budget_pricing_versions')
@Index('uq_budget_pricing_version', ['organizationId', 'name', 'version'], {
  unique: true,
})
export class BudgetPricingEntity {
  @AfterLoad() @AfterInsert() normalizeIds() {
    numericIds(this, ['id', 'organizationId', 'actorId']);
  }
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ length: 100 }) name!: string;
  @Column({ type: 'int' }) version!: number;
  @Column({
    name: 'valid_from',
    type: 'date',
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  validFrom!: string;
  @Column({
    name: 'valid_to',
    type: 'date',
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  validTo!: string;
  @Column({ type: 'json' }) values!: PricingValuesDto;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
}
@Entity('budgets')
@Index('uq_budget_number', ['organizationId', 'number'], { unique: true })
export class BudgetEntity {
  @AfterLoad() @AfterInsert() normalizeIds() {
    numericIds(this, [
      'id',
      'organizationId',
      'companyId',
      'projectId',
      'headVersionId',
      'approvedVersionId',
    ]);
  }
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) companyId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  projectId!: number | null;
  @Column({ length: 100 }) number!: string;
  @Column({ type: 'varchar', length: 20 }) status!: BudgetStatus;
  @Column({ type: 'int' }) revision!: number;
  @Column({ name: 'head_version_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  headVersionId!: number | null;
  @Column({
    name: 'approved_version_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  approvedVersionId!: number | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
export interface BudgetSnapshot {
  visual_template?: VisualTemplate;
  input: BudgetDataDto;
  pricing: {
    id: number;
    name: string;
    version: number;
    valid_from: string;
    valid_to: string;
    values: PricingValuesDto;
  };
  context: {
    company: { id: number; name: string; address: string | null };
    project: { id: number; name: string } | null;
    units: { id: number; name: string; address: string }[];
    responsible: { id: number; login: string };
  };
  calculation: BudgetCalculation;
}
@Entity('budget_versions')
@Index('uq_budget_version', ['budgetId', 'version'], { unique: true })
export class BudgetVersionEntity {
  @AfterLoad() @AfterInsert() normalizeIds() {
    numericIds(this, [
      'id',
      'organizationId',
      'budgetId',
      'pricingId',
      'baseVersionId',
      'actorId',
    ]);
  }
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'budget_id', ...FOREIGN_KEY_COLUMN }) budgetId!: number;
  @Column({ name: 'pricing_id', ...FOREIGN_KEY_COLUMN }) pricingId!: number;
  @Column({ type: 'int' }) version!: number;
  @Column({ type: 'varchar', length: 20 }) kind!: 'draft' | 'scenario';
  @Column({ length: 120 }) name!: string;
  @Column({ name: 'base_version_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  baseVersionId!: number | null;
  @Column({ type: 'json' }) snapshot!: BudgetSnapshot;
  @Column({ length: 64 }) hash!: string;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
}
@Entity('budget_audit_logs')
@Index('uq_budget_audit_revision', ['budgetId', 'revision'], { unique: true })
export class BudgetAuditEntity {
  @AfterLoad() @AfterInsert() normalizeIds() {
    numericIds(this, ['id', 'organizationId', 'budgetId', 'actorId']);
  }
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'budget_id', ...FOREIGN_KEY_COLUMN }) budgetId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ length: 30 }) operation!: string;
  @Column({ type: 'json' }) details!: Record<string, unknown>;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
}
export const BUDGET_ENTITIES = [
  BudgetPricingEntity,
  BudgetEntity,
  BudgetVersionEntity,
  BudgetAuditEntity,
];
