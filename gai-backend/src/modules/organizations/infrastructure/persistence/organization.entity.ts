import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PRIMARY_KEY_COLUMN } from '../../../../common/persistence/entity-id.columns';
import { OrganizationStatus } from '../../domain/enums/organization-status.enum';

@Entity('organizations')
@Index('idx_organizations_status', ['status'])
@Index('idx_organizations_legal_name', ['legalName'])
export class OrganizationEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'legal_name', type: 'varchar', length: 255 })
  legalName!: string;

  @Column({ name: 'trade_name', type: 'varchar', length: 255, nullable: true })
  tradeName!: string | null;

  @Column({ type: 'varchar', length: 14, unique: true })
  cnpj!: string;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contactEmail!: string | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  contactPhone!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: OrganizationStatus.ACTIVE,
  })
  status!: OrganizationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
