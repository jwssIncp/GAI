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

/** M10: pedido de placas de patrimônio (compra do fornecedor e revenda ao cliente). */
@Entity('asset_tag_orders')
@Index('idx_asset_tag_orders_org_project', ['organizationId', 'projectId'])
export class AssetTagOrderEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({
    name: 'proposal_number',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  proposalNumber!: string | null;
  @Column({
    name: 'ordered_on',
    type: 'date',
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  orderedOn!: string;
  @Column({ type: 'int', unsigned: true }) quantity!: number;
  @Column({
    name: 'sequence_start',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  sequenceStart!: number | null;
  @Column({
    name: 'sequence_end',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  sequenceEnd!: number | null;
  @Column({ type: 'varchar', length: 60, nullable: true }) model!:
    | string
    | null;
  @Column({ name: 'supplier_name', type: 'varchar', length: 150 })
  supplierName!: string;
  @Column({ name: 'unit_cost', type: 'decimal', precision: 15, scale: 4 })
  unitCost!: string;
  @Column({
    name: 'supplier_payment_status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  supplierPaymentStatus!: 'pending' | 'paid';
  @Column({
    name: 'supplier_expected_payment_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  supplierExpectedPaymentOn!: string | null;
  @Column({
    name: 'supplier_paid_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  supplierPaidOn!: string | null;
  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 4 })
  unitPrice!: string;
  @Column({
    name: 'client_expected_receipt_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  clientExpectedReceiptOn!: string | null;
  @Column({
    name: 'client_received_on',
    type: 'date',
    nullable: true,
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  clientReceivedOn!: string | null;
  @Column({
    name: 'expense_type_override',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  expenseTypeOverride!: string | null;
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

/** Auditoria das placas: cada alteração com antes/depois (a tela confirma "De/Para"). */
@Entity('asset_tag_order_audit_logs')
@Index('idx_asset_tag_order_audit_order', ['orderId'])
export class AssetTagOrderAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'order_id', ...FOREIGN_KEY_COLUMN }) orderId!: number;
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
