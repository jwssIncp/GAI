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
import type {
  DocumentFormat,
  DocumentKind,
  VisualTemplate,
} from './document.contract';
class Base {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @AfterLoad() @AfterInsert() normalize() {
    for (const k of [
      'id',
      'organizationId',
      'actorId',
      'sourceId',
      'versionId',
      'projectId',
    ] as const) {
      const r = this as unknown as Record<string, unknown>;
      if (r[k] != null) {
        const n = Number(r[k]);
        if (!Number.isSafeInteger(n) || n < 1)
          throw new Error('Unsafe document ID');
        r[k] = n;
      }
    }
  }
}
@Entity('document_visual_versions')
export class DocumentVisualVersion extends Base {
  @Column({ type: 'json' }) data!: VisualTemplate;
  @Column({ length: 64 }) hash!: string;
}
@Entity('document_artifacts')
@Index('uq_document_artifact_key', ['cacheKey'], { unique: true })
export class DocumentArtifact extends Base {
  @Column({ name: 'cache_key', length: 64 }) cacheKey!: string;
  @Column({ type: 'varchar', length: 12 }) kind!: DocumentKind;
  @Column({ name: 'source_id', ...FOREIGN_KEY_COLUMN }) sourceId!: number;
  @Column({ name: 'version_id', ...FOREIGN_KEY_COLUMN }) versionId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  projectId!: number | null;
  @Column({ type: 'varchar', length: 8 }) format!: DocumentFormat;
  @Column({ name: 'source_hash', length: 64 }) sourceHash!: string;
  @Column({ name: 'visual_hash', length: 64 }) visualHash!: string;
  @Column({ name: 'visual_version', length: 80 }) visualVersion!: string;
  @Column({ name: 'include_memory', type: 'boolean' }) includeMemory!: boolean;
  @Column({ length: 120 }) status!: string;
  @Column({ length: 64 }) checksum!: string;
  @Column({ name: 'size_bytes', type: 'int' }) sizeBytes!: number;
  @Column({
    type:
      process.env.NODE_ENV === 'test' &&
      process.env.GAI_TEST_MYSQL_DISPOSABLE !== '1'
        ? 'blob'
        : 'mediumblob',
    select: false,
  })
  bytes!: Buffer;
}
@Entity('document_audit_logs')
export class DocumentAudit extends Base {
  @Column({ length: 30 }) operation!: string;
  @Column({ type: 'json' }) details!: Record<string, unknown>;
}
export const DOCUMENT_ENTITIES = [
  DocumentVisualVersion,
  DocumentArtifact,
  DocumentAudit,
];
