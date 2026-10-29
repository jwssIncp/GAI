import { UserRole } from '../../domain/enums/user.enums';
import { PermissionResolver } from '../../domain/ports/permission-resolver.port';
import { PermissionScope } from '../../../users/domain/enums/permission-scope.enum';

export interface PermissionActor {
  systemRoles: UserRole[];
  permissions?: ReadonlyArray<{ key: string; scope: PermissionScope }>;
}

// Check the live catalog before every administrative bypass. A partial or
// unsynchronized catalog cannot accidentally authorize a new route/domain.
export async function hasAllPermissions(
  actor: PermissionActor,
  keys: string[],
  resolver: PermissionResolver,
): Promise<boolean> {
  const scopes = await resolver.findScopesByKeys(keys);
  if (
    keys.some(
      (key) => !Object.values(PermissionScope).includes(scopes.get(key)!),
    )
  )
    return false;
  if (actor.systemRoles.includes(UserRole.PLATFORM_ADMIN)) return true;
  if (
    actor.systemRoles.includes(UserRole.ORG_ADMIN) &&
    keys.every((key) => scopes.get(key) === PermissionScope.ORGANIZATION)
  )
    return true;
  return keys.every((key) =>
    actor.permissions?.some(
      (permission) =>
        permission.key === key && permission.scope === scopes.get(key),
    ),
  );
}
