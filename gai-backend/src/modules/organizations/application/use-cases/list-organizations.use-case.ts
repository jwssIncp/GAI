import { Inject, Injectable } from '@nestjs/common';
import { buildPaginatedResult } from '../../../../common/pagination/paginated-result';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../domain/ports/organization.repository.port';
import { ListOrganizationsQueryDto } from '../dto/list-organizations-query.dto';
import { OrganizationResponseDto } from '../dto/organization-response.dto';

@Injectable()
export class ListOrganizationsUseCase {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly repository: OrganizationRepository,
  ) {}

  async execute(query: ListOrganizationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;

    const { items, total } = await this.repository.list({
      page,
      pageSize,
      status: query.status,
      search: query.search,
    });

    return buildPaginatedResult(
      items.map((org) => OrganizationResponseDto.fromDomain(org)),
      page,
      pageSize,
      total,
    );
  }
}
