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
import {
  ConsolidationDecision,
  InventoryObservationResult,
  InventoryRoundKind,
  InventoryRoundStatus,
  InventorySessionStatus,
  PlateEvidenceSource,
  ReconciliationStatus,
} from '../../domain/inventory-operation.enums';

type JsonObject = Record<string, unknown>;

@Entity('inventory_sessions')
@Index('idx_inventory_sessions_org_project', ['organizationId', 'projectId'])
@Index('idx_inventory_sessions_project_status', ['projectId', 'status'])
export class InventorySessionEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({
    type: 'varchar',
    length: 20,
    default: InventorySessionStatus.DRAFT,
  })
  status!: InventorySessionStatus;
  @Column({
    name: 'started_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  startedAt!: Date | null;
  @Column({
    name: 'finished_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  finishedAt!: Date | null;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;
  @Column({ type: 'json', nullable: true }) metadata!: JsonObject | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity('inventory_rounds')
@Index('uq_inventory_rounds_session_number', ['sessionId', 'roundNumber'], {
  unique: true,
})
@Index('idx_inventory_rounds_target', ['inventoryItemId', 'status'])
export class InventoryRoundEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) sessionId!: number;
  @Column({ name: 'round_number', type: 'int', unsigned: true })
  roundNumber!: number;
  @Column({ type: 'varchar', length: 20 }) kind!: InventoryRoundKind;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  inventoryItemId!: number | null;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ type: 'varchar', length: 20, default: InventoryRoundStatus.ACTIVE })
  status!: InventoryRoundStatus;
  @Column({ name: 'requested_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  requestedById!: number | null;
  @Column({ name: 'started_at', type: 'datetime', precision: 3 })
  startedAt!: Date;
  @Column({
    name: 'finished_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  finishedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity('inventory_observations')
@Index(
  'uq_inventory_observations_org_idempotency',
  ['organizationId', 'idempotencyKey'],
  { unique: true },
)
@Index('uq_inventory_observations_round_item', ['roundId', 'inventoryItemId'], {
  unique: true,
})
@Index('idx_inventory_observations_item_captured', [
  'inventoryItemId',
  'capturedAt',
])
export class InventoryObservationEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) sessionId!: number;
  @Column({ name: 'round_id', ...FOREIGN_KEY_COLUMN }) roundId!: number;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemId!: number;
  @Column({ name: 'field_agent_id', ...FOREIGN_KEY_COLUMN })
  fieldAgentId!: number;
  @Column({
    name: 'prior_observation_id',
    ...FOREIGN_KEY_COLUMN,
    nullable: true,
  })
  priorObservationId!: number | null;
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  idempotencyKey!: string | null;
  @Column({ type: 'varchar', length: 30 }) result!: InventoryObservationResult;
  @Column({
    name: 'observed_plate',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  observedPlate!: string | null;
  @Column({
    name: 'observed_serial_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  observedSerialNumber!: string | null;
  @Column({ name: 'unit_text', type: 'varchar', length: 255, nullable: true })
  unitText!: string | null;
  @Column({ name: 'sector_text', type: 'varchar', length: 255, nullable: true })
  sectorText!: string | null;
  @Column({ name: 'location_text', type: 'text', nullable: true })
  locationText!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'captured_at', type: 'datetime', precision: 3 })
  capturedAt!: Date;
  @Column({ name: 'received_at', type: 'datetime', precision: 3 })
  receivedAt!: Date;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;
}

@Entity('inventory_plate_history')
@Index('idx_inventory_plate_history_item_created', [
  'inventoryItemId',
  'createdAt',
])
export class InventoryPlateHistoryEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemId!: number;
  @Column({ name: 'observation_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  observationId!: number | null;
  @Column({
    name: 'previous_plate',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  previousPlate!: string | null;
  @Column({
    name: 'observed_plate',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  observedPlate!: string | null;
  @Column({ type: 'varchar', length: 30 }) source!: PlateEvidenceSource;
  @Column({ name: 'recorded_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  recordedById!: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity('inventory_reconciliations')
@Index('idx_inventory_reconciliations_session_run', ['sessionId', 'runNumber'])
@Index('idx_inventory_reconciliations_item_status', [
  'inventoryItemId',
  'status',
])
export class InventoryReconciliationEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) sessionId!: number;
  @Column({ name: 'run_number', type: 'int', unsigned: true })
  runNumber!: number;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  inventoryItemId!: number | null;
  @Column({ name: 'observation_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  observationId!: number | null;
  @Column({ name: 'accounting_item_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  accountingItemId!: number | null;
  @Column({ type: 'varchar', length: 30 }) status!: ReconciliationStatus;
  @Column({
    name: 'physical_plate',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  physicalPlate!: string | null;
  @Column({
    name: 'accounting_plate',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  accountingPlate!: string | null;
  @Column({ type: 'json' }) evidence!: JsonObject;
  @Column({ name: 'created_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  createdById!: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity('inventory_consolidations')
@Index('uq_inventory_consolidations_reconciliation', ['reconciliationId'], {
  unique: true,
})
export class InventoryConsolidationEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'session_id', ...FOREIGN_KEY_COLUMN }) sessionId!: number;
  @Column({ name: 'reconciliation_id', ...FOREIGN_KEY_COLUMN })
  reconciliationId!: number;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  inventoryItemId!: number | null;
  @Column({ type: 'varchar', length: 20 }) decision!: ConsolidationDecision;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'json' }) evidenceSnapshot!: JsonObject;
  @Column({ name: 'decided_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  decidedById!: number | null;
  @Column({ name: 'decided_at', type: 'datetime', precision: 3 })
  decidedAt!: Date;
}

@Entity('asset_valuations')
@Index('idx_asset_valuations_item_date', ['inventoryItemId', 'valuationDate'])
export class AssetValuationEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ name: 'inventory_item_id', ...FOREIGN_KEY_COLUMN })
  inventoryItemId!: number;
  @Column({ type: 'varchar', length: 255 }) source!: string;
  @Column({
    name: 'new_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  newValue!: string | null;
  @Column({
    name: 'used_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  usedValue!: string | null;
  @Column({ name: 'valuation_date', type: 'date' }) valuationDate!: Date;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'responsible_by_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  responsibleById!: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity('inventory_operation_audit_logs')
@Index('idx_inventory_operation_audit_project_created', [
  'projectId',
  'createdAt',
])
export class InventoryOperationAuditLogEntity {
  @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN) id!: number;
  @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
  organizationId!: number;
  @Column({ name: 'project_id', ...FOREIGN_KEY_COLUMN }) projectId!: number;
  @Column({ type: 'varchar', length: 50 }) entity!: string;
  @Column({ name: 'entity_id', ...FOREIGN_KEY_COLUMN, nullable: true })
  entityId!: number | null;
  @Column({ type: 'varchar', length: 60 }) operation!: string;
  @Column({ name: 'performed_by', ...FOREIGN_KEY_COLUMN, nullable: true })
  performedBy!: number | null;
  @Column({ type: 'json' }) changes!: JsonObject;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
