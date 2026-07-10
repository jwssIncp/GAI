import { PermissionScope } from '../../../users/domain/enums/permission-scope.enum';

export interface ResolvedPermission {
  key: string;
  scope: PermissionScope;
}

export const PERMISSION_RESOLVER = Symbol('PERMISSION_RESOLVER');

export interface PermissionResolver {
  resolveForUser(userId: number): Promise<ResolvedPermission[]>;
  findScopesByKeys(keys: string[]): Promise<Map<string, PermissionScope>>;
}
