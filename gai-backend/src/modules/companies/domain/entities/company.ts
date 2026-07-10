import { CompanyStatus } from '../enums/company-status.enum';

export type JsonRecord = Record<string, unknown>;

export interface CompanyProps {
  id: number;
  organizationId: number;
  name: string;
  corporateName: string | null;
  document: string | null;
  status: CompanyStatus;
  metadata: JsonRecord | null;
  deletedAt: Date | null;
}

export class Company {
  constructor(private readonly props: CompanyProps) {
    if (props.name.trim().length < 2) {
      throw new Error('name must have at least 2 characters');
    }
  }

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get name(): string {
    return this.props.name;
  }

  get status(): CompanyStatus {
    return this.props.status;
  }

  canReceiveProject(): boolean {
    return this.props.status === CompanyStatus.ACTIVE;
  }
}
