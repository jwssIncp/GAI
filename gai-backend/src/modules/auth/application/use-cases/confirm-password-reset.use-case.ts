import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { createHash } from 'crypto';
import {
  AuthAuditOperation,
  AuthAuditResult,
} from '../../domain/enums/auth-audit.enums';
import { Password } from '../../domain/value-objects/password';
import {
  AUTH_AUDIT_REPOSITORY,
  type AuthAuditRepository,
} from '../../domain/ports/auth-audit.repository.port';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../domain/ports/password-hasher.port';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepository,
} from '../../domain/ports/password-reset-token.repository.port';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../domain/ports/session.repository.port';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port';
import {
  PasswordResetConfirmDto,
  PasswordResetConfirmResponseDto,
} from '../dto/password-reset-confirm.dto';

@Injectable()
export class ConfirmPasswordResetUseCase {
  constructor(
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ConfirmPasswordResetUseCase.name);
  }

  async execute(
    dto: PasswordResetConfirmDto,
    ipAddress: string | null,
  ): Promise<PasswordResetConfirmResponseDto> {
    const now = new Date();
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const tokenRecord = await this.tokens.findValidByHash(tokenHash, now);

    if (!tokenRecord) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired reset token',
      });
    }

    const user = await this.users.findById(tokenRecord.userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired reset token',
      });
    }

    const newPassword = Password.create(dto.new_password);
    const hash = await this.hasher.hash(newPassword.getValue());
    user.updatePasswordHash(hash, now);
    await this.users.save(user);

    await this.tokens.markUsed(tokenRecord.id, now);
    await this.sessions.revokeAllForUser(user.id, now);

    await this.audit.save({
      userId: user.id,
      operation: AuthAuditOperation.PASSWORD_RESET_CONFIRM,
      ipAddress,
      result: AuthAuditResult.SUCCESS,
    });

    this.logger.info({
      operation: 'PASSWORD_RESET_CONFIRM',
      userId: user.id,
      result: 'SUCCESS',
    });

    return { message: 'Password reset successfully' };
  }
}
