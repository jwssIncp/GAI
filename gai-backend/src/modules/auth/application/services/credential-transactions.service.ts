import { rotateCredential } from '../../infrastructure/persistence/credential-rotation';
import { identityTransaction } from '../../infrastructure/persistence/identity-transaction';
import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { UserEntity } from '../../infrastructure/persistence/user.entity';
import { SessionEntity } from '../../infrastructure/persistence/session.entity';
import { PasswordResetTokenEntity } from '../../infrastructure/persistence/password-reset-token.entity';
import { AuthAuditLogEntity } from '../../infrastructure/persistence/auth-audit-log.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { UserRoleAssignmentEntity } from '../../../users/infrastructure/persistence/user-role-assignment.entity';
import { RoleEntity } from '../../../users/infrastructure/persistence/role.entity';
import { isRoleCompatibleWithUserOrganization } from '../../../users/domain/services/role-assignment-scope';
import { UserStatus } from '../../domain/enums/user.enums';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../domain/ports/password-hasher.port';
import {
  EMAIL_SENDER,
  type EmailSender,
} from '../../domain/ports/email-sender.port';
import { Password } from '../../domain/value-objects/password';
import {
  AuthAuditOperation,
  AuthAuditResult,
} from '../../domain/enums/auth-audit.enums';

export async function lockUser(
  manager: EntityManager,
  id: number,
): Promise<UserEntity | null> {
  const query = manager
    .getRepository(UserEntity)
    .createQueryBuilder('u')
    .where('u.id = :id', { id });
  if (manager.connection.options.type !== 'sqlite')
    query.setLock('pessimistic_write');
  return query.getOne();
}

@Injectable()
export class CredentialTransactionsService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async assertEligible(
    manager: EntityManager,
    user: UserEntity,
    requireRole = false,
  ): Promise<void> {
    if (
      user.organizationId !== null &&
      !(await manager
        .getRepository(OrganizationEntity)
        .existsBy({ id: user.organizationId, status: 'ACTIVE' as never }))
    )
      throw this.invalid();
    if (requireRole) {
      const links = await manager
        .getRepository(UserRoleAssignmentEntity)
        .findBy({ userId: user.id, isActive: true, revokedAt: IsNull() });
      let eligible = false;
      for (const link of links) {
        const role = await manager
          .getRepository(RoleEntity)
          .findOneBy({ id: link.roleId, isActive: true });
        if (
          role &&
          isRoleCompatibleWithUserOrganization(role, user.organizationId)
        )
          eligible = true;
      }
      if (!eligible) throw this.invalid();
    }
  }

  async authenticate(
    identifier: string,
    password: string,
    ipAddress: string | null,
  ) {
    const normalized = identifier.trim().toLowerCase();
    const outcome = await identityTransaction(this.db, async (manager) => {
      const users = manager.getRepository(UserEntity);
      const found = await users.findOneBy(
        normalized.includes('@')
          ? { email: normalized }
          : { login: normalized },
      );
      const user = found ? await lockUser(manager, found.id) : null;
      const now = new Date();
      const fail = async (status = 401, reason = 'invalid_credentials') => {
        await manager.getRepository(AuthAuditLogEntity).save({
          userId: user?.id ?? null,
          operation: AuthAuditOperation.LOGIN_FAILED,
          ipAddress,
          result: AuthAuditResult.FAILURE,
          metadata: { reason },
        });
        return { failure: status } as const;
      };
      if (!user) return fail();
      if (![UserStatus.ACTIVE, UserStatus.LOCKED].includes(user.status))
        return fail();
      if (
        user.mustChangePassword &&
        user.temporaryPasswordExpiresAt &&
        user.temporaryPasswordExpiresAt <= now
      )
        return fail();
      try {
        await this.assertEligible(manager, user);
      } catch (error) {
        if (error instanceof UnauthorizedException) return fail();
        throw error;
      }
      if (user.lockedUntil && user.lockedUntil > now)
        return fail(423, 'locked');
      if (user.status === UserStatus.LOCKED) {
        if (!user.lockedUntil || user.lockedUntil > now)
          return fail(423, 'locked');
        user.status = UserStatus.ACTIVE;
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
      }
      if (!(await this.hasher.verify(password, user.passwordHash))) {
        user.failedLoginAttempts++;
        const maximum = this.config.get<number>('auth.lockoutMaxAttempts', 5);
        if (user.failedLoginAttempts >= maximum) {
          user.status = UserStatus.LOCKED;
          user.lockedUntil = new Date(
            now.getTime() +
              this.config.get<number>('auth.lockoutDurationMinutes', 30) *
                60000,
          );
        }
        await users.save(user);
        return fail(user.status === UserStatus.LOCKED ? 423 : 401);
      }
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      user.lastLoginAt = now;
      await users.save(user);
      const expiresAt = new Date(
        now.getTime() +
          this.config.get<number>('auth.sessionTtlHours', 8) * 3600000,
      );
      const session = await manager.getRepository(SessionEntity).save({
        id: randomUUID(),
        userId: user.id,
        organizationId: user.organizationId,
        authVersion: user.authVersion,
        createdAt: now,
        lastActivityAt: now,
        expiresAt,
        revokedAt: null,
      });
      await manager.getRepository(AuthAuditLogEntity).save({
        userId: user.id,
        operation: AuthAuditOperation.LOGIN,
        ipAddress,
        result: AuthAuditResult.SUCCESS,
      });
      return { user, session } as const;
    });
    if ('failure' in outcome)
      throw new HttpException(
        {
          code: outcome.failure === 423 ? 'ACCOUNT_LOCKED' : 'UNAUTHORIZED',
          message:
            outcome.failure === 423
              ? 'Conta temporariamente bloqueada. Aguarde o prazo de liberação.'
              : 'Credenciais inválidas ou conta indisponível.',
        },
        outcome.failure,
      );
    return outcome;
  }

  async replacePassword(
    manager: EntityManager,
    user: UserEntity,
    hash: string,
    mustChange = false,
  ): Promise<void> {
    await rotateCredential(
      manager,
      user,
      hash,
      mustChange,
      this.config.get<number>('auth.temporaryPasswordTtlHours', 24),
    );
  }

  async changeOwnPassword(
    userId: number,
    sessionId: string,
    current: string,
    next: string,
  ) {
    const hash = await this.hasher.hash(Password.create(next).getValue());
    await identityTransaction(this.db, async (manager) => {
      const user = await lockUser(manager, userId);
      const session = await manager
        .getRepository(SessionEntity)
        .findOneBy({ id: sessionId, revokedAt: IsNull() });
      if (
        !user ||
        !session ||
        session.authVersion !== user.authVersion ||
        session.expiresAt <= new Date() ||
        (user.mustChangePassword &&
          user.temporaryPasswordExpiresAt !== null &&
          user.temporaryPasswordExpiresAt <= new Date())
      )
        throw this.invalid();
      if (!(await this.hasher.verify(current, user.passwordHash)))
        throw this.invalid();
      if (await this.hasher.verify(next, user.passwordHash))
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Escolha uma senha diferente da atual.',
        });
      await this.replacePassword(manager, user, hash);
      await manager.getRepository(AuthAuditLogEntity).save({
        userId,
        operation: AuthAuditOperation.PASSWORD_CHANGE,
        result: AuthAuditResult.SUCCESS,
      });
    });
    return { message: 'Senha alterada. Entre novamente para continuar.' };
  }

  async issueToken(
    manager: EntityManager,
    user: UserEntity,
    purpose: 'INVITATION' | 'PASSWORD_RESET',
  ) {
    const raw = randomBytes(32).toString('hex');
    const now = new Date();
    await manager
      .getRepository(PasswordResetTokenEntity)
      .update({ userId: user.id, usedAt: IsNull() }, { usedAt: now });
    await manager.getRepository(PasswordResetTokenEntity).save({
      userId: user.id,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      purpose,
      expiresAt: new Date(
        now.getTime() +
          this.config.get<number>(
            purpose === 'INVITATION'
              ? 'auth.invitationTtlHours'
              : 'auth.passwordResetTtlHours',
            purpose === 'INVITATION' ? 48 : 1,
          ) *
            3600000,
      ),
      usedAt: null,
    });
    return raw;
  }

  async consumeToken(
    raw: string,
    password: string,
    purpose: 'INVITATION' | 'PASSWORD_RESET',
    ipAddress: string | null,
  ) {
    const hash = await this.hasher.hash(Password.create(password).getValue());
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const candidate = await this.db
      .getRepository(PasswordResetTokenEntity)
      .findOneBy({ tokenHash, purpose });
    if (!candidate) throw this.invalid();
    await identityTransaction(this.db, async (manager) => {
      const user = await lockUser(manager, candidate.userId);
      const token = await manager
        .getRepository(PasswordResetTokenEntity)
        .findOneBy({ id: candidate.id, tokenHash, purpose, usedAt: IsNull() });
      if (!user || !token || token.expiresAt <= new Date())
        throw this.invalid();
      if (
        purpose === 'INVITATION'
          ? user.status !== UserStatus.PENDING_ACTIVATION
          : ![UserStatus.ACTIVE, UserStatus.LOCKED].includes(user.status)
      )
        throw this.invalid();
      await this.assertEligible(manager, user, purpose === 'INVITATION');
      if (purpose === 'INVITATION') user.status = UserStatus.ACTIVE;
      await this.replacePassword(manager, user, hash);
      await manager.getRepository(AuthAuditLogEntity).save({
        userId: user.id,
        operation:
          purpose === 'INVITATION'
            ? AuthAuditOperation.INVITATION_ACTIVATED
            : AuthAuditOperation.PASSWORD_RESET_CONFIRM,
        ipAddress,
        result: AuthAuditResult.SUCCESS,
      });
    });
    return {
      message:
        purpose === 'INVITATION'
          ? 'Conta ativada. Entre com sua senha.'
          : 'Senha redefinida. Entre novamente.',
    };
  }

  async requestReset(email: string, ipAddress: string | null) {
    const delivery = await identityTransaction(this.db, async (manager) => {
      const found = await manager
        .getRepository(UserEntity)
        .findOneBy({ email: email.trim().toLowerCase() });
      const user = found ? await lockUser(manager, found.id) : null;
      if (
        !user ||
        ![UserStatus.ACTIVE, UserStatus.LOCKED].includes(user.status)
      )
        return null;
      try {
        await this.assertEligible(manager, user);
      } catch (error) {
        if (error instanceof UnauthorizedException) return null;
        throw error;
      }
      const token = await this.issueToken(manager, user, 'PASSWORD_RESET');
      await manager.getRepository(AuthAuditLogEntity).save({
        userId: user.id,
        operation: AuthAuditOperation.PASSWORD_RESET_REQUEST,
        ipAddress,
        result: AuthAuditResult.SUCCESS,
      });
      return { to: user.email, resetToken: token };
    });
    // Do not expose account existence through delivery errors.
    if (delivery) {
      try {
        await this.email.sendPasswordResetEmail(delivery);
      } catch {
        /* generic public response */
      }
    }
    return {
      message:
        'Se o e-mail estiver cadastrado e elegível, você receberá as instruções.',
    };
  }

  async sendInvitation(to: string, token: string): Promise<void> {
    if (!this.email.sendInvitationEmail)
      throw new Error('Invitation sender is not configured');
    const base = this.config.get<string>(
      'auth.frontendUrl',
      'http://localhost:5173',
    );
    await this.email.sendInvitationEmail({
      to,
      activationUrl: `${base}/activate-account#token=${encodeURIComponent(token)}`,
    });
  }

  private invalid() {
    return new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'Credenciais ou token inválidos, expirados ou indisponíveis.',
    });
  }
}
