import { PermissionScope } from '../enums/permission-scope.enum';

export interface PermissionRef {
  id: number;
  key: string;
  resource: string;
  action: string;
  scope: PermissionScope;
  description: string;
}

export interface OrgRoleProps {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: PermissionRef[];
  createdAt: Date;
  updatedAt: Date;
}

export class OrgRole {
  constructor(private props: OrgRoleProps) {}

  get id(): number {
    return this.props.id;
  }

  get organizationId(): number {
    return this.props.organizationId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get permissions(): PermissionRef[] {
    return [...this.props.permissions];
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  deactivate(now = new Date()): void {
    this.props.isActive = false;
    this.props.updatedAt = now;
  }

  update(
    data: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      permissions?: PermissionRef[];
    },
    now = new Date(),
  ): void {
    if (data.name !== undefined) {
      this.props.name = data.name;
    }
    if (data.description !== undefined) {
      this.props.description = data.description;
    }
    if (data.isActive !== undefined) {
      this.props.isActive = data.isActive;
    }
    if (data.permissions !== undefined) {
      this.props.permissions = data.permissions;
    }
    this.props.updatedAt = now;
  }

  toProps(): OrgRoleProps {
    return {
      ...this.props,
      permissions: [...this.props.permissions],
    };
  }
}
