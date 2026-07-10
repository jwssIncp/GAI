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
import { JsonRecord } from '../../domain/entities/company';
import { CompanyStatus } from '../../domain/enums/company-status.enum';

@Entity('companies')
@Index('idx_companies_organization_status', ['organizationId', 'status'])
@Index('idx_companies_organization_document', ['organizationId', 'document'], {
  unique: true,
})
@Index('idx_companies_organization_city_state', [
  'organizationId',
  'city',
  'state',
])
@Index('idx_companies_name', ['name'])
export class CompanyEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({
    name: 'corporate_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  corporateName!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  document!: string | null;

  @Column({
    name: 'state_registration',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  stateRegistration!: string | null;

  @Column({
    name: 'municipal_registration',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  municipalRegistration!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  zipcode!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  number!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  complement!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, default: 'BR' })
  country!: string | null;

  @Column({ type: 'varchar', length: 20, default: CompanyStatus.ACTIVE })
  status!: CompanyStatus;

  @Column({ type: 'json', nullable: true })
  metadata!: JsonRecord | null;

  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;

  @Column({ name: 'updated_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  updatedById!: number | null;

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
