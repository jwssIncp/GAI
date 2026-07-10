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
import { JsonRecord } from '../../domain/entities/catalog-asset';
import { CatalogAssetStatus } from '../../domain/enums/catalog-asset-status.enum';

@Entity('catalog_assets')
@Index('idx_catalog_assets_org_status', ['organizationId', 'status'])
@Index('idx_catalog_assets_org_category', ['organizationId', 'category'])
@Index(
  'uq_catalog_assets_org_description_normalized',
  ['organizationId', 'descriptionNormalized'],
  { unique: true },
)
export class CatalogAssetEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
  id!: number;

  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ name: 'description_normalized', type: 'varchar', length: 255 })
  descriptionNormalized!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 20, default: CatalogAssetStatus.ACTIVE })
  status!: CatalogAssetStatus;

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
