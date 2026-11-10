import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

import { FOREIGN_KEY_COLUMN } from '../../../../common/persistence/entity-id.columns';

export type SessionClientType = 'web' | 'mobile';

@Entity('sessions')
@Index('idx_sessions_user_id', ['userId'])
@Index('idx_sessions_expires_at', ['expiresAt'])
@Index('idx_sessions_refresh_family', ['refreshFamilyId'])
export class SessionEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id!: string;
  @Column({ name: 'auth_version', type: 'int', default: 0 })
  authVersion!: number;

  @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN })
  userId!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  organizationId!: number | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt!: Date;

  @Column({
    name: 'revoked_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'last_activity_at', type: 'datetime', precision: 3 })
  lastActivityAt!: Date;

  /** 'web' sessions slide on activity; 'mobile' access sessions never extend. */
  @Column({ name: 'client_type', type: 'varchar', length: 10, default: 'web' })
  clientType!: SessionClientType;

  /** Mobile refresh-token family that issued this access session. */
  @Column({
    name: 'refresh_family_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  refreshFamilyId!: string | null;
}
