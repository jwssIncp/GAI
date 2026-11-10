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

/**
 * Client idempotency keys for mobile creations without a natural id (e.g.
 * expenses). The unique (organization, scope, key) row is claimed before the
 * resource is created, so retries/timeouts never create a second resource.
 */
@Entity('mobile_idempotency_keys')
@Index(
  'uq_mobile_idempotency_keys',
  ['organizationId', 'scope', 'idempotencyKey'],
  {
    unique: true,
  },
)
export class MobileIdempotencyKeyEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN })
  userId!: number;

  @Column({ type: 'varchar', length: 30 })
  scope!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ name: 'resource_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  resourceId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
