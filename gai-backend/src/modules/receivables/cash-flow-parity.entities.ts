import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CIVIL_DATE_TRANSFORMER } from '../../common/persistence/civil-date.transformer';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../common/persistence/entity-id.columns';

/**
 * Decisão sobre uma proposta de recebível (D-F): descartada. A proposta só
 * volta a aparecer se mudar (outro hash), ex.: valor ou plano do contrato.
 */
@Entity('receivable_proposal_decisions')
@Index(
  'uq_receivable_proposal_decision',
  ['organizationId', 'sourceKey', 'proposalHash'],
  { unique: true },
)
export class ReceivableProposalDecisionEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'source_key', type: 'varchar', length: 100 })
  sourceKey!: string;
  @Column({ name: 'proposal_hash', type: 'varchar', length: 64 })
  proposalHash!: string;
  @Column({ type: 'varchar', length: 20 }) decision!: string;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  actorId!: number | null;
  @CreateDateColumn({ name: 'decided_at', type: 'datetime', precision: 3 })
  decidedAt!: Date;
}

/**
 * Baixa manual de saída feita no fluxo de caixa. A chave é a identidade da
 * origem (ex.: "expense:12:installment:2"), nunca data/descrição/valor: editar
 * a origem não perde a baixa (bug do INVESTOR, doc 06 §7.6).
 */
@Entity('cash_outflow_settlements')
@Index('uq_cash_outflow_settlement', ['organizationId', 'sourceKey'], {
  unique: true,
})
export class CashOutflowSettlementEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  projectId!: number | null;
  @Column({ name: 'source_key', type: 'varchar', length: 100 })
  sourceKey!: string;
  /** Nulo = baixa desfeita (a linha fica para o histórico). */
  @Column({
    name: 'paid_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  paidOn!: string | null;
  @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  updatedById!: number | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

/** Auditoria das ações do fluxo de caixa (propostas e baixas de saída). */
@Entity('cash_flow_audit_logs')
@Index('idx_cash_flow_audit_target', ['organizationId', 'targetKey'])
export class CashFlowAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ type: 'varchar', length: 40 }) operation!: string;
  @Column({ name: 'target_key', type: 'varchar', length: 100 })
  targetKey!: string;
  @Column({ type: 'json' }) changes!: Record<string, unknown>;
  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

export const CASH_FLOW_PARITY_ENTITIES = [
  ReceivableProposalDecisionEntity,
  CashOutflowSettlementEntity,
  CashFlowAuditLogEntity,
];
