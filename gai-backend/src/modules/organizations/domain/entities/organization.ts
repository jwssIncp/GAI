import { OrganizationStatus } from '../enums/organization-status.enum';
import { Cnpj } from '../value-objects/cnpj';

export interface OrganizationProps {
  id: number;
  legalName: string;
  tradeName: string | null;
  cnpj: Cnpj;
  contactEmail: string | null;
  contactPhone: string | null;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Organization {
  constructor(private readonly props: OrganizationProps) {}

  get id(): number {
    return this.props.id;
  }

  get legalName(): string {
    return this.props.legalName;
  }

  get tradeName(): string | null {
    return this.props.tradeName;
  }

  get cnpj(): Cnpj {
    return this.props.cnpj;
  }

  get contactEmail(): string | null {
    return this.props.contactEmail;
  }

  get contactPhone(): string | null {
    return this.props.contactPhone;
  }

  get status(): OrganizationStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === OrganizationStatus.ACTIVE;
  }

  deactivate(): void {
    if (this.props.status === OrganizationStatus.INACTIVE) {
      throw new Error('Organization is already inactive');
    }
    this.props.status = OrganizationStatus.INACTIVE;
  }

  activate(): void {
    if (this.props.status === OrganizationStatus.ACTIVE) {
      throw new Error('Organization is already active');
    }
    this.props.status = OrganizationStatus.ACTIVE;
  }

  updateFields(fields: {
    legalName?: string;
    tradeName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  }): Record<string, { before: unknown; after: unknown }> {
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    if (
      fields.legalName !== undefined &&
      fields.legalName !== this.props.legalName
    ) {
      changes.legal_name = {
        before: this.props.legalName,
        after: fields.legalName,
      };
      this.props.legalName = fields.legalName;
    }
    if (
      fields.tradeName !== undefined &&
      fields.tradeName !== this.props.tradeName
    ) {
      changes.trade_name = {
        before: this.props.tradeName,
        after: fields.tradeName,
      };
      this.props.tradeName = fields.tradeName;
    }
    if (
      fields.contactEmail !== undefined &&
      fields.contactEmail !== this.props.contactEmail
    ) {
      changes.contact_email = {
        before: this.props.contactEmail,
        after: fields.contactEmail,
      };
      this.props.contactEmail = fields.contactEmail;
    }
    if (
      fields.contactPhone !== undefined &&
      fields.contactPhone !== this.props.contactPhone
    ) {
      changes.contact_phone = {
        before: this.props.contactPhone,
        after: fields.contactPhone,
      };
      this.props.contactPhone = fields.contactPhone;
    }

    return changes;
  }

  toProps(): OrganizationProps {
    return { ...this.props, cnpj: this.props.cnpj };
  }
}
