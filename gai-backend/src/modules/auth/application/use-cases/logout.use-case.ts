import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  AuthAuditOperation,
  AuthAuditResult,
} from '../../domain/enums/auth-audit.enums';
import {
  AUTH_AUDIT_REPOSITORY,
  type AuthAuditRepository,
} from '../../domain/ports/auth-audit.repository.port';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../domain/ports/session.repository.port';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LogoutUseCase.name);
  }

  async execute(
    sessionId: string,
    userId: number,
    ipAddress: string | null,
  ): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.revokedAt) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      });
    }

    await this.sessions.revoke(sessionId, new Date());

    await this.audit.save({
      userId,
      operation: AuthAuditOperation.LOGOUT,
      ipAddress,
      result: AuthAuditResult.SUCCESS,
    });

    this.logger.info({
      operation: 'LOGOUT',
      userId,
      result: 'SUCCESS',
    });
  }
}
