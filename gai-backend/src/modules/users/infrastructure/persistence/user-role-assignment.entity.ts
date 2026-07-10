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

@Entity('user_role_assignments')
@Index('idx_user_role_assignments_user_id', ['userId'])
@Index('idx_user_role_assignments_role_id', ['roleId'])
export class UserRoleAssignmentEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN })
  userId!: number;

  @Column({ name: 'role_id', ...FOREIGN_KEY_COLUMN })
  roleId!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ name: 'assigned_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  assignedBy!: number | null;

  @Column({ name: 'assigned_at', type: 'datetime', precision: 3 })
  assignedAt!: Date;

  @Column({
    name: 'revoked_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
