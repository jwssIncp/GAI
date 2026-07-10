import { UserStatus } from '../enums/user.enums';

export interface UserProps {
  id: number;
  organizationId: number | null;
  login: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  constructor(private props: UserProps) {}

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

  get failedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }

  get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  get passwordChangedAt(): Date {
    return this.props.passwordChangedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isLocked(now = new Date()): boolean {
    if (this.props.status === UserStatus.LOCKED) {
      return true;
    }
    return this.props.lockedUntil !== null && this.props.lockedUntil > now;
  }

  canLogin(now = new Date()): boolean {
    return this.props.status === UserStatus.ACTIVE && !this.isLocked(now);
  }

  recordFailedLogin(
    maxAttempts: number,
    lockoutMinutes: number,
    now = new Date(),
  ): void {
    this.props.failedLoginAttempts += 1;
    if (this.props.failedLoginAttempts >= maxAttempts) {
      this.props.status = UserStatus.LOCKED;
      this.props.lockedUntil = new Date(
        now.getTime() + lockoutMinutes * 60_000,
      );
    }
  }

  recordSuccessfulLogin(now = new Date()): void {
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
    if (this.props.status === UserStatus.LOCKED) {
      this.props.status = UserStatus.ACTIVE;
    }
    this.props.updatedAt = now;
  }

  updatePasswordHash(hash: string, now = new Date()): void {
    this.props.passwordHash = hash;
    this.props.passwordChangedAt = now;
    this.props.updatedAt = now;
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
    if (this.props.status === UserStatus.LOCKED) {
      this.props.status = UserStatus.ACTIVE;
    }
  }

  toProps(): UserProps {
    return { ...this.props };
  }
}
