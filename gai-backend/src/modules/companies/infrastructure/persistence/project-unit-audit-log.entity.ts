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

@Entity('project_unit_audit_logs')
@Index('idx_project_unit_audit_project_created', ['projectId', 'createdAt'])
@Index('idx_project_unit_audit_organization_id', ['organizationId'])
export class ProjectUnitAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ name: 'company_unit_id', ...FOREIGN_KEY_COLUMN })
  companyUnitId!: number;

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
