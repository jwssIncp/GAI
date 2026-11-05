import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../../../common/persistence/entity-id.columns';
import { UserStatus } from '../../domain/enums/user.enums';

@Entity('users')
@Index('uq_users_field_scope', ['id', 'organizationId'], { unique: true })
@Index('idx_users_organization_id', ['organizationId'])
@Index('idx_users_status', ['status'])
export class UserEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;
  @Column({ name: 'full_name', type: 'varchar', length: 160, nullable: true })
  fullName!: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;
  @Column({ name: 'job_title', type: 'varchar', length: 120, nullable: true })
  jobTitle!: string | null;
  @Column({
    name: 'last_login_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastLoginAt!: Date | null;
  @Column({
    name: 'temporary_password_expires_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  temporaryPasswordExpiresAt!: Date | null;
  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;
  @Column({ name: 'auth_version', type: 'int', default: 0 })
  authVersion!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  organizationId!: number | null;

  @Column({ type: 'varchar', length: 100, unique: true })
  login!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({
    name: 'locked_until',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lockedUntil!: Date | null;

  @Column({ name: 'password_changed_at', type: 'datetime', precision: 3 })
  passwordChangedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
