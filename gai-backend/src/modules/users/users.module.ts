import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { OrganizationEntity } from '../organizations/infrastructure/persistence/organization.entity';
import { AuthModule } from '../auth/auth.module';
import { ActivateUserUseCase } from './application/use-cases/activate-user.use-case';
import { AssignUserRoleUseCase } from './application/use-cases/assign-user-role.use-case';
import { CreateOrgRoleUseCase } from './application/use-cases/create-org-role.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { DeactivateOrgRoleUseCase } from './application/use-cases/deactivate-org-role.use-case';
import { DeactivateUserUseCase } from './application/use-cases/deactivate-user.use-case';
import { GetOrgRoleUseCase } from './application/use-cases/get-org-role.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { ListOrgRolesUseCase } from './application/use-cases/list-org-roles.use-case';
import { ListPermissionsUseCase } from './application/use-cases/list-permissions.use-case';
import { ListUserRoleAssignmentsUseCase } from './application/use-cases/list-user-role-assignments.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { RevokeUserRoleAssignmentUseCase } from './application/use-cases/revoke-user-role-assignment.use-case';
import { UpdateOrgRoleUseCase } from './application/use-cases/update-org-role.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { UserScopeService } from './application/services/user-scope.service';
import { ORG_ROLE_REPOSITORY } from './domain/ports/org-role.repository.port';
import { PERMISSION_REPOSITORY } from './domain/ports/permission.repository.port';
import { USER_MANAGEMENT_REPOSITORY } from './domain/ports/user-management.repository.port';
import { RoleAuditLogEntity } from './infrastructure/persistence/role-audit-log.entity';
import { RolePermissionEntity } from './infrastructure/persistence/role-permission.entity';
import { RoleEntity } from './infrastructure/persistence/role.entity';
import { PermissionEntity } from './infrastructure/persistence/permission.entity';
import { TypeOrmOrgRoleRepository } from './infrastructure/persistence/typeorm-org-role.repository';
import { TypeOrmPermissionRepository } from './infrastructure/persistence/typeorm-permission.repository';
import { TypeOrmUserManagementRepository } from './infrastructure/persistence/typeorm-user-management.repository';
import { UserAuditLogEntity } from './infrastructure/persistence/user-audit-log.entity';
import { UserRoleAssignmentEntity } from './infrastructure/persistence/user-role-assignment.entity';
import { OrgRolesController } from './presentation/org-roles.controller';
import { PermissionsController } from './presentation/permissions.controller';
import { UserRoleAssignmentsController } from './presentation/user-role-assignments.controller';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PermissionEntity,
      RoleEntity,
      RolePermissionEntity,
      UserAuditLogEntity,
      RoleAuditLogEntity,
      UserRoleAssignmentEntity,
      UserEntity,
      OrganizationEntity,
    ]),
    AuthModule,
  ],
  controllers: [
    UsersController,
    UserRoleAssignmentsController,
    OrgRolesController,
    PermissionsController,
  ],
  providers: [
    UserScopeService,
    CreateUserUseCase,
    GetUserUseCase,
    ListUsersUseCase,
    UpdateUserUseCase,
    DeactivateUserUseCase,
    ActivateUserUseCase,
    AssignUserRoleUseCase,
    ListUserRoleAssignmentsUseCase,
    RevokeUserRoleAssignmentUseCase,
    ListPermissionsUseCase,
    CreateOrgRoleUseCase,
    GetOrgRoleUseCase,
    ListOrgRolesUseCase,
    UpdateOrgRoleUseCase,
    DeactivateOrgRoleUseCase,
    {
      provide: USER_MANAGEMENT_REPOSITORY,
      useClass: TypeOrmUserManagementRepository,
    },
    {
      provide: ORG_ROLE_REPOSITORY,
      useClass: TypeOrmOrgRoleRepository,
    },
    {
      provide: PERMISSION_REPOSITORY,
      useClass: TypeOrmPermissionRepository,
    },
  ],
  exports: [
    USER_MANAGEMENT_REPOSITORY,
    ORG_ROLE_REPOSITORY,
    PERMISSION_REPOSITORY,
    TypeOrmModule,
  ],
})
export class UsersModule {}
