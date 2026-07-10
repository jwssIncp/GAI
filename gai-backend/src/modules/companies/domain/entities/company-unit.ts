import { CompanyUnitStatus } from '../enums/company-unit-status.enum';

export interface CompanyUnitProps {
  id: number;
  organizationId: number;
  companyId: number;
  name: string;
  code: string | null;
  status: CompanyUnitStatus;
}

export class CompanyUnit {
  constructor(private readonly props: CompanyUnitProps) {
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

  get companyId(): number {
    return this.props.companyId;
  }

  get status(): CompanyUnitStatus {
    return this.props.status;
  }

  canBeAssigned(): boolean {
    return this.props.status === CompanyUnitStatus.ACTIVE;
  }
}
