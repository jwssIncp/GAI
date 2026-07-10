import { Inject, Injectable } from '@nestjs/common';
import {
  USER_MANAGEMENT_REPOSITORY,
  type UserManagementRepository,
} from '../../domain/ports/user-management.repository.port';
import {
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  type UserRoleAssignmentRepository,
} from '../../domain/ports/user-role-assignment.repository.port';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UserListResponseDto, UserResponseDto } from '../dto/user-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_MANAGEMENT_REPOSITORY)
    private readonly repository: UserManagementRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignments: UserRoleAssignmentRepository,
    private readonly scope: UserScopeService,
  ) {}

  async execute(
    query: ListUsersQueryDto,
    actor: ActorContext,
  ): Promise<UserListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const organizationId = this.scope.assertCanFilterByOrganization(
      actor,
      query.organization_id,
    );

    const { items, total } = await this.repository.list({
      page,
      pageSize,
      organizationId,
      status: query.status,
      role: query.role,
      search: query.search,
    });

    const assignmentMap = await this.assignments.findActiveByUserIds(
      items.map((user) => user.id),
    );

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      data: items.map((user) =>
        UserResponseDto.fromDomain(user, assignmentMap.get(user.id) ?? []),
      ),
      meta: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
      },
    };
  }
}
