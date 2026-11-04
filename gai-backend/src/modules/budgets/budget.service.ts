import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import { DocumentTemplatesService } from '../documents/document-templates.service';
import {
  ProjectScopeService,
  ProjectActorContext,
} from '../projects/application/services/project-scope.service';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { ProjectStatusTransitionPolicy } from '../projects/domain/services/project-status-transition.policy';
import { CompanyEntity } from '../companies/infrastructure/persistence/company.entity';
import { CompanyUnitEntity } from '../companies/infrastructure/persistence/company-unit.entity';
import { CompanyUnitStatus } from '../companies/domain/enums/company-unit-status.enum';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../auth/domain/enums/user.enums';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../auth/domain/ports/permission-resolver.port';
import {
  BudgetDataDto,
  BudgetListDto,
  BudgetTransitionDto,
  BudgetVersionDto,
  PublishPricingDto,
} from './budget.dto';
import {
  BudgetAuditEntity,
  BudgetEntity,
  BudgetPricingEntity,
  BudgetSnapshot,
  BudgetVersionEntity,
} from './budget.entity';
import {
  calculateBudget,
  civil,
  conflict,
  hasAdjustments,
  invalid,
  pricingValues,
} from './budget.policy';

@Injectable()
export class BudgetService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions: PermissionResolver,
    private readonly visualTemplates: DocumentTemplatesService,
  ) {}
  private org(actor: ProjectActorContext, requested?: number) {
    const id = this.scope.resolveOrganizationFilter(actor, requested);
    if (id == null) invalid('Informe uma organização para esta operação.');
    return id;
  }
  private async require(actor: ProjectActorContext, key: string) {
    if (!(await hasAllPermissions(actor, [key], this.permissions)))
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Permissão específica necessária: ' + key,
      });
  }
  private async orgLock(m: EntityManager, id: number) {
    if (this.ds.options.type === 'mysql') {
      const rows = await m.query<{ id: number }[]>(
        'SELECT id FROM organizations WHERE id = ? FOR UPDATE',
        [id],
      );
      if (!rows.length) invalid('Organização não encontrada.');
    }
  }
  private async budget(
    m: EntityManager,
    id: number,
    actor: ProjectActorContext,
    write = false,
  ) {
    const q = m
      .getRepository(BudgetEntity)
      .createQueryBuilder('b')
      .where('b.id = :id', { id });
    if (write && this.ds.options.type === 'mysql')
      q.setLock('pessimistic_write');
    const row = await q.getOne();
    if (!row)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Orçamento não encontrado.',
      });
    this.scope.assertCanAccessProject(actor, row.organizationId);
    return row;
  }
  private revision(row: BudgetEntity, revision: number, reason: string) {
    if (row.revision !== revision)
      conflict(
        'Orçamento alterado por outra operação. Atualize antes de continuar.',
      );
    if (reason.trim().length < 5)
      invalid('Justificativa deve ter pelo menos cinco caracteres.');
    if (row.status === 'archived') conflict('Orçamento arquivado é imutável.');
  }
  private async versionById(m: EntityManager, row: BudgetEntity, id: number) {
    const version = await m.findOneBy(BudgetVersionEntity, {
      id,
      budgetId: row.id,
      organizationId: row.organizationId,
    });
    if (!version)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Versão não pertence a este orçamento.',
      });
    return version;
  }
  async pricing(filters: BudgetListDto, actor: ProjectActorContext) {
    return this.ds.getRepository(BudgetPricingEntity).find({
      where: { organizationId: this.org(actor, filters.organization_id) },
      order: { id: 'DESC' },
      take: 1000,
    });
  }
  async publish(
    dto: PublishPricingDto,
    actor: ProjectActorContext,
    requested?: number,
  ) {
    const org = this.org(actor, requested),
      values = pricingValues(dto);
    civil(dto.valid_from);
    civil(dto.valid_to);
    if (
      dto.valid_to < dto.valid_from ||
      dto.reason.trim().length < 5 ||
      !dto.name.trim()
    )
      invalid('Nome, justificativa ou vigência inválidos.');
    return this.ds.transaction(async (m) => {
      await this.orgLock(m, org);
      const previous = await m.find(BudgetPricingEntity, {
        where: { organizationId: org, name: dto.name.trim() },
        order: { version: 'DESC' },
      });
      if (
        previous.some(
          (v) => v.validFrom <= dto.valid_to && v.validTo >= dto.valid_from,
        )
      )
        conflict('A vigência se sobrepõe a outra versão deste conjunto.');
      return m.save(
        BudgetPricingEntity,
        m.create(BudgetPricingEntity, {
          organizationId: org,
          name: dto.name.trim(),
          version: (previous[0]?.version ?? 0) + 1,
          validFrom: dto.valid_from,
          validTo: dto.valid_to,
          values,
          reason: dto.reason.trim(),
          actorId: actor.id,
          recordedAt: new Date(),
        }),
      );
    });
  }
  private async snapshot(
    m: EntityManager,
    org: number,
    dto: BudgetDataDto,
    actor: ProjectActorContext,
  ): Promise<BudgetSnapshot> {
    if (dto.organization_id != null && dto.organization_id !== org)
      invalid('Organização incompatível.');
    const company = await m.findOneBy(CompanyEntity, {
      id: dto.company_id,
      organizationId: org,
    });
    if (!company)
      invalid('Empresa não pertence à organização ou foi excluída.');
    const project =
      dto.project_id == null
        ? null
        : await m.findOneBy(ProjectEntity, {
            id: dto.project_id,
            organizationId: org,
            companyId: dto.company_id,
          });
    if (dto.project_id != null && !project)
      invalid('Projeto não pertence à empresa e organização informadas.');
    if (
      project &&
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
    )
      conflict('Projeto encerrado não permite novos orçamentos ou cenários.');
    const responsible = await m.findOneBy(UserEntity, {
      id: dto.responsible_id,
      organizationId: org,
      status: UserStatus.ACTIVE,
    });
    if (!responsible)
      invalid('Responsável deve ser um usuário ativo desta organização.');
    const units: CompanyUnitEntity[] = [];
    for (const id of dto.unit_ids) {
      const unit = await m.findOneBy(CompanyUnitEntity, {
        id,
        organizationId: org,
        companyId: company.id,
      });
      if (!unit || unit.status !== CompanyUnitStatus.ACTIVE)
        invalid(
          'Unidade deve estar ativa e pertencer à empresa e organização.',
        );
      units.push(unit);
    }
    const pricing = await m.findOneBy(BudgetPricingEntity, {
      id: dto.pricing_id,
      organizationId: org,
    });
    if (!pricing) invalid('Parâmetros não pertencem à organização.');
    if (
      dto.prepared_on < pricing.validFrom ||
      dto.prepared_on > pricing.validTo
    )
      invalid('Parâmetros fora da vigência na data de elaboração.');
    if (hasAdjustments(dto))
      await this.require(actor, 'budgets:configure-prices');
    const addresses = dto.addresses.map((a) => a.trim());
    if (
      addresses.some((a) => a.length < 3) ||
      new Set(addresses.map((a) => a.toLocaleLowerCase('pt-BR'))).size !==
        addresses.length
    )
      invalid('Endereços vazios ou repetidos.');
    if (
      !dto.number.trim() ||
      dto.scope.trim().length < 3 ||
      dto.services.some((s) => !s.trim())
    )
      invalid(
        'Número/serviços não podem estar vazios e o escopo exige três caracteres.',
      );
    const input: BudgetDataDto = {
      organization_id: org,
      company_id: Number(company.id),
      project_id: project ? Number(project.id) : null,
      number: dto.number.trim(),
      prepared_on: dto.prepared_on,
      valid_until: dto.valid_until,
      segment: dto.segment?.trim() || null,
      services: [...new Set(dto.services.map((s) => s.trim()))].sort(),
      estimated_assets: dto.estimated_assets,
      unit_ids: [...dto.unit_ids].sort((a, b) => a - b),
      addresses,
      scope: dto.scope.trim(),
      notes: dto.notes?.trim() || null,
      operational_constraints: dto.operational_constraints?.trim() || null,
      responsible_id: Number(responsible.id),
      pricing_id: pricing.id,
      sizing: Object.fromEntries(
        Object.entries(dto.sizing).filter(([, v]) => v != null),
      ),
      payment: { ...dto.payment },
    };
    const address = (c: {
      address: string | null;
      number: string | null;
      city: string | null;
      state: string | null;
    }) => [c.address, c.number, c.city, c.state].filter(Boolean).join(', ');
    return {
      input,
      context: {
        company: {
          id: Number(company.id),
          name: company.name,
          address: address(company) || null,
        },
        project: project
          ? { id: Number(project.id), name: project.name }
          : null,
        units: units
          .sort((a, b) => a.id - b.id)
          .map((u) => ({
            id: Number(u.id),
            name: u.name,
            address: address(u),
          })),
        responsible: { id: Number(responsible.id), login: responsible.login },
      },
      pricing: {
        id: pricing.id,
        name: pricing.name,
        version: pricing.version,
        valid_from: pricing.validFrom,
        valid_to: pricing.validTo,
        values: pricing.values,
      },
      calculation: calculateBudget(
        input,
        pricing.values,
        addresses.length + units.length,
      ),
    };
  }
  private async append(
    m: EntityManager,
    row: BudgetEntity,
    snapshot: BudgetSnapshot,
    actor: ProjectActorContext,
    name: string,
    reason: string,
    kind: 'draft' | 'scenario',
    baseId: number | null,
  ) {
    snapshot.visual_template = await this.visualTemplates.current(
      row.organizationId,
      m,
    );
    const last = await m.findOne(BudgetVersionEntity, {
      where: { budgetId: row.id, organizationId: row.organizationId },
      order: { version: 'DESC' },
    });
    const hash = createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex');
    return m.save(
      BudgetVersionEntity,
      m.create(BudgetVersionEntity, {
        organizationId: row.organizationId,
        budgetId: row.id,
        pricingId: snapshot.pricing.id,
        version: (last?.version ?? 0) + 1,
        kind,
        name: name.trim(),
        baseVersionId: baseId,
        snapshot,
        hash,
        reason: reason.trim(),
        actorId: actor.id,
        recordedAt: new Date(),
      }),
    );
  }
  private async audit(
    m: EntityManager,
    row: BudgetEntity,
    actor: ProjectActorContext,
    operation: string,
    reason: string,
    details: Record<string, unknown>,
  ) {
    await m.save(
      BudgetAuditEntity,
      m.create(BudgetAuditEntity, {
        organizationId: row.organizationId,
        budgetId: row.id,
        revision: row.revision,
        operation,
        details,
        reason: reason.trim(),
        actorId: actor.id,
        recordedAt: new Date(),
      }),
    );
  }
  async simulate(dto: BudgetDataDto, actor: ProjectActorContext) {
    return this.snapshot(
      this.ds.manager,
      this.org(actor, dto.organization_id),
      dto,
      actor,
    );
  }
  async create(dto: BudgetDataDto, actor: ProjectActorContext) {
    const org = this.org(actor, dto.organization_id);
    return this.ds.transaction(async (m) => {
      await this.orgLock(m, org);
      if (
        await m.existsBy(BudgetEntity, {
          organizationId: org,
          number: dto.number.trim(),
        })
      )
        conflict('Número de orçamento já utilizado nesta organização.');
      const snapshot = await this.snapshot(m, org, dto, actor);
      const row = await m.save(
        BudgetEntity,
        m.create(BudgetEntity, {
          organizationId: org,
          companyId: dto.company_id,
          projectId: dto.project_id ?? null,
          number: dto.number.trim(),
          revision: 1,
          status: 'draft',
          headVersionId: null,
          approvedVersionId: null,
          createdAt: new Date(),
        }),
      );
      const version = await this.append(
        m,
        row,
        snapshot,
        actor,
        'Versão inicial',
        'Cadastro do orçamento',
        'draft',
        null,
      );
      row.headVersionId = version.id;
      await m.update(
        BudgetEntity,
        { id: row.id, organizationId: org },
        { headVersionId: version.id },
      );
      await this.audit(m, row, actor, 'create', 'Cadastro do orçamento', {
        version_id: version.id,
      });
      return row;
    });
  }
  async addVersion(
    id: number,
    dto: BudgetVersionDto,
    actor: ProjectActorContext,
    scenario: boolean,
  ) {
    return this.ds.transaction(async (m) => {
      const row = await this.budget(m, id, actor, true);
      this.revision(row, dto.revision, dto.reason);
      if (!scenario && !['draft', 'rejected'].includes(row.status))
        conflict(
          'Somente rascunhos ou rejeitados podem ser editados. Aprovados aceitam cenários independentes.',
        );
      if (
        row.companyId !== dto.company_id ||
        row.number !== dto.number.trim() ||
        row.projectId !== (dto.project_id ?? null)
      )
        invalid(
          'Empresa, projeto e número identificam o orçamento e não podem ser substituídos.',
        );
      const baseId = dto.base_version_id ?? row.headVersionId!;
      await this.versionById(m, row, baseId);
      const snapshot = await this.snapshot(m, row.organizationId, dto, actor);
      const version = await this.append(
        m,
        row,
        snapshot,
        actor,
        dto.name,
        dto.reason,
        scenario ? 'scenario' : 'draft',
        baseId,
      );
      row.revision++;
      if (!scenario) {
        row.headVersionId = version.id;
        row.status = 'draft';
      }
      const update = await m.update(
        BudgetEntity,
        {
          id: row.id,
          organizationId: row.organizationId,
          revision: dto.revision,
        },
        {
          revision: row.revision,
          headVersionId: row.headVersionId,
          status: row.status,
        },
      );
      if (update.affected !== 1)
        conflict('Revisão alterada por outra operação.');
      await this.audit(
        m,
        row,
        actor,
        scenario ? 'scenario' : 'edit',
        dto.reason,
        { version_id: version.id, base_version_id: baseId },
      );
      return row;
    });
  }
  async transition(
    id: number,
    dto: BudgetTransitionDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(async (m) => {
      const row = await this.budget(m, id, actor, true);
      this.revision(row, dto.revision, dto.reason);
      const allowed: Record<string, string[]> = {
        draft: ['review', 'archived'],
        review: ['draft', 'approved', 'rejected'],
        approved: ['archived'],
        rejected: ['draft', 'archived'],
        archived: [],
      };
      if (!allowed[row.status].includes(dto.status))
        conflict('Transição de orçamento não permitida.');
      if (
        dto.status === 'approved' ||
        dto.status === 'rejected' ||
        row.status === 'approved'
      )
        await this.require(actor, 'budgets:approve');
      else await this.require(actor, 'budgets:edit');
      const version = await this.versionById(m, row, dto.version_id);
      if (dto.status === 'approved' || dto.status === 'review') {
        if (
          !(await m.existsBy(CompanyEntity, {
            id: row.companyId,
            organizationId: row.organizationId,
          }))
        )
          conflict('Empresa não está mais disponível nesta organização.');
        if (row.projectId != null) {
          const project = await m.findOneBy(ProjectEntity, {
            id: row.projectId,
            companyId: row.companyId,
            organizationId: row.organizationId,
          });
          if (
            !project ||
            !ProjectStatusTransitionPolicy.allowsOperationalMutation(
              project.status,
            )
          )
            conflict('Projeto não está disponível para revisão/aprovação.');
        }
        if (
          !(await m.existsBy(UserEntity, {
            id: version.snapshot.input.responsible_id,
            organizationId: row.organizationId,
            status: UserStatus.ACTIVE,
          }))
        )
          conflict('Responsável não está mais ativo nesta organização.');
        for (const unitId of version.snapshot.input.unit_ids) {
          const unit = await m.findOneBy(CompanyUnitEntity, {
            id: unitId,
            organizationId: row.organizationId,
            companyId: row.companyId,
          });
          if (!unit || unit.status !== CompanyUnitStatus.ACTIVE)
            conflict(
              'Unidade não está mais disponível para revisão/aprovação.',
            );
        }
      }
      if (dto.status === 'approved') {
        if (row.headVersionId !== version.id)
          conflict(
            'A aprovação deve consolidar a versão enviada para revisão.',
          );
        if (
          version.snapshot.input.valid_until <
          new Date().toISOString().slice(0, 10)
        )
          conflict('Proposta vencida. Crie uma nova versão antes de aprovar.');
        row.approvedVersionId = version.id;
      }
      const previous = row.status;
      row.status = dto.status;
      row.revision++;
      if (dto.status === 'review') row.headVersionId = version.id;
      const update = await m.update(
        BudgetEntity,
        {
          id: row.id,
          organizationId: row.organizationId,
          revision: dto.revision,
        },
        {
          revision: row.revision,
          status: row.status,
          headVersionId: row.headVersionId,
          approvedVersionId: row.approvedVersionId,
        },
      );
      if (update.affected !== 1)
        conflict('Revisão alterada por outra operação.');
      await this.audit(m, row, actor, 'transition', dto.reason, {
        from: previous,
        to: row.status,
        version_id: version.id,
      });
      return row;
    });
  }
  async detail(id: number, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const row = await this.budget(m, id, actor);
      return {
        ...row,
        versions: await m.find(BudgetVersionEntity, {
          where: { budgetId: id, organizationId: row.organizationId },
          order: { version: 'DESC' },
        }),
        audit: await m.find(BudgetAuditEntity, {
          where: { budgetId: id, organizationId: row.organizationId },
          order: { revision: 'DESC' },
        }),
      };
    });
  }
  async list(f: BudgetListDto, actor: ProjectActorContext) {
    const q = this.ds
      .getRepository(BudgetEntity)
      .createQueryBuilder('b')
      .where('b.organization_id = :org', {
        org: this.org(actor, f.organization_id),
      });
    if (f.company_id)
      q.andWhere('b.company_id = :company', { company: f.company_id });
    if (f.project_id)
      q.andWhere('b.project_id = :project', { project: f.project_id });
    if (f.status) q.andWhere('b.status = :status', { status: f.status });
    if (f.search?.trim())
      q.andWhere("b.number LIKE :search ESCAPE '!'", {
        search: '%' + f.search.trim().replace(/[!%_]/g, '!$&') + '%',
      });
    const total = await q.getCount(),
      page = Math.min(f.page ?? 1, Math.max(1, Math.ceil(total / 20)));
    const rows = await q
      .orderBy('b.id', 'DESC')
      .skip((page - 1) * 20)
      .take(20)
      .getMany();
    const items = await Promise.all(
      rows.map(async (b) => ({
        ...b,
        current: b.headVersionId
          ? await this.ds.getRepository(BudgetVersionEntity).findOneBy({
              id: b.headVersionId,
              budgetId: b.id,
              organizationId: b.organizationId,
            })
          : null,
      })),
    );
    return { items, total, page, page_size: 20 };
  }
  async documentVersion(
    id: number,
    versionId: number,
    actor: ProjectActorContext,
  ) {
    const row = await this.budget(this.ds.manager, id, actor);
    const version = await this.versionById(this.ds.manager, row, versionId);
    if (row.projectId != null) {
      const project = await this.ds.manager.findOneBy(ProjectEntity, {
        id: row.projectId,
        organizationId: row.organizationId,
      });
      if (!project)
        throw new NotFoundException('Projeto do orçamento indisponível.');
      this.scope.assertCanAccessProject(actor, Number(project.organizationId));
      await this.require(actor, 'projects:read');
    }
    // Approval is read from the immutable audit trail of this exact version.
    const approved = await this.ds.manager
      .getRepository(BudgetAuditEntity)
      .createQueryBuilder('a')
      .where(
        'a.budget_id = :id AND a.organization_id = :org AND a.operation = :operation',
        { id, org: row.organizationId, operation: 'transition' },
      )
      .getMany();
    return {
      row,
      version,
      approved: approved.some(
        (a) =>
          Number(a.details.version_id) === versionId &&
          a.details.to === 'approved',
      ),
    };
  }
  async proposal(id: number, actor: ProjectActorContext, conversion = false) {
    const row = await this.budget(this.ds.manager, id, actor);
    if (
      !['approved', 'archived'].includes(row.status) ||
      row.approvedVersionId == null
    )
      conflict('Prévia comercial exige orçamento aprovado.');
    if (conversion && row.status !== 'approved')
      conflict(
        'Orçamento arquivado não está disponível para futura conversão.',
      );
    const version = await this.versionById(
      this.ds.manager,
      row,
      row.approvedVersionId,
    );
    const s = version.snapshot;
    const preview = {
      budget_id: row.id,
      number: row.number,
      version: version.version,
      hash: version.hash,
      company: s.context.company,
      project: s.context.project,
      scope: s.input.scope,
      services: s.input.services,
      assets: s.input.estimated_assets,
      units: s.context.units,
      addresses: s.input.addresses,
      field_days: s.calculation.sizing.field_days,
      team: s.calculation.sizing.team,
      valid_until: s.input.valid_until,
      currency: s.calculation.currency,
      final_price: s.calculation.final_price,
      payment: s.calculation.payment,
    };
    if (!conversion) return preview;
    await this.require(actor, 'budgets:approve');
    return {
      ...preview,
      operation: 'preview_only',
      eligible_for_future_conversion: !!row.projectId,
      creates_contract: false,
      creates_project: false,
      creates_receivables: false,
      contract_draft: {
        project_id: row.projectId,
        company_id: row.companyId,
        original_value: preview.final_price,
        currency: preview.currency,
        segment: s.input.segment,
        services: preview.services,
        estimated_assets: preview.assets,
        scope: preview.scope,
        status: 'draft',
      },
      required_before_conversion: [
        'Número do contrato',
        'Data de contratação',
        'Vigência contratual',
        ...(row.projectId ? [] : ['Projeto da mesma empresa/organização']),
      ],
    };
  }
}
