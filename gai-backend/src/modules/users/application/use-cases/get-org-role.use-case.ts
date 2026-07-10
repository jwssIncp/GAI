import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ORG_ROLE_REPOSITORY,
  type OrgRoleRepository,
} from '../../domain/ports/org-role.repository.port';
import { OrgRoleResponseDto } from '../dto/org-role-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class GetOrgRoleUseCase {
  constructor(
    @Inject(ORG_ROLE_REPOSITORY)
    private readonly repository: OrgRoleRepository,
    private readonly scope: UserScopeService,
  ) {}

  async execute(
    organizationId: number,
    roleId: number,
    actor: ActorContext,
  ): Promise<OrgRoleResponseDto> {
    this.scope.assertCanAccessOrganization(actor, organizationId);

    const role = await this.repository.findByIdAndOrganization(
      roleId,
      organizationId,
    );
    if (!role) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Org role not found',
      });
    }

    return OrgRoleResponseDto.fromDomain(role);
  }
}
