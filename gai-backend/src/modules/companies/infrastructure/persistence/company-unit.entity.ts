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
import { CompanyUnitStatus } from '../../domain/enums/company-unit-status.enum';

@Entity('company_units')
@Index('idx_company_units_organization_company_status', [
  'organizationId',
  'companyId',
  'status',
])
@Index('idx_company_units_organization_company_code', [
  'organizationId',
  'companyId',
  'code',
])
@Index('idx_company_units_organization_city_state', [
  'organizationId',
  'city',
  'state',
])
@Index('idx_company_units_name', ['name'])
export class CompanyUnitEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ name: 'company_id', ...FOREIGN_KEY_COLUMN })
  companyId!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  code!: string | null;

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

  @Column({ type: 'varchar', length: 20, default: CompanyUnitStatus.ACTIVE })
  status!: CompanyUnitStatus;

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
