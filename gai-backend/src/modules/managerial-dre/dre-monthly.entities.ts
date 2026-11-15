import {
  AfterLoad,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FOREIGN_KEY_COLUMN,
  PRIMARY_KEY_COLUMN,
} from '../../common/persistence/entity-id.columns';

const ids = (row: object, keys: string[]) => {
  const r = row as Record<string, unknown>;
  for (const k of keys) if (r[k] != null) r[k] = Number(r[k]);
};

/**
 * Regra de reconhecimento (M13, decisão D-G): qual conta do plano recebe cada
 * tipo de movimento do fluxo a partir do mês de corte, ou qual conta faz cada
 * papel na projeção (adicional de IR, equipamentos, back-office, filial,
 * comissão do sócio). Uma conta por tipo; nenhuma conta fixa no código.
 */
@Entity('dre_recognition_rules')
@Index('uq_dre_recognition_rule', ['organizationId', 'kind'], { unique: true })
export class DreRecognitionRuleEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ type: 'varchar', length: 40 }) kind!: string;
  @Column({ name: 'account_id', ...FOREIGN_KEY_COLUMN }) accountId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @AfterLoad() load() {
    ids(this, ['id', 'organizationId', 'accountId', 'actorId']);
  }
}

export interface DreLayoutData {
  /** Contas ocultas na tela (continuam nos totais). */
  hidden: number[];
  /** Contas mostradas na DRE resumida (além das linhas calculadas). */
  summary: number[];
  /** Contas pós-operacionais (abaixo do resultado operacional). */
  post_operational: number[];
}

/** Layout da DRE mensal por organização (M14). */
@Entity('dre_report_layouts')
@Index('uq_dre_report_layout', ['organizationId'], { unique: true })
export class DreReportLayoutEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'json' }) data!: DreLayoutData;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @AfterLoad() load() {
    ids(this, ['id', 'organizationId', 'actorId']);
  }
}

/** Importação de planilha da DRE (M15): rastreia arquivo, mapeamento e autor. */
@Entity('dre_imports')
export class DreImportEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ type: 'varchar', length: 4 }) year!: string;
  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;
  @Column({ type: 'varchar', length: 64 }) checksum!: string;
  @Column({ type: 'json' }) data!: Record<string, unknown>;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @AfterLoad() load() {
    ids(this, ['id', 'organizationId', 'actorId']);
  }
}

/**
 * Valor lançado (digitado ou importado) numa célula conta × mês da DRE mensal.
 * Aceita sinal (ajustes negativos do histórico). Nulo = valor apagado (a linha
 * fica para o histórico). Estimativas nunca são gravadas aqui.
 */
@Entity('dre_monthly_values')
@Index('uq_dre_monthly_value', ['organizationId', 'accountId', 'month'], {
  unique: true,
})
export class DreMonthlyValueEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'account_id', ...FOREIGN_KEY_COLUMN }) accountId!: number;
  @Column({ type: 'varchar', length: 7 }) month!: string;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount!: string | null;
  @Column({ type: 'varchar', length: 10 }) origin!: string;
  @Column({ name: 'import_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importId!: number | null;
  @Column({ type: 'int' }) revision!: number;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @AfterLoad() load() {
    ids(this, ['id', 'organizationId', 'accountId', 'importId', 'actorId']);
  }
}

/** Histórico de cada valor lançado (quem, quando, por quê, de/para). */
@Entity('dre_monthly_value_versions')
@Index('uq_dre_monthly_value_revision', ['valueId', 'revision'], {
  unique: true,
})
export class DreMonthlyValueVersionEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'value_id', ...FOREIGN_KEY_COLUMN }) valueId!: number;
  @Column({ type: 'int' }) revision!: number;
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount!: string | null;
  @Column({ type: 'varchar', length: 10 }) origin!: string;
  @Column({ name: 'import_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  importId!: number | null;
  @Column({ type: 'text' }) reason!: string;
  @Column({ name: 'actor_id', ...FOREIGN_KEY_COLUMN }) actorId!: number;
  @Column({ name: 'recorded_at', type: 'datetime', precision: 3 })
  recordedAt!: Date;
  @AfterLoad() load() {
    ids(this, ['id', 'organizationId', 'valueId', 'importId', 'actorId']);
  }
}

export const DRE_MONTHLY_ENTITIES = [
  DreRecognitionRuleEntity,
  DreReportLayoutEntity,
  DreImportEntity,
  DreMonthlyValueEntity,
  DreMonthlyValueVersionEntity,
];
