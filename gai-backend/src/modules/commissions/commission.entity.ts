import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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

/** M11: parceiro comercial (nome + empresa, sem duplicar). */
@Entity('commission_partners')
@Index('uq_commission_partners_key', ['organizationId', 'nameKey'], {
  unique: true,
})
export class CommissionPartnerEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ type: 'varchar', length: 150 }) name!: string;
  @Column({ type: 'varchar', length: 150, nullable: true }) company!:
    | string
    | null;
  /** Nome + empresa normalizados (sem acento e caixa): impede duplicar. */
  @Column({ name: 'name_key', type: 'varchar', length: 310 }) nameKey!: string;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;
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

/** M12: comissão comercial de um projeto/contrato para um parceiro. */
@Entity('commissions')
@Index('idx_commissions_org_project', ['organizationId', 'projectId'])
export class CommissionEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'contract_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  contractId!: number | null;
  @Column({ name: 'partner_id', ...FOREIGN_KEY_COLUMN }) partnerId!: number;
  /** Nome do parceiro no lançamento: continua visível se o parceiro for excluído. */
  @Column({ name: 'partner_name_snapshot', type: 'varchar', length: 310 })
  partnerNameSnapshot!: string;
  @Column({
    name: 'contract_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  contractValue!: string;
  @Column({ type: 'decimal', precision: 5, scale: 2 }) percent!: string;
  @Column({
    name: 'amount_manual',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  amountManual!: string | null;
  @Column({
    name: 'expected_payment_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  expectedPaymentOn!: string | null;
  @Column({
    name: 'paid_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  paidOn!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
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

/** Auditoria de comissões e parceiros (antes/depois). */
@Entity('commission_audit_logs')
@Index('idx_commission_audit_target', ['commissionId', 'partnerId'])
export class CommissionAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'commission_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  commissionId!: number | null;
  @Column({ name: 'partner_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  partnerId!: number | null;
  @Column({ type: 'varchar', length: 40 }) operation!: string;
  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;
  @Column({ type: 'json' }) changes!: Record<
    string,
    { before: unknown; after: unknown }
  >;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
