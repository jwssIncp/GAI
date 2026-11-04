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
} from '../../common/persistence/entity-id.columns';
import type {
  MatchConfig,
  MatchEvidence,
  MatchSource,
} from './matching.policy';

class ScopedRecord {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) sessionId!: number;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
@Entity('assisted_reconciliation_runs')
@Index('idx_assisted_runs_scope', [
  'organizationId',
  'projectId',
  'sessionId',
  'id',
])
export class AssistedRun extends ScopedRecord {
  @Column({ type: 'json' }) config!: MatchConfig;
  @Column({ name: 'source_hash', length: 64 }) sourceHash!: string;
  @Column({ name: 'after_item_id', ...FOREIGN_KEY_COLUMN })
  afterItemId!: number;
  @Column({ name: 'next_item_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  nextItemId!: number | null;
  @Column({ type: 'json' }) summary!: Record<string, number>;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN })
  createdById!: number;
}
@Entity('assisted_reconciliation_candidates')
@Index('idx_assisted_candidates_run', ['runId', 'id'])
@Index(
  'uq_assisted_candidate_pair',
  ['runId', 'inventoryItemId', 'accountingItemId'],
  { unique: true },
)
export class AssistedCandidate extends ScopedRecord {
  @Column({ name: 'run_id', ...FOREIGN_KEY_COLUMN }) runId!: number;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemId!: number;
  @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  accountingItemId!: number | null;
  @Column({ type: 'json' }) physical!: MatchSource;
  @Column({ type: 'json', nullable: true }) accounting!: MatchSource | null;
  @Column({ type: 'json', nullable: true }) evidence!: MatchEvidence | null;
  @Column({ type: 'json' }) warnings!: string[];
  @Column({ length: 20, default: 'pending' }) status!: string;
  @Column({ type: 'int', default: 1 }) revision!: number;
}
@Entity('assisted_reconciliation_decisions')
@Index('idx_assisted_decision_candidate', ['candidateId', 'id'])
@Index(
  'uq_assisted_decision_command',
  ['organizationId', 'projectId', 'commandKey'],
  { unique: true },
)
export class AssistedDecision extends ScopedRecord {
  @Column({ name: 'candidate_id', ...FOREIGN_KEY_COLUMN }) candidateId!: number;
  @Column({ name: 'command_key', length: 80 }) commandKey!: string;
  @Column({ length: 64 }) fingerprint!: string;
  @Column({ length: 20 }) action!: string;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ name: 'source_hash', length: 64 }) sourceHash!: string;
  @Column({ name: 'reconciliation_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  reconciliationId!: number | null;
  @Column({ type: 'json' }) result!: {
    id: number;
    status: string;
    revision: number;
    reconciliationId: number | null;
  };
}
@Entity('assisted_reconciliation_claims')
@Index('uq_assisted_claim_accounting', ['projectId', 'accountingItemId'], {
  unique: true,
})
@Index('uq_assisted_claim_physical', ['projectId', 'inventoryItemId'], {
  unique: true,
})
export class AssistedClaim extends ScopedRecord {
  @Column({ name: 'candidate_id', ...FOREIGN_KEY_COLUMN }) candidateId!: number;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemId!: number;
  @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN })
  accountingItemId!: number;
}
export const ASSISTED_ENTITIES = [
  AssistedRun,
  AssistedCandidate,
  AssistedDecision,
  AssistedClaim,
];
