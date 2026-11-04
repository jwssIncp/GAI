import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../auth/infrastructure/persistence/user.entity';
import { CompanyEntity } from '../../../companies/infrastructure/persistence/company.entity';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../organizations/domain/enums/organization-status.enum';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/ports/project.repository.port';
import { ProjectAuditLogEntity } from '../../infrastructure/persistence/project-audit-log.entity';
import { ProjectOptionsQueryDto } from '../dto/project-options-query.dto';
import {
  ProjectActorContext,
  ProjectScopeService,
} from './project-scope.service';

@Injectable()
export class ProjectRegistrationService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(ProjectAuditLogEntity)
    private readonly audits: Repository<ProjectAuditLogEntity>,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    private readonly scope: ProjectScopeService,
  ) {}

  async options(
    query: ProjectOptionsQueryDto,
    actor: ProjectActorContext,
    companiesOnly = false,
  ) {
    const organizationId = this.scope.resolveOrganizationForCreate(
      actor,
      query.organization_id,
    );
    if (
      !(await this.companies.manager.getRepository(OrganizationEntity).exists({
        where: { id: organizationId, status: OrganizationStatus.ACTIVE },
      }))
    ) {
      throw new ConflictException({
        code: 'PROJECT_INVALID_CONTEXT',
        message: 'Organização indisponível para seleção de recursos.',
      });
    }
    if (companiesOnly && query.resource === 'users')
      throw new BadRequestException('Only company options are available here');
    const resource = query.resource ?? 'companies';
    const page = query.page ?? 1,
      pageSize = query.page_size ?? 20;
    // These endpoints intentionally return IDs and labels, never full company/user records.
    const builder =
      resource === 'users'
        ? this.users
            .createQueryBuilder('option')
            .select(['option.id', 'option.fullName', 'option.login'])
        : this.companies
            .createQueryBuilder('option')
            .select(['option.id', 'option.name']);
    builder
      .where('option.organization_id = :organizationId', { organizationId })
      .andWhere('option.status = :status', {
        status: resource === 'users' ? 'ACTIVE' : 'active',
      });
    if (query.selected_id)
      builder.andWhere('option.id = :selectedId', {
        selectedId: query.selected_id,
      });
    if (query.search)
      builder.andWhere(
        resource === 'users'
          ? '(LOWER(option.full_name) LIKE :term OR LOWER(option.login) LIKE :term)'
          : 'LOWER(option.name) LIKE :term',
        { term: `%${query.search.toLowerCase()}%` },
      );
    builder
      .orderBy('option.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [rows, total] = await builder.getManyAndCount();
    return {
      organization_id: organizationId,
      items: rows.map((row) => ({
        id: Number(row.id),
        name: row instanceof UserEntity ? row.fullName || row.login : row.name,
      })),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  async validateUsers(
    organizationId: number,
    ids: Array<number | null | undefined>,
  ) {
    for (const id of new Set(
      ids.filter((value): value is number => value != null),
    )) {
      if (
        !(await this.users.exists({
          where: {
            id,
            organizationId,
            status: 'ACTIVE' as UserEntity['status'],
          },
        }))
      ) {
        throw new ConflictException({
          code: 'PROJECT_INVALID_RESPONSIBLE',
          message:
            'O responsável deve ser um usuário ativo da organização do projeto.',
        });
      }
    }
  }

  async history(
    id: number,
    query: ProjectOptionsQueryDto,
    actor: ProjectActorContext,
  ) {
    const project = await this.projects.findById(id);
    if (!project)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    this.scope.assertCanAccessProject(actor, project.organizationId);
    const page = query.page ?? 1,
      pageSize = query.page_size ?? 20;
    const [rows, total] = await this.audits.findAndCount({
      where: { projectId: id, organizationId: project.organizationId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    // Do not expose arbitrary legacy JSON values in a general read endpoint.
    const safeChanges = (changes: ProjectAuditLogEntity['changes']) =>
      Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [
          key,
          ['settings', 'metadata'].includes(key)
            ? {
                before: value.before == null ? null : '[JSON registrado]',
                after: value.after == null ? null : '[JSON registrado]',
              }
            : value,
        ]),
      );
    return {
      items: rows.map((row) => ({
        id: row.id,
        project_id: row.projectId,
        operation: row.operation,
        performed_by: row.performedBy,
        created_at: row.createdAt.toISOString(),
        changes: safeChanges(row.changes),
      })),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: Math.ceil(total / pageSize),
    };
  }
}
