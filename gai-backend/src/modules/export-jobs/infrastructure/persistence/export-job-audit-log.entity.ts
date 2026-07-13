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
import { ExportJobAuditOperation } from '../../domain/enums/export-job-audit-operation.enum';

@Entity('export_job_audit_logs')
@Index('idx_export_job_audit_job_created', ['exportJobId', 'createdAt'])
@Index('idx_export_job_audit_org_project', ['organizationId', 'projectId'])
export class ExportJobAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'export_job_id', ...FOREIGN_KEY_COLUMN })
  exportJobId!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN })
  projectId!: number;

  @Column({ type: 'varchar', length: 50 })
  operation!: ExportJobAuditOperation;

  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;

  @Column({ type: 'json' })
  changes!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
