import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../../../common/persistence/entity-id.columns';
import { JsonRecord } from '../../domain/entities/field-agent';
import { FieldAgentStatus } from '../../domain/enums/field-agent-status.enum';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';

@Entity('field_agents')
@ForeignKey(() => OrganizationEntity, ['organizationId'], ['id'], {
  name: 'fk_field_agents_organization',
})
@ForeignKey(() => UserEntity, ['userId'], ['id'], {
  name: 'fk_field_agents_user',
})
@ForeignKey(
  () => UserEntity,
  ['userId', 'organizationId'],
  ['id', 'organizationId'],
  { name: 'fk_field_agents_user_scope' },
)
@Index('uq_field_agents_scope', ['id', 'organizationId'], { unique: true })
@Index('idx_field_agents_organization_status', ['organizationId', 'status'])
@Index('idx_field_agents_user_id', ['userId'])
@Index('idx_field_agents_name', ['name'])
@Index('uq_field_agents_org_email', ['organizationId', 'email'], {
  unique: true,
})
@Index('uq_field_agents_org_document', ['organizationId', 'document'], {
  unique: true,
})
@Index('uq_field_agents_live_user', ['liveUserId'], { unique: true })
export class FieldAgentEntity {
  @Column({
    name: 'live_user_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
    select: false,
    insert: false,
    update: false,
    generatedType: 'STORED',
    asExpression: 'CASE WHEN deleted_at IS NULL THEN user_id ELSE NULL END',
  })
  liveUserId!: number | null;
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'user_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  userId!: number | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  document!: string | null;

  @Column({ type: 'varchar', length: 20, default: FieldAgentStatus.ACTIVE })
  status!: FieldAgentStatus;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;
}
