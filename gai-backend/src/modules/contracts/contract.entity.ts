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
import type { ContractDataDto } from './contract.dto';

function numericIds(target: object) {
  const row = target as Record<string, unknown>;
  for (const key of [
    'id',
    'organizationId',
    'projectId',
    'companyId',
    'contractId',
    'actorId',
  ]) {
    if (row[key] == null) continue;
    const value = Number(row[key]);
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error('Contract ID outside the safe integer range');
    row[key] = value;
  }
}
export interface ContractSnapshot extends ContractDataDto {
  current_value: string | null;
  current_ends_on: string | null;
  current_scope: string | null;
  company_name: string;
  company_state: string | null;
}
@Entity('project_contracts')
@Index('uq_contract_number', ['organizationId', 'number'], { unique: true })
export class ContractEntity {
  @AfterLoad() @AfterInsert() normalizeIds() {
    numericIds(this);
  }
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN }) companyId!: number;
  @Column({ length: 100 }) number!: string;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'json' }) data!: ContractSnapshot;
}
@Entity('project_contract_versions')
@Index('uq_contract_revision', ['contractId', 'revision'], { unique: true })
export class ContractVersionEntity {
  @AfterLoad() @AfterInsert() normalizeIds() {
    numericIds(this);
  }
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'contract_id', ...FOREIGN_KEY_COLUMN }) contractId!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'json' }) data!: ContractSnapshot;
  @Column({ length: 20 }) operation!: string;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
}
@Entity('project_contract_amendments')
@Index('uq_contract_amendment', ['contractId', 'identifier'], { unique: true })
export class ContractAmendmentEntity {
  @AfterLoad() @AfterInsert() normalizeIds() {
    numericIds(this);
  }
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'contract_id', ...FOREIGN_KEY_COLUMN }) contractId!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ length: 100 }) identifier!: string;
  @Column({
    name: 'dated_on',
    type: 'date',
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  datedOn!: string;
  @Column({ length: 20 }) type!: string;
  @Column({
    name: 'value_delta',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  valueDelta!: string | null;
  @Column({
    name: 'ends_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  endsOn!: string | null;
  @Column({ type: 'text', nullable: true }) scope!: string | null;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
}
@Entity('commercial_report_snapshots')
export class CommercialReportEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @Column({ type: 'json' }) payload!: Record<string, unknown>;
}
export const CONTRACT_ENTITIES = [
  ContractEntity,
  ContractVersionEntity,
  ContractAmendmentEntity,
  CommercialReportEntity,
];
