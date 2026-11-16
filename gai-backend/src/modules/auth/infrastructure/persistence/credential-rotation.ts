import { EntityManager, IsNull } from 'typeorm';
import { UserEntity } from './user.entity';
import { SessionEntity } from './session.entity';
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { UserStatus } from '../../domain/enums/user.enums';

/** Caller must hold the user row lock and validate/hash the new password. */
export async function rotateCredential(
  manager: EntityManager,
  user: UserEntity,
  hash: string,
  mustChange: boolean,
  /** null: senha temporária sem expiração (inventariante, conforme configuração). */
  temporaryTtlHours: number | null,
): Promise<void> {
  const now = new Date();
  user.passwordHash = hash;
  user.passwordChangedAt = now;
  user.authVersion++;
  user.mustChangePassword = mustChange;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.temporaryPasswordExpiresAt =
    mustChange && temporaryTtlHours !== null
      ? new Date(now.getTime() + temporaryTtlHours * 3600000)
      : null;
  if (user.status === UserStatus.LOCKED) user.status = UserStatus.ACTIVE;
  await manager.getRepository(UserEntity).save(user);
  await manager
    .getRepository(SessionEntity)
    .update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: now });
  await manager
    .getRepository(PasswordResetTokenEntity)
    .update({ userId: user.id, usedAt: IsNull() }, { usedAt: now });
}
