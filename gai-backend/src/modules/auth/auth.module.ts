import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { OrganizationEntity } from '../organizations/infrastructure/persistence/organization.entity';
import authConfig from '../../common/config/auth.config';
import { ConfigModule } from '@nestjs/config';
import { RoleAuthorizationService } from './application/services/role-authorization.service';
import { ConfirmPasswordResetUseCase } from './application/use-cases/confirm-password-reset.use-case';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { AUTH_AUDIT_REPOSITORY } from './domain/ports/auth-audit.repository.port';
import { EMAIL_SENDER } from './domain/ports/email-sender.port';
import { ORGANIZATION_GATE } from './domain/ports/organization-gate.port';
import { PERMISSION_RESOLVER } from './domain/ports/permission-resolver.port';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './domain/ports/password-reset-token.repository.port';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.port';
import { SESSION_REPOSITORY } from './domain/ports/session.repository.port';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import {
  MockEmailSender,
  SesEmailSender,
} from './infrastructure/email/ses-email.sender';
import { AuthAuditLogEntity } from './infrastructure/persistence/auth-audit-log.entity';
import { OrganizationGateAdapter } from './infrastructure/persistence/organization-gate.adapter';
import { PasswordResetTokenEntity } from './infrastructure/persistence/password-reset-token.entity';
import { SessionEntity } from './infrastructure/persistence/session.entity';
import { TypeOrmAuthAuditRepository } from './infrastructure/persistence/typeorm-auth-audit.repository';
import { TypeOrmPasswordResetTokenRepository } from './infrastructure/persistence/typeorm-password-reset-token.repository';
import { TypeOrmPermissionResolver } from './infrastructure/persistence/typeorm-permission-resolver';
import { TypeOrmSessionRepository } from './infrastructure/persistence/typeorm-session.repository';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm-user.repository';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { AuthController } from './presentation/auth.controller';
import { OrganizationScopeGuard } from './presentation/guards/organization-scope.guard';
import { PermissionsGuard } from './presentation/guards/permissions.guard';
import { RolesGuard } from './presentation/guards/roles.guard';
import { SessionAuthGuard } from './presentation/guards/session-auth.guard';
import { PermissionEntity } from '../users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../users/infrastructure/persistence/role-permission.entity';
import { UserRoleAssignmentEntity } from '../users/infrastructure/persistence/user-role-assignment.entity';
import { USER_ROLE_ASSIGNMENT_REPOSITORY } from '../users/domain/ports/user-role-assignment.repository.port';
import { TypeOrmUserRoleAssignmentRepository } from '../users/infrastructure/persistence/typeorm-user-role-assignment.repository';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    TypeOrmModule.forFeature([
      UserEntity,
      SessionEntity,
      PasswordResetTokenEntity,
      AuthAuditLogEntity,
      OrganizationEntity,
      PermissionEntity,
      RoleEntity,
      RolePermissionEntity,
      UserRoleAssignmentEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    LogoutUseCase,
    GetCurrentUserUseCase,
    RequestPasswordResetUseCase,
    ConfirmPasswordResetUseCase,
    RoleAuthorizationService,
    SessionAuthGuard,
    RolesGuard,
    PermissionsGuard,
    OrganizationScopeGuard,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: SESSION_REPOSITORY, useClass: TypeOrmSessionRepository },
    {
      provide: PASSWORD_RESET_TOKEN_REPOSITORY,
      useClass: TypeOrmPasswordResetTokenRepository,
    },
    { provide: AUTH_AUDIT_REPOSITORY, useClass: TypeOrmAuthAuditRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: ORGANIZATION_GATE, useClass: OrganizationGateAdapter },
    { provide: PERMISSION_RESOLVER, useClass: TypeOrmPermissionResolver },
    {
      provide: USER_ROLE_ASSIGNMENT_REPOSITORY,
      useClass: TypeOrmUserRoleAssignmentRepository,
    },
    TypeOrmUserRepository,
    TypeOrmSessionRepository,
    {
      provide: EMAIL_SENDER,
      useFactory: (configService: ConfigService) => {
        const useMock = configService.get<boolean>('auth.useMockEmail', true);
        return useMock
          ? new MockEmailSender()
          : new SesEmailSender(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    SessionAuthGuard,
    RolesGuard,
    PermissionsGuard,
    OrganizationScopeGuard,
    RoleAuthorizationService,
    USER_REPOSITORY,
    SESSION_REPOSITORY,
    PASSWORD_HASHER,
    AUTH_AUDIT_REPOSITORY,
    PASSWORD_RESET_TOKEN_REPOSITORY,
    EMAIL_SENDER,
    ORGANIZATION_GATE,
    PERMISSION_RESOLVER,
    USER_ROLE_ASSIGNMENT_REPOSITORY,
    TypeOrmModule,
  ],
})
export class AuthModule {}
