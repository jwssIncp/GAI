import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
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

@Entity('field_agents')
@Index('idx_field_agents_organization_status', ['organizationId', 'status'])
@Index('idx_field_agents_user_id', ['userId'])
@Index('idx_field_agents_name', ['name'])
export class FieldAgentEntity {
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
