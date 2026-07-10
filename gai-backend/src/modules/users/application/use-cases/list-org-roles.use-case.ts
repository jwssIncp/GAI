import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import {
  ORG_ROLE_REPOSITORY,
  type OrgRoleRepository,
} from '../../domain/ports/org-role.repository.port';
import { OrgRoleResponseDto } from '../dto/org-role-response.dto';
import { ActorContext, UserScopeService } from '../services/user-scope.service';

@Injectable()
export class ListOrgRolesUseCase {
  constructor(
    @Inject(ORG_ROLE_REPOSITORY)
    private readonly repository: OrgRoleRepository,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,
    private readonly scope: UserScopeService,
  ) {}

  async execute(
    organizationId: number,
    includeInactive: boolean,
    actor: ActorContext,
  ): Promise<OrgRoleResponseDto[]> {
    this.scope.assertCanAccessOrganization(actor, organizationId);

    const exists = await this.organizationRepo.exist({
      where: { id: organizationId },
    });
    if (!exists) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }

    const roles = await this.repository.listByOrganization(
      organizationId,
      includeInactive,
    );

    return roles.map((role) => OrgRoleResponseDto.fromDomain(role));
  }
}
