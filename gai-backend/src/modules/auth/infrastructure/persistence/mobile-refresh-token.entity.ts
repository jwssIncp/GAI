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

/**
 * One row per issued mobile refresh token. Only the SHA-256 of the token is
 * stored. Rows of a login share `familyId` and the absolute `familyExpiresAt`;
 * each rotation marks the presented row `rotatedAt` and issues a new row.
 */
@Entity('mobile_refresh_tokens')
@Index('uq_mobile_refresh_tokens_hash', ['tokenHash'], { unique: true })
@Index('idx_mobile_refresh_tokens_family', ['familyId'])
@Index('idx_mobile_refresh_tokens_user', ['userId'])
export class MobileRefreshTokenEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'family_id', type: 'varchar', length: 36 })
  familyId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN })
  userId!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  /** Access session issued together with this refresh token. */
  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId!: string;

  @Column({ name: 'auth_version', type: 'int', default: 0 })
  authVersion!: number;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt!: Date;

  @Column({ name: 'family_expires_at', type: 'datetime', precision: 3 })
  familyExpiresAt!: Date;

  @Column({
    name: 'rotated_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  rotatedAt!: Date | null;

  @Column({
    name: 'revoked_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  revokedAt!: Date | null;

  @Column({
    name: 'revoked_reason',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  revokedReason!: string | null;

  @Column({ name: 'replaced_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  replacedById!: number | null;

  @Column({
    name: 'device_label',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  deviceLabel!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
