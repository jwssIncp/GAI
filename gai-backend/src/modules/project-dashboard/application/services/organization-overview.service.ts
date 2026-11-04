import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  applyCommercialFilters,
  hasCommercialFilters,
} from '../../../contracts/commercial-filters';
import { hasAllPermissions } from '../../../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../../../auth/domain/ports/permission-resolver.port';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import {
  ProjectScopeService,
  ProjectActorContext,
} from '../../../projects/application/services/project-scope.service';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { ProjectStatus } from '../../../projects/domain/enums/project-status.enum';
import { OrganizationOverviewQueryDto } from '../dto/organization-overview-query.dto';

const UFS =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(
    ' ',
  );
// EXISTS prevents multiple units in the same UF from multiplying the project rows.
const UNIT_LINK = `FROM project_units pu JOIN company_units cu ON cu.id = pu.company_unit_id
  AND cu.organization_id = p.organization_id AND cu.deleted_at IS NULL
  WHERE pu.project_id = p.id AND pu.organization_id = p.organization_id AND pu.deleted_at IS NULL`;

@Injectable()
export class OrganizationOverviewService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projects: Repository<ProjectEntity>,
    private readonly scope: ProjectScopeService,
    @Optional()
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions?: PermissionResolver,
  ) {}

  query(filters: OrganizationOverviewQueryDto, actor: ProjectActorContext) {
    // Never accept an organization identifier from query parameters.
    if (
      !actor.systemRoles.includes(UserRole.ORG_ADMIN) ||
      actor.organizationId == null
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Organization administrator required',
      });
    }
    const organizationId = this.scope.resolveOrganizationFilter(actor);
    if (
      filters.date_from &&
      filters.date_to &&
      filters.date_from > filters.date_to
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A data inicial deve ser anterior à final.',
      });
    }
    const query = this.projects
      .createQueryBuilder('p')
      .where('p.organization_id = :organizationId', { organizationId });
    // TypeORM automatically excludes soft-deleted projects. No joins duplicate projects.
    if (filters.year)
      query.andWhere('YEAR(p.created_at) = :year', { year: filters.year });
    if (filters.month)
      query.andWhere('MONTH(p.created_at) = :month', { month: filters.month });
    if (filters.date_from)
      query.andWhere('p.created_at >= :dateFrom', {
        dateFrom: `${filters.date_from} 00:00:00`,
      });
    if (filters.date_to) {
      const next = new Date(`${filters.date_to}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      query.andWhere('p.created_at < :dateTo', {
        dateTo: next.toISOString().slice(0, 10) + ' 00:00:00',
      });
    }
    if (filters.status)
      query.andWhere('p.status = :status', { status: filters.status });
    if (filters.company_id)
      query.andWhere(
        `p.company_id = :companyId AND EXISTS
      (SELECT 1 FROM companies c WHERE c.id = p.company_id AND c.organization_id = p.organization_id AND c.deleted_at IS NULL)`,
        { companyId: filters.company_id },
      );
    if (filters.state)
      query.andWhere(
        `EXISTS (SELECT 1 ${UNIT_LINK} AND UPPER(TRIM(cu.state)) = :state)`,
        { state: filters.state },
      );
    if (filters.search?.trim())
      query.andWhere("p.name LIKE :search ESCAPE '!'", {
        search: `%${filters.search.trim().replace(/[!%_]/g, '!$&')}%`,
      });
    if (hasCommercialFilters(filters)) {
      const contracts = this.projects.manager
        .createQueryBuilder()
        .select('1')
        .from('project_contracts', 'cf')
        .where(
          'cf.project_id = p.id AND cf.organization_id = p.organization_id',
        );
      applyCommercialFilters(contracts, 'cf', filters);
      query.andWhere(
        `EXISTS (${contracts.getQuery()})`,
        contracts.getParameters(),
      );
    }
    return query;
  }

  private async authorizeFilters(
    filters: OrganizationOverviewQueryDto,
    actor: ProjectActorContext,
  ) {
    if (
      hasCommercialFilters(filters) &&
      (!this.permissions ||
        !(await hasAllPermissions(
          actor,
          ['commercial-indicators:read'],
          this.permissions,
        )))
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Indicadores comerciais não autorizados.',
      });
    }
  }

  async overview(
    filters: OrganizationOverviewQueryDto,
    actor: ProjectActorContext,
  ) {
    await this.authorizeFilters(filters, actor);
    const query = this.query(filters, actor);
    const [totals, statuses, timeline, projects, geography, located] =
      await Promise.all([
        query
          .clone()
          .select('COUNT(*)', 'total')
          .addSelect(
            'SUM(CASE WHEN p.status = :openStatus THEN 1 ELSE 0 END)',
            'open',
          )
          .setParameter('openStatus', ProjectStatus.ACTIVE)
          .getRawOne<{ total: string; open: string }>(),
        query
          .clone()
          .select('p.status', 'status')
          .addSelect('COUNT(*)', 'total')
          .groupBy('p.status')
          .getRawMany<{ status: string; total: string }>(),
        query
          .clone()
          .select("DATE_FORMAT(p.created_at, '%Y-%m')", 'period')
          .addSelect('COUNT(*)', 'total')
          .groupBy("DATE_FORMAT(p.created_at, '%Y-%m')")
          .orderBy('period', 'ASC')
          .getRawMany<{ period: string; total: string }>(),
        query
          .clone()
          .select(['p.id', 'p.name', 'p.status', 'p.createdAt'])
          .orderBy('p.created_at', 'DESC')
          .addOrderBy('p.id', 'DESC')
          .take(50)
          .getMany(),
        query
          .clone()
          .innerJoin(
            'project_units',
            'pu',
            'pu.project_id = p.id AND pu.organization_id = p.organization_id AND pu.deleted_at IS NULL',
          )
          .innerJoin(
            'company_units',
            'cu',
            'cu.id = pu.company_unit_id AND cu.organization_id = p.organization_id AND cu.deleted_at IS NULL',
          )
          .select('UPPER(TRIM(cu.state))', 'state')
          .addSelect('COUNT(DISTINCT p.id)', 'total')
          .andWhere('UPPER(TRIM(cu.state)) IN (:...ufs)', { ufs: UFS })
          .groupBy('UPPER(TRIM(cu.state))')
          .getRawMany<{ state: string; total: string }>(),
        query
          .clone()
          .andWhere(
            `EXISTS (SELECT 1 ${UNIT_LINK} AND UPPER(TRIM(cu.state)) IN (:...ufs))`,
            { ufs: UFS },
          )
          .getCount(),
      ]);
    const total = Number(totals?.total ?? 0);
    const open = Number(totals?.open ?? 0);
    return {
      total_projects: total,
      open_projects: open,
      open_percentage: total ? Math.round((open / total) * 10000) / 100 : 0,
      total_contract_value: null,
      average_contract_value: null,
      open_contract_value: null,
      contracted_items: null,
      statuses: statuses.map((row) => ({
        status: row.status,
        total: Number(row.total),
      })),
      timeline: timeline.map((row) => ({
        period: row.period,
        total: Number(row.total),
      })),
      geography: geography.map((row) => ({
        state: row.state,
        total: Number(row.total),
      })),
      unlocated_projects: total - located,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        created_at: p.createdAt,
      })),
    };
  }

  async projectPage(
    filters: OrganizationOverviewQueryDto,
    actor: ProjectActorContext,
  ) {
    await this.authorizeFilters(filters, actor);
    const query = this.query(filters, actor);
    const total = await query.clone().getCount();
    const size = filters.page_size ?? 10;
    const page = Math.min(
      filters.page ?? 1,
      Math.max(1, Math.ceil(total / size)),
    );
    const sort =
      {
        id: 'p.id',
        name: 'p.name',
        status: 'p.status',
        created_at: 'p.created_at',
        company: 'c.name',
        addresses: 'addresses',
        states: 'states',
      }[filters.sort ?? 'created_at'] ?? 'p.created_at';
    query
      .leftJoin(
        'companies',
        'c',
        'c.id = p.company_id AND c.organization_id = p.organization_id AND c.deleted_at IS NULL',
      )
      .select('p.id', 'id')
      .addSelect('p.name', 'name')
      .addSelect('p.status', 'status')
      .addSelect('p.created_at', 'created_at')
      .addSelect('c.name', 'company')
      .addSelect(`(SELECT COUNT(DISTINCT cu.id) ${UNIT_LINK})`, 'addresses')
      .addSelect(
        `(SELECT GROUP_CONCAT(DISTINCT UPPER(TRIM(cu.state))) ${UNIT_LINK})`,
        'states',
      )
      .orderBy(sort, filters.direction ?? 'DESC');
    if (sort !== 'p.id') query.addOrderBy('p.id', 'DESC');
    const pagedRows = await query
      .offset((page - 1) * size)
      .limit(size)
      .getRawMany<{
        id: string | number;
        name: string;
        status: string;
        created_at: Date | string;
        company: string | null;
        addresses: string | number;
        states: string | null;
      }>();
    return {
      total,
      page,
      page_size: size,
      items: pagedRows.map((row) => ({
        ...row,
        id: Number(row.id),
        addresses: Number(row.addresses),
      })),
    };
  }

  async companyPage(
    filters: OrganizationOverviewQueryDto,
    actor: ProjectActorContext,
  ) {
    await this.authorizeFilters(filters, actor);
    const query = this.query(filters, actor).leftJoin(
      'companies',
      'c',
      'c.id = p.company_id AND c.organization_id = p.organization_id AND c.deleted_at IS NULL',
    );
    if (filters.company_search?.trim())
      query.andWhere("c.name LIKE :companySearch ESCAPE '!'", {
        companySearch: `%${filters.company_search.trim().replace(/[!%_]/g, '!$&')}%`,
      });
    const grouped = query
      .select('c.id', 'id')
      .addSelect('c.name', 'name')
      .addSelect('COUNT(*)', 'total')
      .groupBy('c.id')
      .addGroupBy('c.name');
    // Bound response size and paginate groups in SQL, including an explicit unlinked bucket.
    const counts = await this.projects.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'total')
      .from(`(${grouped.getQuery()})`, 'groups')
      .setParameters(grouped.getParameters())
      .getRawOne<{ total: string | number }>();
    const total = Number(counts?.total ?? 0);
    const size = filters.page_size ?? 10;
    const page = Math.min(
      filters.page ?? 1,
      Math.max(1, Math.ceil(total / size)),
    );
    const rows = await grouped
      .orderBy(
        filters.sort === 'name' ? 'c.name' : 'COUNT(*)',
        filters.direction ?? 'DESC',
      )
      .addOrderBy('c.id', 'ASC')
      .offset((page - 1) * size)
      .limit(size)
      .getRawMany<{
        id: string | number | null;
        name: string | null;
        total: string | number;
      }>();
    return {
      total,
      page,
      page_size: size,
      items: rows.map((row) => ({
        id: row.id == null ? null : Number(row.id),
        name: row.name ?? 'Sem empresa vinculada',
        total: Number(row.total),
      })),
    };
  }

  async exportRows(
    filters: OrganizationOverviewQueryDto,
    actor: ProjectActorContext,
  ) {
    await this.authorizeFilters(filters, actor);
    const rows = await this.query(filters, actor)
      .select(['p.id', 'p.name', 'p.status', 'p.createdAt'])
      .orderBy('p.id', 'ASC')
      .take(10001)
      .getMany();
    if (rows.length > 10000)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Refine os filtros para exportar até 10.000 projetos.',
      });
    return rows.map((p) => ({
      ID: p.id,
      Projeto: p.name,
      Status: p.status,
      'Criado em': p.createdAt.toISOString(),
    }));
  }
}
