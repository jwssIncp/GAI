import { ConflictException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { EntityManager, In, IsNull } from 'typeorm';
import { UserRole, UserStatus } from '../../../auth/domain/enums/user.enums';
import { Password } from '../../../auth/domain/value-objects/password';
import { MobileRefreshTokenEntity } from '../../../auth/infrastructure/persistence/mobile-refresh-token.entity';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { PermissionScope } from '../../../users/domain/enums/permission-scope.enum';
import { RoleType } from '../../../users/domain/enums/role-type.enum';
import { PermissionEntity } from '../../../users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../../../users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../users/infrastructure/persistence/role-permission.entity';
import { UserRoleAssignmentEntity } from '../../../users/infrastructure/persistence/user-role-assignment.entity';
import { FIELD_ACCESS_PERMISSIONS } from '../../domain/field-access-permissions';

/**
 * Situação do acesso do inventariante, sem dado sensível:
 * - NONE: sem conta;
 * - INVITATION_PENDING: convite enviado e ainda não aceito;
 * - AWAITING_FIRST_ACCESS: senha temporária emitida; troca obrigatória pendente;
 * - ACTIVE: conta com senha própria;
 * - REVOKED: acesso revogado (ou conta inativa/bloqueada na gestão de usuários).
 */
export type FieldAgentAccessStatus =
  | 'NONE'
  | 'INVITATION_PENDING'
  | 'AWAITING_FIRST_ACCESS'
  | 'ACTIVE'
  | 'REVOKED';

export interface FieldAgentAccess {
  status: FieldAgentAccessStatus;
  /** Data de emissão da senha temporária (só em AWAITING_FIRST_ACCESS). */
  temporary_password_issued_at: string | null;
}

type AccessUser = Pick<
  UserEntity,
  'status' | 'mustChangePassword' | 'passwordChangedAt'
>;

export function fieldAgentAccess(user: AccessUser | null): FieldAgentAccess {
  const status: FieldAgentAccessStatus = !user
    ? 'NONE'
    : user.status === UserStatus.PENDING_ACTIVATION
      ? 'INVITATION_PENDING'
      : user.status === UserStatus.INACTIVE ||
          user.status === UserStatus.BLOCKED
        ? 'REVOKED'
        : user.mustChangePassword
          ? 'AWAITING_FIRST_ACCESS'
          : 'ACTIVE';
  return {
    status,
    temporary_password_issued_at:
      status === 'AWAITING_FIRST_ACCESS' && user
        ? new Date(user.passwordChangedAt).toISOString()
        : null,
  };
}

/** Situação do acesso por conta, numa só consulta (lista de inventariantes). */
export async function loadFieldAgentAccess(
  manager: EntityManager,
  userIds: Array<number | null>,
): Promise<Map<number, FieldAgentAccess>> {
  const ids = [...new Set(userIds.filter((id): id is number => !!id))];
  const users = ids.length
    ? await manager.getRepository(UserEntity).find({
        select: ['id', 'status', 'mustChangePassword', 'passwordChangedAt'],
        where: { id: In(ids) },
      })
    : [];
  return new Map(users.map((u) => [Number(u.id), fieldAgentAccess(u)]));
}

/** Alfabeto sem caracteres ambíguos (0/O, 1/l/I). */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const ALPHABET = UPPER + LOWER + DIGITS;

/**
 * Senha temporária forte, gerada com crypto.randomInt. Sempre tem maiúscula,
 * minúscula e dígito, e cumpre a política de Password.
 */
export function generateTemporaryPassword(length: number): string {
  const size = Math.min(
    Password.MAX_LENGTH,
    Math.max(Password.MIN_LENGTH, Math.trunc(length) || 0),
  );
  for (;;) {
    let value = '';
    for (let i = 0; i < size; i++)
      value += ALPHABET[randomInt(ALPHABET.length)];
    if (
      [UPPER, LOWER, DIGITS].every((set) =>
        [...value].some((c) => set.includes(c)),
      )
    )
      return Password.create(value).getValue();
  }
}

export function fieldRoleKey(organizationId: number): string {
  return `FIELD_AGENT_ORG_${organizationId}`;
}

/**
 * Perfil de campo da organização, com as permissões mínimas. Cria na primeira
 * vez; recusa perfil inativo ou com permissão fora do conjunto mínimo.
 */
export async function ensureFieldRole(
  manager: EntityManager,
  organizationId: number,
): Promise<RoleEntity> {
  const key = fieldRoleKey(organizationId);
  let role = await manager
    .getRepository(RoleEntity)
    .findOneBy({ key, organizationId });
  if (!role) {
    role = await manager.getRepository(RoleEntity).save({
      key,
      organizationId,
      type: RoleType.ORGANIZATION,
      name: 'Inventariante de campo',
      description: 'Coleta somente nos projetos com vínculo ativo e vigente.',
      isActive: true,
    });
    const permissions = (
      await manager.getRepository(PermissionEntity).find()
    ).filter(
      (p) =>
        FIELD_ACCESS_PERMISSIONS.includes(p.key) &&
        p.scope === PermissionScope.ORGANIZATION,
    );
    if (permissions.length !== FIELD_ACCESS_PERMISSIONS.length)
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'O catálogo de permissões de campo está incompleto. Revise a configuração antes de criar o acesso.',
      });
    for (const permission of permissions)
      await manager
        .getRepository(RolePermissionEntity)
        .save({ roleId: role.id, permissionId: permission.id });
  }
  if (!role.isActive)
    throw new ConflictException({
      code: 'CONFLICT',
      message:
        'O perfil de campo está inativo. Revise os perfis antes de criar o acesso.',
    });
  const grants = await manager
    .getRepository(PermissionEntity)
    .createQueryBuilder('permission')
    .innerJoin(
      RolePermissionEntity,
      'grant',
      'grant.permissionId=permission.id',
    )
    .where('grant.roleId = :id', { id: role.id })
    .getMany();
  // Roles created before Onda 0 hold a smaller subset; they stay valid (no
  // automatic upgrade). Anything outside the least-privilege set is refused.
  if (
    grants.length === 0 ||
    grants.some(
      (p) =>
        !FIELD_ACCESS_PERMISSIONS.includes(p.key) ||
        p.scope !== PermissionScope.ORGANIZATION,
    )
  )
    throw new ConflictException({
      code: 'CONFLICT',
      message:
        'O perfil de campo foi alterado. Revise suas permissões mínimas antes de criar novos acessos.',
    });
  return role;
}

/**
 * A senha temporária só é emitida/revogada por aqui em conta exclusiva de
 * inventariante: perfis ativos = ORG_USER + perfil de campo da organização.
 * Conta administrativa associada ao inventariante segue pela gestão de usuários.
 */
export async function assertFieldOnlyAccount(
  manager: EntityManager,
  userId: number,
  organizationId: number,
): Promise<void> {
  const links = await manager
    .getRepository(UserRoleAssignmentEntity)
    .findBy({ userId, isActive: true, revokedAt: IsNull() });
  const roles = links.length
    ? await manager
        .getRepository(RoleEntity)
        .findBy({ id: In(links.map((l) => l.roleId)) })
    : [];
  const fieldKey = fieldRoleKey(organizationId);
  const isField = (r: RoleEntity) =>
    r.key === fieldKey && Number(r.organizationId) === organizationId;
  const isOrgUser = (r: RoleEntity) =>
    r.key === (UserRole.ORG_USER as string) && r.type === RoleType.SYSTEM;
  if (
    links.length !== roles.length ||
    !roles.some(isField) ||
    roles.some((r) => !isField(r) && !isOrgUser(r))
  )
    throw new ConflictException({
      code: 'NOT_FIELD_AGENT_ACCOUNT',
      message:
        'A conta associada não é exclusiva de inventariante. Gerencie a senha dela em Usuários.',
    });
}

/** Encerra os refresh tokens do app (as sessões saem por rotateCredential). */
export async function revokeMobileRefreshTokens(
  manager: EntityManager,
  userId: number,
  now: Date,
  reason: string,
): Promise<void> {
  await manager
    .getRepository(MobileRefreshTokenEntity)
    .update(
      { userId, revokedAt: IsNull() },
      { revokedAt: now, revokedReason: reason },
    );
}
