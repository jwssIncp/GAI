import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { hasAllPermissions } from '../../../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../../../auth/domain/ports/permission-resolver.port';
import { contractSummaries } from '../../../contracts/contract-summary';
import { ContractEntity } from '../../../contracts/contract.entity';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/ports/project.repository.port';
import { ListProjectsQueryDto } from '../dto/list-projects-query.dto';
import {
  ProjectListResponseDto,
  ProjectResponseDto,
} from '../dto/project-response.dto';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../services/project-scope.service';

@Injectable()
export class ListProjectsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: ProjectRepository,
    private readonly scope: ProjectScopeService,
    @Optional() private readonly ds?: DataSource,
    @Optional()
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions?: PermissionResolver,
  ) {}

  async execute(
    query: ListProjectsQueryDto,
    actor: ProjectActorContext,
  ): Promise<ProjectListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const organizationId = this.scope.resolveOrganizationFilter(
      actor,
      query.organization_id,
    );

    const { items, total, counts } = await this.repository.list({
      page,
      pageSize,
      organizationId,
      allowedProjectIds: actor.allowedProjectIds,
      companyId: query.company_id,
      status: query.status,
      search: query.search,
      projectType: query.project_type,
      sortBy: query.sort_by,
      sortOrder: query.sort_order,
    });
    const contracts = await this.contracts(
      items.map((p) => Number(p.id)),
      actor,
    );

    return {
      status_counts: counts ?? {},
      items: items.map((project) => {
        const dto = ProjectResponseDto.fromDomain(project);
        return contracts
          ? { ...dto, contract: contracts.get(Number(project.id)) ?? null }
          : dto;
      }),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /**
   * Colunas do contrato na listagem (valor vigente, segmento, data, itens). Só para quem lê
   * contratos; para os demais o campo `contract` nem aparece na resposta.
   */
  private async contracts(projectIds: number[], actor: ProjectActorContext) {
    if (!this.ds || !this.permissions || !projectIds.length) return null;
    if (!(await hasAllPermissions(actor, ['contracts:read'], this.permissions)))
      return null;
    const rows = await this.ds.getRepository(ContractEntity).find({
      select: { projectId: true, number: true, data: true },
      where: { projectId: In(projectIds) },
    });
    return contractSummaries(rows);
  }
}
