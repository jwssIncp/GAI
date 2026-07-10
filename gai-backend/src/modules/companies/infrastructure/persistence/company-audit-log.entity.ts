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
import type { JsonRecord } from '../../domain/entities/company';
import { CompanyAuditOperation } from '../../domain/enums/company-audit-operation.enum';

@Entity('company_audit_logs')
@Index('idx_company_audit_company_created', ['companyId', 'createdAt'])
@Index('idx_company_audit_organization_id', ['organizationId'])
export class CompanyAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN })
  companyId!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ type: 'varchar', length: 50 })
  operation!: CompanyAuditOperation;

  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;

  @Column({ type: 'json' })
  changes!: JsonRecord;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
