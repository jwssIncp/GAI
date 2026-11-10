import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { CredentialTransactionsService } from '../auth/application/services/credential-transactions.service';
import {
  AuthAuditOperation,
  AuthAuditResult,
} from '../auth/domain/enums/auth-audit.enums';
import { UserStatus } from '../auth/domain/enums/user.enums';
import { AuthAuditLogEntity } from '../auth/infrastructure/persistence/auth-audit-log.entity';
import { identityTransaction } from '../auth/infrastructure/persistence/identity-transaction';
import { MobileRefreshTokenEntity } from '../auth/infrastructure/persistence/mobile-refresh-token.entity';
import { SessionEntity } from '../auth/infrastructure/persistence/session.entity';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { resolveFieldAccess } from '../field-agents/application/services/field-access';
import { OrganizationStatus } from '../organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../organizations/infrastructure/persistence/organization.entity';
import { MobileLoginDto, MobileTokenResponseDto } from './dto/mobile-auth.dto';

type Denial =
  | 'invalid'
  | 'revoked'
  | 'reused'
  | 'expired'
  | 'locked'
  | 'session_revoked'
  | 'field_agent_ineligible';

const DENIALS: Record<Denial, [HttpStatus, string, string]> = {
  invalid: [401, 'INVALID_REFRESH_TOKEN', 'Sessão inválida. Faça login.'],
  revoked: [401, 'INVALID_REFRESH_TOKEN', 'Sessão inválida. Faça login.'],
  reused: [
    401,
    'REFRESH_TOKEN_REUSED',
    'Sessão encerrada por segurança. Faça login.',
  ],
  expired: [401, 'SESSION_EXPIRED', 'Sessão expirada. Faça login.'],
  locked: [
    423,
    'ACCOUNT_LOCKED',
    'Conta temporariamente bloqueada. Aguarde o prazo de liberação.',
  ],
  session_revoked: [
    401,
    'SESSION_REVOKED',
    'Acesso revogado. Faça login novamente.',
  ],
  field_agent_ineligible: [
    403,
    'MOBILE_ACCESS_DENIED',
    'Esta conta não possui acesso operacional ao aplicativo.',
  ],
};

interface IssueInput {
  familyId: string;
  familyExpiresAt: Date;
  userId: number;
  organizationId: number;
  authVersion: number;
  sessionId: string;
  deviceLabel: string | null;
  now: Date;
}

/**
 * Mobile sessions: opaque short-lived access sessions (validated by the shared
 * SessionAuthGuard) plus rotating refresh tokens stored only as SHA-256.
 * A login opens a family with an absolute lifetime; every refresh rotates the
 * token atomically and replaces the access session. Reuse of a rotated token
 * after the grace window revokes the whole family.
 */
@Injectable()
export class MobileSessionService {
  constructor(
    private readonly db: DataSource,
    private readonly credentials: CredentialTransactionsService,
    private readonly config: ConfigService,
  ) {}

  async login(
    dto: MobileLoginDto,
    ip: string | null,
  ): Promise<MobileTokenResponseDto> {
    const familyId = randomUUID();
    const ttl = this.ttl();
    let familyExpiresAt = new Date(0);
    const { user, session, extra } = await this.credentials.authenticate(
      dto.identifier,
      dto.password,
      ip,
      {
        session: {
          clientType: 'mobile',
          refreshFamilyId: familyId,
          expiresAt: (now) => {
            familyExpiresAt = new Date(now.getTime() + ttl.maxMs);
            return this.earliest(now.getTime() + ttl.accessMs, familyExpiresAt);
          },
        },
        auditOperation: AuthAuditOperation.MOBILE_LOGIN,
        onSession: async (manager, account, created) => {
          if (!(await this.isFieldEligible(manager, account)))
            throw new ForbiddenException({
              code: DENIALS.field_agent_ineligible[1],
              message: DENIALS.field_agent_ineligible[2],
            });
          return this.issue(manager, {
            familyId,
            familyExpiresAt,
            userId: account.id,
            organizationId: account.organizationId!,
            authVersion: account.authVersion,
            sessionId: created.id,
            deviceLabel: dto.device_label?.trim() || null,
            now: created.createdAt,
          });
        },
      },
    );
    return this.response(session, extra, {
      id: user.id,
      full_name: user.fullName ?? null,
      must_change_password: user.mustChangePassword,
    });
  }

  async refresh(
    token: string,
    ip: string | null,
  ): Promise<MobileTokenResponseDto> {
    const now = new Date();
    const ttl = this.ttl();
    const outcome = await identityTransaction(this.db, async (manager) => {
      const tokens = manager.getRepository(MobileRefreshTokenEntity);
      const row = await tokens.findOne({
        where: { tokenHash: this.hash(token) },
        ...this.lock(manager),
      });
      if (!row) return { denied: 'invalid' as Denial };
      const deny = async (denial: Denial, revokeReason?: string) => {
        if (revokeReason)
          await this.revokeFamily(manager, row.familyId, now, revokeReason);
        await this.audit(
          manager,
          row.userId,
          denial === 'reused'
            ? AuthAuditOperation.MOBILE_REFRESH_REUSE
            : AuthAuditOperation.MOBILE_REFRESH_DENIED,
          ip,
          AuthAuditResult.FAILURE,
          { reason: denial },
        );
        return { denied: denial };
      };
      if (row.revokedAt) return deny('revoked');
      if (row.rotatedAt) {
        // A concurrent/duplicated refresh just won the race: refuse without
        // punishing the family. Later replays are treated as token theft.
        if (now.getTime() - row.rotatedAt.getTime() <= ttl.graceMs)
          return { conflict: true as const };
        return deny('reused', 'reuse_detected');
      }
      if (row.expiresAt <= now) return deny('expired', 'expired');

      const user = await manager
        .getRepository(UserEntity)
        .findOneBy({ id: row.userId });
      if (user?.lockedUntil && user.lockedUntil > now) return deny('locked');
      const organization = user?.organizationId
        ? await manager
            .getRepository(OrganizationEntity)
            .findOneBy({ id: user.organizationId })
        : null;
      const previous = await manager
        .getRepository(SessionEntity)
        .findOneBy({ id: row.sessionId });
      if (
        !user ||
        ![UserStatus.ACTIVE, UserStatus.LOCKED].includes(user.status) ||
        (user.authVersion ?? 0) !== row.authVersion ||
        user.organizationId !== row.organizationId ||
        organization?.status !== OrganizationStatus.ACTIVE ||
        (user.mustChangePassword &&
          user.temporaryPasswordExpiresAt &&
          user.temporaryPasswordExpiresAt <= now) ||
        !previous ||
        previous.revokedAt
      )
        return deny('session_revoked', 'access_revoked');
      if (!(await this.isFieldEligible(manager, user)))
        return deny('field_agent_ineligible', 'field_agent_ineligible');

      // Atomic compare-and-set: exactly one request may rotate this token.
      const rotated = await tokens.update(
        { id: row.id, rotatedAt: IsNull(), revokedAt: IsNull() },
        { rotatedAt: now },
      );
      if (rotated.affected !== 1) return { conflict: true as const };
      await manager
        .getRepository(SessionEntity)
        .update({ id: row.sessionId, revokedAt: IsNull() }, { revokedAt: now });
      const session = await manager.getRepository(SessionEntity).save({
        id: randomUUID(),
        userId: row.userId,
        organizationId: row.organizationId,
        authVersion: row.authVersion,
        createdAt: now,
        lastActivityAt: now,
        expiresAt: this.earliest(
          now.getTime() + ttl.accessMs,
          row.familyExpiresAt,
        ),
        revokedAt: null,
        clientType: 'mobile' as const,
        refreshFamilyId: row.familyId,
      });
      const issued = await this.issue(manager, {
        familyId: row.familyId,
        familyExpiresAt: row.familyExpiresAt,
        userId: row.userId,
        organizationId: row.organizationId,
        authVersion: row.authVersion,
        sessionId: session.id,
        deviceLabel: row.deviceLabel,
        now,
      });
      await tokens.update({ id: row.id }, { replacedById: issued.id });
      await this.audit(
        manager,
        row.userId,
        AuthAuditOperation.MOBILE_REFRESH,
        ip,
        AuthAuditResult.SUCCESS,
        null,
      );
      return {
        ok: this.response(session, issued, {
          id: user.id,
          full_name: user.fullName ?? null,
          must_change_password: user.mustChangePassword,
        }),
      };
    });
    if ('ok' in outcome && outcome.ok) return outcome.ok;
    if ('conflict' in outcome && outcome.conflict)
      throw new HttpException(
        {
          code: 'REFRESH_TOKEN_ALREADY_ROTATED',
          message:
            'Este refresh token acabou de ser renovado por outra requisição.',
        },
        HttpStatus.CONFLICT,
      );
    const [status, code, message] = DENIALS[outcome.denied];
    throw new HttpException({ code, message }, status);
  }

  /** Idempotent: unknown tokens are ignored so the endpoint is no oracle. */
  async logout(token: string, ip: string | null): Promise<void> {
    const now = new Date();
    await identityTransaction(this.db, async (manager) => {
      const row = await manager
        .getRepository(MobileRefreshTokenEntity)
        .findOneBy({ tokenHash: this.hash(token) });
      if (!row) return;
      await this.revokeFamily(manager, row.familyId, now, 'logout');
      await this.audit(
        manager,
        row.userId,
        AuthAuditOperation.MOBILE_LOGOUT,
        ip,
        AuthAuditResult.SUCCESS,
        null,
      );
    });
  }

  private async isFieldEligible(
    manager: EntityManager,
    user: UserEntity,
  ): Promise<boolean> {
    return (
      await resolveFieldAccess(manager, user.id, user.organizationId ?? null)
    ).eligible;
  }

  private async issue(
    manager: EntityManager,
    input: IssueInput,
  ): Promise<{
    id: number;
    token: string;
    expiresAt: Date;
    familyExpiresAt: Date;
  }> {
    const token = `gmr_${randomBytes(32).toString('base64url')}`;
    const expiresAt = this.earliest(
      input.now.getTime() + this.ttl().idleMs,
      input.familyExpiresAt,
    );
    const saved = await manager.getRepository(MobileRefreshTokenEntity).save({
      familyId: input.familyId,
      tokenHash: this.hash(token),
      userId: input.userId,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      authVersion: input.authVersion,
      expiresAt,
      familyExpiresAt: input.familyExpiresAt,
      rotatedAt: null,
      revokedAt: null,
      revokedReason: null,
      replacedById: null,
      deviceLabel: input.deviceLabel,
      createdAt: input.now,
    });
    return {
      id: saved.id,
      token,
      expiresAt,
      familyExpiresAt: input.familyExpiresAt,
    };
  }

  private async revokeFamily(
    manager: EntityManager,
    familyId: string,
    now: Date,
    reason: string,
  ): Promise<void> {
    await manager
      .getRepository(MobileRefreshTokenEntity)
      .update(
        { familyId, revokedAt: IsNull() },
        { revokedAt: now, revokedReason: reason },
      );
    await manager.getRepository(SessionEntity).update(
      { refreshFamilyId: familyId, revokedAt: IsNull() },
      {
        revokedAt: now,
      },
    );
  }

  private audit(
    manager: EntityManager,
    userId: number,
    operation: AuthAuditOperation,
    ipAddress: string | null,
    result: AuthAuditResult,
    metadata: Record<string, unknown> | null,
  ) {
    return manager
      .getRepository(AuthAuditLogEntity)
      .save({ userId, operation, ipAddress, result, metadata });
  }

  private response(
    session: SessionEntity,
    issued: { token: string; expiresAt: Date; familyExpiresAt: Date },
    user: MobileTokenResponseDto['user'],
  ): MobileTokenResponseDto {
    return {
      token_type: 'Bearer',
      access_token: session.id,
      access_token_expires_at: session.expiresAt.toISOString(),
      refresh_token: issued.token,
      refresh_token_expires_at: issued.expiresAt.toISOString(),
      session_expires_at: issued.familyExpiresAt.toISOString(),
      user,
    };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private lock(manager: EntityManager) {
    return manager.connection.options.type === 'mysql'
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {};
  }

  private earliest(epochMs: number, cap: Date): Date {
    return new Date(Math.min(epochMs, cap.getTime()));
  }

  private ttl() {
    const positive = (key: string, fallback: number) => {
      const value = this.config.get<number>(key, fallback);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    return {
      accessMs: positive('auth.mobileAccessTtlMinutes', 15) * 60000,
      idleMs: positive('auth.mobileRefreshIdleDays', 14) * 86400000,
      maxMs: positive('auth.mobileSessionMaxDays', 30) * 86400000,
      graceMs: positive('auth.mobileRefreshReuseGraceSeconds', 30) * 1000,
    };
  }
}
