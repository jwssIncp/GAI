import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import {
  AuthAuditOperation,
  AuthAuditResult,
} from '../../domain/enums/auth-audit.enums';
import { UserStatus } from '../../domain/enums/user.enums';
import {
  AUTH_AUDIT_REPOSITORY,
  type AuthAuditRepository,
} from '../../domain/ports/auth-audit.repository.port';
import {
  ORGANIZATION_GATE,
  type OrganizationGate,
} from '../../domain/ports/organization-gate.port';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../domain/ports/password-hasher.port';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../domain/ports/session.repository.port';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.port';
import { RoleAssignmentResponseDto } from '../../../users/application/dto/user-response.dto';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../../users/domain/ports/user-role-assignment.repository.port';
import { LoginDto } from '../dto/login.dto';
import { CurrentUserDto, LoginResponseDto } from '../dto/login-response.dto';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ORGANIZATION_GATE) private readonly orgGate: OrganizationGate,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LoginUseCase.name);
  }

  async execute(
    dto: LoginDto,
    ipAddress: string | null,
  ): Promise<LoginResponseDto> {
    const now = new Date();
    const user = await this.users.findByLoginOrEmail(dto.identifier);

    if (!user) {
      await this.audit.save({
        userId: null,
        operation: AuthAuditOperation.LOGIN_FAILED,
        ipAddress,
        result: AuthAuditResult.FAILURE,
        metadata: { reason: 'unknown_user' },
      });
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    if (user.isLocked(now)) {
      await this.audit.save({
        userId: user.id,
        operation: AuthAuditOperation.LOGIN_FAILED,
        ipAddress,
        result: AuthAuditResult.FAILURE,
        metadata: { reason: 'locked' },
      });
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked due to failed login attempts',
        },
        HttpStatus.LOCKED,
      );
    }

    if (user.status === UserStatus.INACTIVE) {
      await this.audit.save({
        userId: user.id,
        operation: AuthAuditOperation.LOGIN_FAILED,
        ipAddress,
        result: AuthAuditResult.FAILURE,
        metadata: { reason: 'inactive' },
      });
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    if (user.organizationId) {
      const orgActive = await this.orgGate.isActive(user.organizationId);
      if (!orgActive) {
        await this.audit.save({
          userId: user.id,
          operation: AuthAuditOperation.LOGIN_FAILED,
          ipAddress,
          result: AuthAuditResult.FAILURE,
          metadata: { reason: 'inactive_organization' },
        });
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }
    }

    const valid = await this.hasher.verify(dto.password, user.passwordHash);
    if (!valid) {
      const maxAttempts = this.configService.get<number>(
        'auth.lockoutMaxAttempts',
        5,
      );
      const lockoutMinutes = this.configService.get<number>(
        'auth.lockoutDurationMinutes',
        30,
      );
      user.recordFailedLogin(maxAttempts, lockoutMinutes, now);
      await this.users.save(user);

      await this.audit.save({
        userId: user.id,
        operation: AuthAuditOperation.LOGIN_FAILED,
        ipAddress,
        result: AuthAuditResult.FAILURE,
        metadata: { attempts: user.failedLoginAttempts },
      });

      if (user.isLocked(now)) {
        throw new HttpException(
          {
            code: 'ACCOUNT_LOCKED',
            message: 'Account temporarily locked due to failed login attempts',
          },
          HttpStatus.LOCKED,
        );
      }

      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    user.recordSuccessfulLogin(now);
    await this.users.save(user);

    const sessionTtlHours = this.configService.get<number>(
      'auth.sessionTtlHours',
      8,
    );
    const expiresAt = new Date(
      now.getTime() + sessionTtlHours * 60 * 60 * 1000,
    );
    const sessionId = randomUUID();

    await this.sessions.create({
      id: sessionId,
      userId: user.id,
      organizationId: user.organizationId,
      expiresAt,
      revokedAt: null,
      createdAt: now,
      lastActivityAt: now,
    });

    await this.audit.save({
      userId: user.id,
      operation: AuthAuditOperation.LOGIN,
      ipAddress,
      result: AuthAuditResult.SUCCESS,
    });

    this.logger.info({
      operation: 'LOGIN',
      userId: user.id,
      result: 'SUCCESS',
    });

    return {
      access_token: sessionId,
      expires_at: expiresAt.toISOString(),
      user: CurrentUserDto.fromUser({
        id: user.id,
        login: user.login,
        email: user.email,
        status: user.status,
        organizationId: user.organizationId,
        roleAssignments: (
          await this.assignments.findActiveByUserId(user.id)
        ).map(RoleAssignmentResponseDto.fromAssignedRole),
      }),
    };
  }
}
