import {
  AfterInsert,
  AfterLoad,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CIVIL_DATE_TRANSFORMER } from '../../common/persistence/civil-date.transformer';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../common/persistence/entity-id.columns';
import type { FinanceSettingsValuesDto } from './finance-settings.dto';

/** Versões dos parâmetros financeiros: só inclusão, nunca edição. */
@Entity('finance_settings_versions')
@Index('uq_finance_settings_version', ['organizationId', 'version'], {
  unique: true,
})
@Index('uq_finance_settings_valid_from', ['organizationId', 'validFrom'], {
  unique: true,
})
export class FinanceSettingsVersionEntity {
  @AfterLoad() @AfterInsert() normalizeIds() {
    // MySQL BIGINT chega como string; a API expõe números.
    const row = this as unknown as Record<string, unknown>;
    for (const key of ['id', 'organizationId', 'actorId'])
      if (row[key] != null) row[key] = Number(row[key]);
  }
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ type: 'int' }) version!: number;
  @Column({
    name: 'valid_from',
    type: 'date',
    transformer: CIVIL_DATE_TRANSFORMER,
  })
  validFrom!: string;
  @Column({ type: 'json' }) values!: FinanceSettingsValuesDto;
  @Column({ type: 'text' }) reason!: string;
  /** Nulo quando a versão foi criada pelo seed (sistema). */
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  actorId!: number | null;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
}
