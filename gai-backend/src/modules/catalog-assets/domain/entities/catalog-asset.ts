import { CatalogAssetStatus } from '../enums/catalog-asset-status.enum';

export type JsonRecord = Record<string, unknown>;

export interface CatalogAssetProps {
  id: number;
  organizationId: number;
  description: string;
  descriptionNormalized: string;
  category: string | null;
  status: CatalogAssetStatus;
  metadata: JsonRecord | null;
  createdById: number | null;
  updatedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class CatalogAsset {
  constructor(private readonly props: CatalogAssetProps) {
    if (props.description.trim().length === 0) {
      throw new Error('description is required');
    }
    if (props.description.length > 255) {
      throw new Error('description must have at most 255 characters');
    }
    if (props.descriptionNormalized.trim().length === 0) {
      throw new Error('description_normalized is required');
    }
    if (props.category !== null && props.category.length > 100) {
      throw new Error('category must have at most 100 characters');
    }
  }

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get description(): string {
    return this.props.description;
  }

  get descriptionNormalized(): string {
    return this.props.descriptionNormalized;
  }

  get category(): string | null {
    return this.props.category;
  }

  get status(): CatalogAssetStatus {
    return this.props.status;
  }

  get metadata(): JsonRecord | null {
    return this.props.metadata;
  }

  get createdById(): number | null {
    return this.props.createdById;
  }

  get updatedById(): number | null {
    return this.props.updatedById;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  updateFields(fields: {
    description?: string;
    descriptionNormalized?: string;
    category?: string | null;
    metadata?: JsonRecord | null;
    updatedById: number | null;
  }): Record<string, { before: unknown; after: unknown }> {
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    this.applyChange(changes, 'description', fields.description, (value) => {
      if (value.trim().length === 0) {
        throw new Error('description is required');
      }
      this.props.description = value;
    });
    this.applyChange(
      changes,
      'description_normalized',
      fields.descriptionNormalized,
      (value) => {
        if (value.trim().length === 0) {
          throw new Error('description_normalized is required');
        }
        this.props.descriptionNormalized = value;
      },
    );
    this.applyChange(changes, 'category', fields.category, (value) => {
      this.props.category = value;
    });
    this.applyChange(changes, 'metadata', fields.metadata, (value) => {
      this.props.metadata = value;
    });

    if (Object.keys(changes).length > 0) {
      this.props.updatedById = fields.updatedById;
    }

    return changes;
  }

  deactivate(
    actorId: number | null,
    now = new Date(),
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status === CatalogAssetStatus.INACTIVE) {
      throw new Error('Catalog asset is already inactive');
    }
    const beforeStatus = this.props.status;
    const beforeDeletedAt = this.props.deletedAt;
    this.props.status = CatalogAssetStatus.INACTIVE;
    this.props.deletedAt = now;
    this.props.updatedById = actorId;
    return {
      status: { before: beforeStatus, after: this.props.status },
      deleted_at: { before: beforeDeletedAt, after: now.toISOString() },
    };
  }

  reactivate(
    actorId: number | null,
  ): Record<string, { before: unknown; after: unknown }> {
    if (this.props.status !== CatalogAssetStatus.INACTIVE) {
      throw new Error('Only inactive catalog assets can be reactivated');
    }
    const beforeStatus = this.props.status;
    const beforeDeletedAt = this.props.deletedAt;
    this.props.status = CatalogAssetStatus.ACTIVE;
    this.props.deletedAt = null;
    this.props.updatedById = actorId;
    return {
      status: { before: beforeStatus, after: this.props.status },
      deleted_at: {
        before: beforeDeletedAt?.toISOString() ?? null,
        after: null,
      },
    };
  }

  toProps(): CatalogAssetProps {
    return { ...this.props };
  }

  private applyChange<T>(
    changes: Record<string, { before: unknown; after: unknown }>,
    key: string,
    value: T | undefined,
    apply: (value: T) => void,
  ): void {
    if (value === undefined) {
      return;
    }
    const current = this.props[this.toPropKey(key)];
    if (JSON.stringify(current) === JSON.stringify(value)) {
      return;
    }
    changes[key] = { before: current, after: value };
    apply(value);
  }

  private toPropKey(key: string): keyof CatalogAssetProps {
    const map: Record<string, keyof CatalogAssetProps> = {
      description: 'description',
      description_normalized: 'descriptionNormalized',
      category: 'category',
      metadata: 'metadata',
    };
    return map[key] ?? 'description';
  }
}
