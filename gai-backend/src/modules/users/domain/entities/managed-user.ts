import { UserStatus } from '../../../auth/domain/enums/user.enums';

export interface ManagedUserProps {
  id: number;
  organizationId: number | null;
  login: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class ManagedUser {
  constructor(private props: ManagedUserProps) {}

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number | null {
    return this.props.organizationId;
  }

  get login(): string {
    return this.props.login;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  deactivate(now = new Date()): void {
    this.props.status = UserStatus.INACTIVE;
    this.props.updatedAt = now;
  }

  activate(now = new Date()): void {
    this.props.status = UserStatus.ACTIVE;
    this.props.updatedAt = now;
  }

  updateEmail(email: string, now = new Date()): void {
    this.props.email = email;
    this.props.updatedAt = now;
  }

  updateOrganizationId(organizationId: number | null, now = new Date()): void {
    this.props.organizationId = organizationId;
    this.props.updatedAt = now;
  }

  updatePasswordHash(hash: string, now = new Date()): void {
    this.props.passwordHash = hash;
    this.props.updatedAt = now;
  }

  toProps(): ManagedUserProps {
    return { ...this.props };
  }
}
