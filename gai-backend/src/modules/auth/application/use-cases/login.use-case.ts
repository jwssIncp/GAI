import { Inject, Injectable } from '@nestjs/common';
import { CredentialTransactionsService } from '../services/credential-transactions.service';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../../users/domain/ports/user-role-assignment.repository.port';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../../domain/ports/permission-resolver.port';
import { RoleAssignmentResponseDto } from '../../../users/application/dto/user-response.dto';
import { LoginDto } from '../dto/login.dto';
import { CurrentUserDto, LoginResponseDto } from '../dto/login-response.dto';
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly credentials: CredentialTransactionsService,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions: PermissionResolver,
  ) {}
  async execute(dto: LoginDto, ip: string | null): Promise<LoginResponseDto> {
    const { user, session } = await this.credentials.authenticate(
      dto.identifier,
      dto.password,
      ip,
    );
    const roles = await this.assignments.findActiveByUserId(user.id);
    return {
      access_token: session.id,
      expires_at: session.expiresAt.toISOString(),
      user: CurrentUserDto.fromUser({
        ...user,
        roleAssignments: roles.map((role) =>
          RoleAssignmentResponseDto.fromAssignedRole(role),
        ),
        permissions: user.mustChangePassword
          ? []
          : await this.permissions.resolveForUser(user.id),
      }),
    };
  }
}
