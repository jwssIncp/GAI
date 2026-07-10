import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { createHash, randomBytes } from 'crypto';
import {
  AuthAuditOperation,
  AuthAuditResult,
} from '../../domain/enums/auth-audit.enums';
import {
  AUTH_AUDIT_REPOSITORY,
  type AuthAuditRepository,
} from '../../domain/ports/auth-audit.repository.port';
import {
  EMAIL_SENDER,
  type EmailSender,
} from '../../domain/ports/email-sender.port';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepository,
} from '../../domain/ports/password-reset-token.repository.port';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port';
import {
  PasswordResetRequestDto,
  PasswordResetRequestResponseDto,
} from '../dto/password-reset-request.dto';

@Injectable()
export class RequestPasswordResetUseCase {
  private static readonly GENERIC_MESSAGE =
    'If the email is registered, you will receive password reset instructions.';

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RequestPasswordResetUseCase.name);
  }

  async execute(
    dto: PasswordResetRequestDto,
    ipAddress: string | null,
  ): Promise<PasswordResetRequestResponseDto> {
    const user = await this.users.findByEmail(dto.email);
    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const ttlHours = this.configService.get<number>(
        'auth.passwordResetTtlHours',
        1,
      );
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

      await this.tokens.invalidateAllForUser(user.id);
      await this.tokens.create({
        id: 0,
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
        createdAt: now,
      });

      await this.emailSender.sendPasswordResetEmail({
        to: user.email,
        resetToken: rawToken,
      });

      await this.audit.save({
        userId: user.id,
        operation: AuthAuditOperation.PASSWORD_RESET_REQUEST,
        ipAddress,
        result: AuthAuditResult.SUCCESS,
      });

      this.logger.info({
        operation: 'PASSWORD_RESET_REQUEST',
        userId: user.id,
        result: 'SUCCESS',
      });
    }

    return { message: RequestPasswordResetUseCase.GENERIC_MESSAGE };
  }
}
