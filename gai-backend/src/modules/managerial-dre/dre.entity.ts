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
import type { DreGroup } from './dre.dto';
function ids(row: object, keys: string[]) {
  const r = row as Record<string, unknown>;
  for (const k of keys)
    if (r[k] != null) {
      const n = Number(r[k]);
      if (!Number.isSafeInteger(n) || n < 1) throw Error('Unsafe DRE ID');
      r[k] = n;
    }
}
export interface AccountData {
  name: string;
  group: DreGroup;
  parent_id: number | null;
  posting: boolean;
  active: boolean;
}
export interface AccountSnapshot {
  id: number;
  revision: number;
  code: string;
  name: string;
  group: DreGroup;
  path: string[];
}
export interface SourceSnapshot {
  kind: string;
  id: number | null;
  key: string | null;
  project_id: number | null;
  amount: string | null;
  currency: string | null;
  eligible: boolean;
  hash: string;
  description: string;
  hint_date: string | null;
  remaining_amount?: string;
}
export interface EntryData {
  economic_key: string;
  event_document: string;
  description: string;
  currency: string;
  currency_reason: string;
  status: string;
  source: SourceSnapshot;
  allocations: Array<{
    month: string;
    amount: string;
    account: AccountSnapshot | null;
  }>;
}
@Entity('dre_accounts')
@Index('uq_dre_account_code', ['organizationId', 'code'], { unique: true })
export class DreAccount {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ type: 'varchar', length: 40 }) code!: string;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'json' }) data!: AccountData;
  @AfterLoad() ids() {
    ids(this, ['id', 'organizationId']);
  }
}
@Entity('dre_account_versions')
@Index('uq_dre_account_revision', ['accountId', 'revision'], { unique: true })
export class DreAccountVersion {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'account_id', ...FOREIGN_KEY_COLUMN }) accountId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'json' }) data!: AccountData;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @Column({ type: 'text' }) reason!: string;
  @AfterLoad() ids() {
    ids(this, ['id', 'organizationId', 'accountId', 'actorId']);
  }
}
@Entity('dre_entries')
@Index('uq_dre_economic_key', ['organizationId', 'economicKey'], {
  unique: true,
})
@Index('uq_dre_source', ['organizationId', 'sourceKey'], { unique: true })
export class DreEntry {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  projectId!: number | null;
  @Column({ name: 'economic_key', type: 'varchar', length: 180 })
  economicKey!: string;
  @Column({ name: 'source_key', type: 'varchar', length: 100, nullable: true })
  sourceKey!: string | null;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'json' }) data!: EntryData;
  @AfterLoad() ids() {
    ids(this, ['id', 'organizationId', 'projectId']);
  }
}
@Entity('dre_entry_versions')
@Index('uq_dre_entry_revision', ['entryId', 'revision'], { unique: true })
export class DreEntryVersion {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'entry_id', ...FOREIGN_KEY_COLUMN }) entryId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'json' }) data!: EntryData;
  @Column({ type: 'varchar', length: 64 }) hash!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @Column({ type: 'text' }) reason!: string;
  @AfterLoad() ids() {
    ids(this, ['id', 'organizationId', 'entryId', 'actorId']);
  }
}
export interface PeriodData {
  currency: string;
  policy_reference: string;
  reviewed_groups: DreGroup[];
  sources_reviewed: boolean;
  allow_incomplete: boolean;
  snapshot: Record<string, unknown>;
  hash: string;
}
@Entity('dre_periods')
@Index('uq_dre_period', ['organizationId', 'month'], { unique: true })
export class DrePeriod {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ type: 'varchar', length: 7 }) month!: string;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'boolean' }) closed!: boolean;
  @Column({ type: 'json' }) data!: PeriodData;
  @AfterLoad() ids() {
    ids(this, ['id', 'organizationId']);
  }
}
@Entity('dre_commands')
@Index('uq_dre_command', ['organizationId', 'commandKey'], { unique: true })
export class DreCommand {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'command_key', type: 'varchar', length: 100 })
  commandKey!: string;
  @Column({ type: 'varchar', length: 64 }) hash!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @Column({ type: 'varchar', length: 40 }) operation!: string;
  @Column({ type: 'json' }) result!: Record<string, unknown>;
  @Column({ type: 'text' }) reason!: string;
  @AfterLoad() ids() {
    ids(this, ['id', 'organizationId', 'actorId']);
  }
}
export const DRE_ENTITIES = [
  DreAccount,
  DreAccountVersion,
  DreEntry,
  DreEntryVersion,
  DrePeriod,
  DreCommand,
];
