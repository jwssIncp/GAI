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
import type { Family, SourceSelectionDto, TemplateDataDto } from './report.dto';
import type { VisualTemplate } from '../documents/document.contract';
export type Cell = string | number | boolean | null;
export interface SourceTable {
  family: Family;
  columns: string[];
  rows: Cell[][];
  references: { id: number; version: string }[];
  hash: string;
}
export interface ReportSources {
  selection: SourceSelectionDto;
  generated_at: string;
  permissions: string[];
  tables: SourceTable[];
  fields: Record<string, string | null>;
  metrics: Record<string, string | number | null>;
  missing: string[];
  unresolved: number | null;
  hash: string;
}
export interface ReportContent {
  visual_template?: VisualTemplate;
  title: string;
  template: {
    id: number;
    version_id: number;
    hash: string;
    data: TemplateDataDto;
  };
  sections: {
    key: string;
    title: string;
    text: string;
    origin: 'template' | 'manual';
  }[];
  fields: {
    key: string;
    label: string;
    value: string;
    origin: 'system' | 'manual' | 'empty';
    source_key: string | null;
    original_value: string | null;
  }[];
  sources: ReportSources;
  responsibles: ResponsibleData[];
  technical_notes: string;
  conclusion: string;
}
export interface ResponsibleData {
  id: number;
  user_id: number;
  display_name: string;
  function: string;
  professional_registration: string;
  registration_evidence: string;
}
export interface Validation {
  hash_algorithm?: string;
  engine: string;
  valid: boolean;
  issues: {
    code: string;
    severity: 'warning' | 'block';
    message: string;
    key?: string;
  }[];
  source_hash: string;
}
class RecordBase {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @AfterLoad() normalize() {
    const r = this as unknown as Record<string, unknown>;
    for (const k of [
      'id',
      'organizationId',
      'projectId',
      'templateId',
      'reportId',
      'actorId',
      'approvedVersionId',
      'publishedVersionId',
      'userId',
    ])
      if (r[k] != null) {
        const n = Number(r[k]);
        if (!Number.isSafeInteger(n) || n < 1)
          throw Error('Unsafe technical report ID');
        r[k] = n;
      }
  }
}
@Entity('technical_report_templates')
@Index('idx_technical_templates_org', ['organizationId', 'id'])
export class ReportTemplate extends RecordBase {
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'boolean' }) archived!: boolean;
  @Column({ type: 'json' }) data!: TemplateDataDto;
  @Column({
    name: 'published_version_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  publishedVersionId!: number | null;
}
@Entity('technical_report_template_versions')
@Index('uq_technical_template_revision', ['templateId', 'revision'], {
  unique: true,
})
export class ReportTemplateVersion extends RecordBase {
  @Column({ name: 'template_id', ...FOREIGN_KEY_COLUMN }) templateId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ length: 20 }) operation!: string;
  @Column({ type: 'json' }) data!: TemplateDataDto;
  @Column({ length: 64 }) hash!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @Column({ type: 'text' }) reason!: string;
}
@Entity('technical_report_responsibles')
@Index('uq_technical_responsible_user', ['organizationId', 'userId'], {
  unique: true,
})
export class ReportResponsible extends RecordBase {
  @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN }) userId!: number;
  @Column({ type: 'json' }) data!: ResponsibleData;
}
@Entity('technical_reports')
@Index('idx_technical_reports_project', ['organizationId', 'projectId', 'id'])
export class TechnicalReport extends RecordBase {
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ length: 20 }) status!: string;
  @Column({ type: 'json' }) data!: ReportContent;
  @Column({
    name: 'approved_version_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  approvedVersionId!: number | null;
}
@Entity('technical_report_versions')
@Index('uq_technical_report_revision', ['reportId', 'revision'], {
  unique: true,
})
export class TechnicalReportVersion extends RecordBase {
  @Column({ name: 'report_id', ...FOREIGN_KEY_COLUMN }) reportId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ length: 20 }) status!: string;
  @Column({ type: 'json' }) data!: ReportContent;
  @Column({ type: 'json' }) validation!: Validation;
  @Column({ length: 64 }) hash!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @Column({ type: 'text' }) reason!: string;
}
@Entity('technical_report_commands')
@Index('uq_technical_report_command', ['organizationId', 'commandKey'], {
  unique: true,
})
export class ReportCommand extends RecordBase {
  @Column({ name: 'command_key', length: 100 }) commandKey!: string;
  @Column({ length: 64 }) hash!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ length: 80 }) operation!: string;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @Column({ type: 'json' }) result!: Record<string, unknown>;
}
export const TECHNICAL_REPORT_ENTITIES = [
  ReportTemplate,
  ReportTemplateVersion,
  ReportResponsible,
  TechnicalReport,
  TechnicalReportVersion,
  ReportCommand,
];
