import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import { PermissionScope } from '../../../../src/modules/users/domain/enums/permission-scope.enum';
import { PermissionsGuard } from '../../../../src/modules/auth/presentation/guards/permissions.guard';
import type { PermissionResolver } from '../../../../src/modules/auth/domain/ports/permission-resolver.port';
import { readdirSync } from 'fs';
import { join } from 'path';
import { PERMISSION_SEEDS } from '../../../../src/scripts/seed/permissions.seed';
import { PERMISSIONS_KEY } from '../../../../src/modules/auth/presentation/decorators/require-permissions.decorator';

// Characterization of current policy. Passing reproduction tests do not mean
// that the permissive behavior has been approved as the desired policy.
describe('PermissionsGuard negative validation', () => {
  it('all permissions currently required by controllers are registered in the seed catalog', () => {
    const root = join(process.cwd(), 'src');
    const catalog = new Set(
      PERMISSION_SEEDS.map((permission) => permission.key),
    );
    const unknown: string[] = [];
    for (const path of readdirSync(root, { recursive: true }) as string[]) {
      if (!path.endsWith('.controller.ts')) continue;
      // Read evaluated decorator metadata, including computed lifecycle keys.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const exports = require(join(root, path)) as Record<string, unknown>;
      for (const controller of Object.values(exports)) {
        if (typeof controller !== 'function' || !controller.prototype) continue;
        const prototype = controller.prototype as Record<string, unknown>;
        const handlers: object[] = [controller];
        for (const name of Object.getOwnPropertyNames(prototype)) {
          const handler = prototype[name];
          if (typeof handler === 'function') handlers.push(handler);
        }
        for (const handler of handlers) {
          const keys = Reflect.getMetadata(PERMISSIONS_KEY, handler) as
            | string[]
            | undefined;
          for (const key of keys ?? []) {
            if (!catalog.has(key)) unknown.push(`${path}: ${key}`);
          }
        }
      }
    }
    expect(unknown).toEqual([]);
  });
  function check(
    role: UserRole,
    keys: string[],
    scopes: Map<string, PermissionScope>,
    grants: string[] = [],
  ) {
    const reflector = { getAllAndOverride: () => keys } as unknown as Reflector;
    const resolver: PermissionResolver = {
      resolveForUser: jest.fn(),
      findScopesByKeys: jest.fn().mockResolvedValue(scopes),
    };
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            systemRoles: [role],
            permissions: grants.map((key) => ({
              key,
              scope: scopes.get(key) ?? PermissionScope.ORGANIZATION,
            })),
          },
        }),
      }),
    } as unknown as ExecutionContext;
    return new PermissionsGuard(reflector, resolver).canActivate(context);
  }

  it('ORG_ADMIN rejects an unregistered permission', async () => {
    await expect(
      check(UserRole.ORG_ADMIN, ['unregistered:write'], new Map()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('mixing registered organization and unknown keys rejects ORG_ADMIN', async () => {
    await expect(
      check(
        UserRole.ORG_ADMIN,
        ['projects:read', 'unregistered:write'],
        new Map([['projects:read', PermissionScope.ORGANIZATION]]),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('denies an unregistered key to ORG_USER without that permission', async () => {
    await expect(
      check(UserRole.ORG_USER, ['unregistered:write'], new Map()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('denies a registered platform key to ORG_ADMIN', async () => {
    await expect(
      check(
        UserRole.ORG_ADMIN,
        ['organizations:create'],
        new Map([['organizations:create', PermissionScope.PLATFORM]]),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('PLATFORM_ADMIN rejects an unregistered key', async () => {
    await expect(
      check(UserRole.PLATFORM_ADMIN, ['unregistered:write'], new Map()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each([UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN, UserRole.ORG_USER])(
    'rejects an incomplete catalog for %s',
    async (role) => {
      await expect(
        check(
          role,
          ['projects:read', 'expenses:read'],
          new Map([['projects:read', PermissionScope.ORGANIZATION]]),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
  it('preserves valid organization and platform administrative grants', async () => {
    await expect(
      check(
        UserRole.ORG_ADMIN,
        ['projects:read'],
        new Map([['projects:read', PermissionScope.ORGANIZATION]]),
      ),
    ).resolves.toBe(true);
    await expect(
      check(
        UserRole.PLATFORM_ADMIN,
        ['organizations:create'],
        new Map([['organizations:create', PermissionScope.PLATFORM]]),
      ),
    ).resolves.toBe(true);
  });
  it('a stale granted key cannot bypass a missing catalog entry', async () => {
    await expect(
      check(UserRole.ORG_USER, ['projects:read'], new Map(), ['projects:read']),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      check(
        UserRole.ORG_USER,
        ['projects:read'],
        new Map([['projects:read', PermissionScope.ORGANIZATION]]),
        ['projects:read'],
      ),
    ).resolves.toBe(true);
  });
});
