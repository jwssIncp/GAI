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
import { RoleType } from '../../domain/enums/role-type.enum';

@Entity('roles')
@Index('uk_roles_key', ['key'], { unique: true })
@Index('uk_roles_org_name', ['organizationId', 'name'], { unique: true })
@Index('idx_roles_organization_id', ['organizationId'])
@Index('idx_roles_type', ['type'])
export class RoleEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  key!: string | null;

  @Column({ type: 'varchar', length: 20 })
  type!: RoleType;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  organizationId!: number | null;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
