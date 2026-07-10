import { InventoryAccountingItemStatus } from '../enums/inventory-accounting-item-status.enum';

export type JsonRecord = Record<string, unknown>;

export interface InventoryAccountingItemProps {
  id: number;
  organizationId: number;
  projectId: number;
  plate: string | null;
  description: string | null;
  accountingAccountDescription: string | null;
  location: string | null;
  acquisitionDate: Date | null;
  acquisitionValue: string | null;
  baseCode: string | null;
  status: InventoryAccountingItemStatus;
  investorCode: string | null;
  note1: string | null;
  note2: string | null;
  newInventoryPlate: string | null;
  inventoryDescription: string | null;
  inventoryLocation: string | null;
  metadata: JsonRecord | null;
  importedById: number | null;
  importBatchId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class InventoryAccountingItem {
  constructor(private readonly props: InventoryAccountingItemProps) {
    this.assertMoney(props.acquisitionValue);
    this.assertDate(props.acquisitionDate);
  }

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get projectId(): number {
    return this.props.projectId;
  }

  get status(): InventoryAccountingItemStatus {
    return this.props.status;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  updateFields(
    fields: Partial<
      Pick<
        InventoryAccountingItemProps,
        | 'plate'
        | 'description'
        | 'accountingAccountDescription'
        | 'location'
        | 'acquisitionDate'
        | 'acquisitionValue'
        | 'baseCode'
        | 'status'
        | 'investorCode'
        | 'note1'
        | 'note2'
        | 'newInventoryPlate'
        | 'inventoryDescription'
        | 'inventoryLocation'
        | 'metadata'
        | 'importedById'
        | 'importBatchId'
      >
    >,
  ): Record<string, { before: unknown; after: unknown }> {
    this.assertMoney(fields.acquisitionValue);
    this.assertDate(fields.acquisitionDate);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [propKey, columnKey] of Object.entries(this.columnMap())) {
      const key = propKey as keyof InventoryAccountingItemProps;
      if (!(key in fields)) {
        continue;
      }
      const next = fields[key as keyof typeof fields];
      const current = this.props[key];
      if (JSON.stringify(current) === JSON.stringify(next)) {
        continue;
      }
      changes[columnKey] = { before: current, after: next };
      (this.props as unknown as Record<string, unknown>)[key] = next;
    }
    return changes;
  }

  deactivate(now: Date): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === InventoryAccountingItemStatus.INACTIVE) {
      throw new Error('Inventory accounting item is already inactive');
    }
    const beforeStatus = this.props.status;
    const beforeDeletedAt = this.props.deletedAt;
    this.props.status = InventoryAccountingItemStatus.INACTIVE;
    this.props.deletedAt = now;
    return {
      status: { before: beforeStatus, after: this.props.status },
      deleted_at: { before: beforeDeletedAt, after: now },
    };
  }

  reactivate(): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== InventoryAccountingItemStatus.INACTIVE) {
      throw new Error(
        'Only inactive inventory accounting items can be reactivated',
      );
    }
    const beforeDeletedAt = this.props.deletedAt;
    this.props.status = InventoryAccountingItemStatus.PENDING;
    this.props.deletedAt = null;
    return {
      status: {
        before: InventoryAccountingItemStatus.INACTIVE,
        after: this.props.status,
      },
      deleted_at: { before: beforeDeletedAt, after: null },
    };
  }

  toProps(): InventoryAccountingItemProps {
    return { ...this.props };
  }

  private columnMap(): Record<string, string> {
    return {
      plate: 'plate',
      description: 'description',
      accountingAccountDescription: 'accounting_account_description',
      location: 'location',
      acquisitionDate: 'acquisition_date',
      acquisitionValue: 'acquisition_value',
      baseCode: 'base_code',
      status: 'status',
      investorCode: 'investor_code',
      note1: 'note_1',
      note2: 'note_2',
      newInventoryPlate: 'new_inventory_plate',
      inventoryDescription: 'inventory_description',
      inventoryLocation: 'inventory_location',
      metadata: 'metadata',
      importedById: 'imported_by_id',
      importBatchId: 'import_batch_id',
    };
  }

  private assertMoney(value: string | null | undefined): void {
    if (value === null || value === undefined) {
      return;
    }
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(value)) {
      throw new Error('acquisition_value must be a decimal string');
    }
  }

  private assertDate(value: Date | null | undefined): void {
    if (value === null || value === undefined) {
      return;
    }
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new Error('acquisition_date must be a real date');
    }
  }
}
