import { InventoryItemStatus } from '../enums/inventory-item-status.enum';

export type JsonRecord = Record<string, unknown>;

export interface InventoryItemProps {
  id: number;
  organizationId: number;
  projectId: number;
  externalItemId: string | null;
  sequence: string | null;
  oldPlate: string | null;
  newPlate: string | null;
  unitText: string | null;
  addressText: string | null;
  locationText: string | null;
  description: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  capacity: string | null;
  year: number | null;
  notes: string | null;
  source: string | null;
  usedValue: string | null;
  newValue: string | null;
  status: InventoryItemStatus;
  metadata: JsonRecord | null;
  createdById: number | null;
  updatedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class InventoryItem {
  constructor(private readonly props: InventoryItemProps) {
    this.assertMoney(props.usedValue);
    this.assertMoney(props.newValue);
    this.assertYear(props.year);
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

  get status(): InventoryItemStatus {
    return this.props.status;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  updateFields(
    fields: Partial<
      Pick<
        InventoryItemProps,
        | 'externalItemId'
        | 'sequence'
        | 'oldPlate'
        | 'newPlate'
        | 'unitText'
        | 'addressText'
        | 'locationText'
        | 'description'
        | 'brand'
        | 'model'
        | 'serialNumber'
        | 'capacity'
        | 'year'
        | 'notes'
        | 'source'
        | 'usedValue'
        | 'newValue'
        | 'status'
        | 'metadata'
      >
    > & { updatedById: number | null },
  ): Record<string, { before: unknown; after: unknown }> {
    this.assertMoney(fields.usedValue);
    this.assertMoney(fields.newValue);
    this.assertYear(fields.year);

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [propKey, columnKey] of Object.entries(this.columnMap())) {
      const key = propKey as keyof InventoryItemProps;
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

    if (Object.keys(changes).length > 0) {
      this.props.updatedById = fields.updatedById;
    }
    return changes;
  }

  deactivate(
    actorId: number | null,
    now: Date,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === InventoryItemStatus.INACTIVE) {
      throw new Error('Inventory item is already inactive');
    }
    const beforeStatus = this.props.status;
    const beforeDeletedAt = this.props.deletedAt;
    this.props.status = InventoryItemStatus.INACTIVE;
    this.props.deletedAt = now;
    this.props.updatedById = actorId;
    return {
      status: { before: beforeStatus, after: this.props.status },
      deleted_at: { before: beforeDeletedAt, after: now },
    };
  }

  reactivate(
    actorId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== InventoryItemStatus.INACTIVE) {
      throw new Error('Only inactive inventory items can be reactivated');
    }
    const beforeDeletedAt = this.props.deletedAt;
    this.props.status = InventoryItemStatus.PENDING;
    this.props.deletedAt = null;
    this.props.updatedById = actorId;
    return {
      status: {
        before: InventoryItemStatus.INACTIVE,
        after: this.props.status,
      },
      deleted_at: { before: beforeDeletedAt, after: null },
    };
  }

  toProps(): InventoryItemProps {
    return { ...this.props };
  }

  private columnMap(): Record<string, string> {
    return {
      externalItemId: 'external_item_id',
      sequence: 'sequence',
      oldPlate: 'old_plate',
      newPlate: 'new_plate',
      unitText: 'unit_text',
      addressText: 'address_text',
      locationText: 'location_text',
      description: 'description',
      brand: 'brand',
      model: 'model',
      serialNumber: 'serial_number',
      capacity: 'capacity',
      year: 'year',
      notes: 'notes',
      source: 'source',
      usedValue: 'used_value',
      newValue: 'new_value',
      status: 'status',
      metadata: 'metadata',
    };
  }

  private assertMoney(value: string | null | undefined): void {
    if (value === null || value === undefined) {
      return;
    }
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(value)) {
      throw new Error('monetary values must be decimal strings');
    }
  }

  private assertYear(value: number | null | undefined): void {
    if (value === null || value === undefined) {
      return;
    }
    if (!Number.isInteger(value) || value < 1900 || value > 2100) {
      throw new Error('year must be between 1900 and 2100');
    }
  }
}
