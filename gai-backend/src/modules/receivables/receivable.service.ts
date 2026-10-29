import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  ProjectScopeService,
  ProjectActorContext,
} from '../projects/application/services/project-scope.service';
import { CompanyEntity } from '../companies/infrastructure/persistence/company.entity';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import {
  ContractEntity,
  ContractAmendmentEntity,
} from '../contracts/contract.entity';
import { BudgetEntity, BudgetVersionEntity } from '../budgets/budget.entity';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../auth/domain/ports/permission-resolver.port';
import {
  ReceivableEntity as R,
  ReceivableEventEntity as E,
  ReceivableInstallmentEntity as I,
} from './receivable.entity';
import {
  ConfirmReceivableDto,
  EditReceivableDto,
  FinanceCommandDto,
  FinanceFilterDto,
  ReceiptDto,
  ReceivableInputDto,
  ReverseReceiptDto,
} from './receivable.dto';
import {
  balance,
  civil,
  conflict,
  decimal,
  hash,
  invalid,
  plan,
  scaled,
} from './receivable.policy';

@Injectable()
export class ReceivableService {
  async source(kind: string, id: number, actor: ProjectActorContext) {
    if (!['contract', 'budget', 'amendment'].includes(kind))
      invalid('Origem inválida.');
    const m = this.ds.manager;
    if (kind === 'budget') {
      await this.require(actor, ['budgets:read']);
      const b = await m.findOne(BudgetEntity, { where: { id } });
      if (!b) invalid('Origem não encontrada.');
      this.scope.assertCanAccessProject(actor, b.organizationId);
      if (b.status !== 'approved' || !b.approvedVersionId)
        invalid('Orçamento não aprovado.');
      const v = await m.findOneByOrFail(BudgetVersionEntity, {
        id: b.approvedVersionId,
        budgetId: b.id,
        organizationId: b.organizationId,
      });
      return {
        company_id: b.companyId,
        project_id: b.projectId,
        organization_id: b.organizationId,
        amount: v.snapshot.calculation.final_price,
        currency: v.snapshot.calculation.currency,
        payment: v.snapshot.input.payment,
        issued_on: v.snapshot.input.prepared_on,
        description: 'Orçamento ' + b.number,
      };
    }
    await this.require(actor, ['contracts:read']);
    const a =
      kind === 'amendment'
        ? await m.findOne(ContractAmendmentEntity, { where: { id } })
        : null;
    if (kind === 'amendment' && !a) invalid('Aditivo não encontrado.');
    const c = await m.findOne(ContractEntity, {
      where: { id: a ? Number(a.contractId) : id },
    });
    if (!c) invalid('Contrato não encontrado.');
    this.scope.assertCanAccessProject(actor, Number(c.organizationId));
    return {
      company_id: Number(c.companyId),
      project_id: Number(c.projectId),
      organization_id: Number(c.organizationId),
      amount: a?.valueDelta ?? c.data.original_value,
      currency: c.data.currency,
      description:
        'Contrato ' + c.number + (a ? ' / aditivo ' + a.identifier : ''),
    };
  }
  constructor(
    readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions: PermissionResolver,
  ) {}
  org(actor: ProjectActorContext, requested?: number) {
    const id = this.scope.resolveOrganizationFilter(actor, requested);
    if (id == null) invalid('Informe a organização.');
    return id;
  }
  async require(actor: ProjectActorContext, keys: string[]) {
    if (!(await hasAllPermissions(actor, keys, this.permissions)))
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Permissões financeiras insuficientes.',
      });
  }
  async orgLock(m: EntityManager, org: number) {
    // One serialization point for commands and source generation, including retries.
    if (this.ds.options.type === 'mysql')
      await m.query('SELECT id FROM organizations WHERE id=? FOR UPDATE', [
        org,
      ]);
  }
  async row(
    m: EntityManager,
    id: number,
    actor: ProjectActorContext,
    write = false,
  ) {
    const q = m
      .getRepository(R)
      .createQueryBuilder('r')
      .where('r.id=:id', { id });
    if (write && this.ds.options.type === 'mysql')
      q.setLock('pessimistic_write');
    const row = await q.getOne();
    if (!row)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Recebível não encontrado.',
      });
    this.scope.assertCanAccessProject(actor, row.organizationId);
    return row;
  }
  async references(
    m: EntityManager,
    org: number,
    companyId: number,
    projectId?: number | null,
  ) {
    const company = await m.findOne(CompanyEntity, {
      where: { id: companyId, organizationId: org },
    });
    if (!company) invalid('Cliente não pertence à organização.');
    if (projectId != null) {
      const project = await m.findOne(ProjectEntity, {
        where: { id: projectId, organizationId: org },
      });
      if (!project || Number(project.companyId) !== companyId)
        invalid('Projeto não pertence ao cliente/organização.');
    }
  }
  private async prepare(
    m: EntityManager,
    dto: ReceivableInputDto,
    actor: ProjectActorContext,
    write = false,
  ) {
    const org = this.org(actor, dto.organization_id);
    let amount = decimal(scaled(dto.amount)),
      currency = dto.currency,
      companyId = dto.company_id,
      projectId = dto.project_id ?? null;
    let contractId: number | null = null,
      sourceKey: string | null = null,
      source: Record<string, unknown> | null = null,
      payment = dto.payment;
    if (dto.origin === 'manual') {
      if (dto.source_id != null)
        invalid('Cadastro manual não admite origem financeira implícita.');
    } else {
      if (!dto.source_id) invalid('Informe a origem.');
      sourceKey = dto.origin + ':' + dto.source_id;
      if (dto.origin === 'budget') {
        await this.require(actor, ['budgets:read']);
        const b = await m.findOne(BudgetEntity, {
          where: { id: dto.source_id, organizationId: org },
          ...(write && this.ds.options.type === 'mysql'
            ? { lock: { mode: 'pessimistic_read' as const } }
            : {}),
        });
        if (!b || b.status !== 'approved' || !b.approvedVersionId)
          invalid('Orçamento aprovado não encontrado.');
        const v = await m.findOne(BudgetVersionEntity, {
          where: {
            id: b.approvedVersionId,
            budgetId: b.id,
            organizationId: org,
          },
        });
        if (!v) invalid('Versão aprovada não encontrada.');
        companyId = b.companyId;
        projectId = b.projectId;
        amount = v.snapshot.calculation.final_price;
        currency = v.snapshot.calculation.currency;
        payment = v.snapshot.input.payment;
        source = {
          budget_id: b.id,
          version_id: v.id,
          version: v.version,
          hash: v.hash,
        };
      } else {
        await this.require(actor, ['contracts:read']);
        let amendment: ContractAmendmentEntity | null = null;
        if (dto.origin === 'amendment') {
          amendment = await m.findOne(ContractAmendmentEntity, {
            where: { id: dto.source_id, organizationId: org },
          });
          if (
            !amendment ||
            amendment.valueDelta == null ||
            scaledPositive(amendment.valueDelta) <= 0n
          )
            invalid('Aditivo de valor positivo não encontrado.');
          contractId = Number(amendment.contractId);
        } else contractId = dto.source_id;
        const c = await m.findOne(ContractEntity, {
          where: { id: contractId, organizationId: org },
          ...(write && this.ds.options.type === 'mysql'
            ? { lock: { mode: 'pessimistic_read' as const } }
            : {}),
        });
        if (!c || !['active', 'suspended', 'completed'].includes(c.data.status))
          invalid('Contrato elegível não encontrado.');
        companyId = Number(c.companyId);
        projectId = Number(c.projectId);
        // Original principal and each positive amendment are independent origins.
        // Current contracted total must never be regenerated after an amendment.
        const value = amendment?.valueDelta ?? c.data.original_value;
        if (value == null || scaledPositive(value) <= 0n)
          invalid('Origem sem valor positivo definido.');
        amount = decimal(scaled(value));
        currency = c.data.currency;
        source = {
          contract_id: contractId,
          revision: c.revision,
          amendment_id: amendment ? Number(amendment.id) : null,
          amount,
          currency,
        };
      }
      if (
        companyId !== dto.company_id ||
        projectId !== (dto.project_id ?? null)
      )
        invalid('Cliente/projeto deve corresponder à origem.');
      if (amount !== decimal(scaled(dto.amount)) || currency !== dto.currency)
        invalid('Valor e moeda devem corresponder à origem.');
    }
    await this.references(m, org, companyId, projectId);
    civil(dto.issued_on);
    if (dto.issued_on > new Date().toISOString().slice(0, 10))
      invalid('Emissão futura não permitida.');
    const installments = plan(amount, payment, dto.issued_on);
    const data = {
      organization_id: org,
      company_id: companyId,
      ...(projectId == null ? {} : { project_id: projectId }),
      origin: dto.origin,
      ...(dto.source_id == null ? {} : { source_id: dto.source_id }),
      description: dto.description.trim(),
      amount,
      currency,
      issued_on: dto.issued_on,
      document: dto.document ?? '',
      notes: dto.notes ?? '',
      reason: dto.reason.trim(),
      payment,
      source_snapshot: source,
    };
    if (data.description.length < 3 || data.reason.length < 5)
      invalid('Descrição e justificativa obrigatórias.');
    return {
      organization_id: org,
      company_id: companyId,
      project_id: projectId,
      contract_id: contractId,
      source_key: sourceKey,
      data,
      plan: installments,
    };
  }
  async preview(dto: ReceivableInputDto, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const p = await this.prepare(m, dto, actor);
      return { ...p, preview_hash: hash(p) };
    });
  }
  private async retry(
    m: EntityManager,
    org: number,
    key: string,
    fingerprint: string,
    actor: ProjectActorContext,
  ) {
    const old = await m.findOne(E, {
      where: { organizationId: org, commandKey: key },
    });
    if (!old) return null;
    if (old.commandHash !== fingerprint || old.actorId !== actor.id)
      conflict('Chave de comando reutilizada com conteúdo ou autor diferente.');
    return this.detailFrom(m, await this.row(m, old.receivableId, actor));
  }
  private async event(
    m: EntityManager,
    row: R,
    actor: ProjectActorContext,
    key: string,
    fingerprint: string,
    operation: string,
    details: Record<string, unknown>,
    extra: Partial<E> = {},
  ) {
    await m.save(
      E,
      m.create(E, {
        organizationId: row.organizationId,
        receivableId: row.id,
        installmentId: null,
        reversesId: null,
        commandKey: key,
        commandHash: fingerprint,
        revision: row.revision,
        operation,
        amount: null,
        effectiveOn: null,
        details,
        actorId: actor.id,
        recordedAt: new Date(),
        ...extra,
      }),
    );
  }
  async create(dto: ConfirmReceivableDto, actor: ProjectActorContext) {
    const org = this.org(actor, dto.organization_id),
      fingerprint = hash({ operation: 'create', dto });
    return this.ds.transaction(async (m) => {
      await this.orgLock(m, org);
      const retry = await this.retry(
        m,
        org,
        dto.command_key,
        fingerprint,
        actor,
      );
      if (retry) return retry;
      const p = await this.prepare(m, dto, actor, true);
      if (hash(p) !== dto.preview_hash)
        conflict('Prévia mudou. Revise e confirme novamente.');
      if (
        p.source_key &&
        (await m.exists(R, {
          where: { organizationId: org, sourceKey: p.source_key },
        }))
      )
        conflict('Esta origem já gerou um recebível, inclusive se cancelado.');
      const row = await m.save(
        R,
        m.create(R, {
          organizationId: org,
          companyId: p.company_id,
          projectId: p.project_id,
          contractId: p.contract_id,
          sourceKey: p.source_key,
          data: p.data,
          amount: p.data.amount,
          currency: p.data.currency,
          revision: 1,
          cancelled: false,
          createdAt: new Date(),
        }),
      );
      row.id = Number(row.id);
      for (const i of p.plan.rows)
        await m.insert(I, {
          organizationId: org,
          receivableId: row.id,
          position: i.position,
          kind: i.kind,
          dueOn: i.due_on,
          amount: i.amount,
        });
      await this.event(m, row, actor, dto.command_key, fingerprint, 'create', {
        reason: dto.reason,
        snapshot: p,
      });
      return this.detailFrom(m, row);
    });
  }
  async detailFrom(m: EntityManager, row: R) {
    const installments = await m.find(I, {
      where: { receivableId: row.id, organizationId: row.organizationId },
      order: { position: 'ASC' },
    });
    const events = await m.find(E, {
      where: { receivableId: row.id, organizationId: row.organizationId },
      order: { revision: 'ASC' },
    });
    const today = new Date().toISOString().slice(0, 10);
    const result = installments.map((i) => {
      const b = balance(
        i.amount,
        events.filter((e) => e.installmentId === i.id),
      );
      return {
        ...i,
        ...b,
        open: row.cancelled ? '0.00' : b.open,
        status: row.cancelled ? 'cancelled' : b.status,
        overdue: !row.cancelled && scaled(b.open) > 0n && i.dueOn < today,
      };
    });
    const b = balance(row.amount, events);
    return {
      ...row,
      ...b,
      open: row.cancelled ? '0.00' : b.open,
      status: row.cancelled ? 'cancelled' : b.status,
      overdue: result.some((i) => i.overdue),
      installments: result,
      events,
    };
  }
  async detail(id: number, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) =>
      this.detailFrom(m, await this.row(m, id, actor)),
    );
  }
  async filterReferences(
    m: EntityManager,
    f: FinanceFilterDto,
    actor: ProjectActorContext,
  ) {
    const org = this.org(actor, f.organization_id);
    if (f.date_from) civil(f.date_from);
    if (f.date_to) civil(f.date_to);
    if (f.date_from && f.date_to && f.date_from > f.date_to)
      invalid('Período invertido.');
    if (
      f.company_id &&
      !(await m.exists(CompanyEntity, {
        where: { id: f.company_id, organizationId: org },
      }))
    )
      invalid('Cliente fora da organização.');
    if (f.project_id) {
      const p = await m.findOne(ProjectEntity, {
        where: { id: f.project_id, organizationId: org },
      });
      if (!p || (f.company_id && Number(p.companyId) !== f.company_id))
        invalid('Projeto fora do filtro autorizado.');
    }
    if (f.contract_id) {
      const c = await m.findOne(ContractEntity, {
        where: { id: f.contract_id, organizationId: org },
      });
      if (
        !c ||
        (f.project_id && Number(c.projectId) !== f.project_id) ||
        (f.company_id && Number(c.companyId) !== f.company_id)
      )
        invalid('Contrato fora do filtro autorizado.');
    }
    return org;
  }
  async cohort(
    m: EntityManager,
    f: FinanceFilterDto,
    actor: ProjectActorContext,
  ) {
    const org = await this.filterReferences(m, f, actor),
      q = m
        .getRepository(R)
        .createQueryBuilder('r')
        .where('r.organizationId=:org', { org });
    for (const [field, value] of [
      ['companyId', f.company_id],
      ['projectId', f.project_id],
      ['contractId', f.contract_id],
    ] as const)
      if (value) q.andWhere(`r.${field}=:${field}`, { [field]: value });
    const rows = await q.orderBy('r.id', 'DESC').take(10001).getMany();
    if (rows.length > 10000)
      invalid('Refine os filtros: limite de 10.000 recebíveis.');
    return rows;
  }
  async list(f: FinanceFilterDto, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const rows = await this.cohort(m, f, actor),
        items = [] as Awaited<ReturnType<ReceivableService['detailFrom']>>[];
      for (const row of rows) {
        const d = await this.detailFrom(m, row);
        if (
          f.status &&
          (f.status === 'overdue' ? !d.overdue : d.status !== f.status)
        )
          continue;
        if (
          (f.date_from || f.date_to) &&
          !d.installments.some(
            (i) =>
              (!f.date_from || i.dueOn >= f.date_from) &&
              (!f.date_to || i.dueOn <= f.date_to),
          )
        )
          continue;
        items.push(d);
      }
      return {
        items: items.slice((f.page - 1) * f.page_size, f.page * f.page_size),
        total: items.length,
        page: f.page,
        page_size: f.page_size,
      };
    });
  }
  private async mutate(
    id: number,
    dto: FinanceCommandDto,
    actor: ProjectActorContext,
    operation: string,
    perform: (
      m: EntityManager,
      row: R,
    ) => Promise<{ details: Record<string, unknown>; extra?: Partial<E> }>,
  ) {
    const fingerprint = hash({ id, operation, dto });
    if (dto.reason.trim().length < 5)
      invalid('Justificativa significativa obrigatória.');
    const initial = await this.row(this.ds.manager, id, actor);
    return this.ds.transaction(async (m) => {
      await this.orgLock(m, initial.organizationId);
      const row = await this.row(m, id, actor, true);
      const retry = await this.retry(
        m,
        row.organizationId,
        dto.command_key,
        fingerprint,
        actor,
      );
      if (retry) return retry;
      if (row.revision !== dto.revision)
        conflict('Recebível alterado. Atualize a página.');
      if (row.cancelled) conflict('Recebível cancelado não admite alterações.');
      const result = await perform(m, row);
      const previous = row.revision;
      row.revision++;
      const updated = await m
        .createQueryBuilder()
        .update(R)
        .set({
          revision: row.revision,
          data: () => ':data',
          cancelled: row.cancelled,
        })
        .where('id=:id AND organization_id=:org AND revision=:revision', {
          id: row.id,
          org: row.organizationId,
          revision: previous,
          data: JSON.stringify(row.data),
        })
        .execute();
      if (updated.affected !== 1) conflict('Conflito de revisão.');
      await this.event(
        m,
        row,
        actor,
        dto.command_key,
        fingerprint,
        operation,
        { reason: dto.reason, ...result.details },
        result.extra,
      );
      return this.detailFrom(m, row);
    });
  }
  edit(id: number, dto: EditReceivableDto, actor: ProjectActorContext) {
    return this.mutate(id, dto, actor, 'edit', (_m, row) => {
      const before = row.data;
      row.data = {
        ...before,
        description: dto.description.trim(),
        document: dto.document ?? '',
        notes: dto.notes ?? '',
      };
      if (row.data.description.length < 3) invalid('Descrição obrigatória.');
      return Promise.resolve({ details: { before, after: row.data } });
    });
  }
  receive(id: number, dto: ReceiptDto, actor: ProjectActorContext) {
    return this.mutate(id, dto, actor, 'receipt', async (m, row) => {
      const d = await this.detailFrom(m, row),
        i = d.installments.find((i) => i.id === dto.installment_id);
      if (!i) invalid('Parcela não pertence ao recebível.');
      civil(dto.received_on);
      if (
        dto.received_on < row.data.issued_on ||
        dto.received_on > new Date().toISOString().slice(0, 10)
      )
        invalid('Data de recebimento fora do intervalo emissão/hoje.');
      const value = scaled(dto.amount);
      if (value <= 0n || value > scaled(i.open))
        conflict('Valor deve ser positivo e não superar o saldo da parcela.');
      if (!dto.method.trim() || !dto.reference.trim())
        invalid('Forma e referência obrigatórias.');
      if (
        d.events.some(
          (e) =>
            e.operation === 'receipt' &&
            e.details.reference === dto.reference.trim(),
        )
      )
        conflict('Referência de recebimento já registrada neste recebível.');
      return {
        details: {
          method: dto.method.trim(),
          reference: dto.reference.trim(),
          notes: dto.notes ?? '',
        },
        extra: {
          installmentId: i.id,
          amount: decimal(value),
          effectiveOn: dto.received_on,
        },
      };
    });
  }
  reverse(
    id: number,
    eventId: number,
    dto: ReverseReceiptDto,
    actor: ProjectActorContext,
  ) {
    return this.mutate(id, dto, actor, 'reversal', async (m, row) => {
      const d = await this.detailFrom(m, row),
        e = d.events.find((e) => e.id === eventId && e.operation === 'receipt');
      if (!e || !e.amount || !e.effectiveOn)
        invalid('Recebimento não encontrado neste recebível.');
      if (d.events.some((r) => r.reversesId === e.id))
        conflict('Recebimento já estornado.');
      civil(dto.reversed_on);
      if (
        dto.reversed_on < e.effectiveOn ||
        dto.reversed_on > new Date().toISOString().slice(0, 10)
      )
        invalid('Data de estorno fora do intervalo recebimento/hoje.');
      return {
        details: { original_event_id: e.id },
        extra: {
          installmentId: e.installmentId,
          reversesId: e.id,
          amount: decimal(-scaled(e.amount)),
          effectiveOn: dto.reversed_on,
        },
      };
    });
  }
  cancel(id: number, dto: FinanceCommandDto, actor: ProjectActorContext) {
    return this.mutate(id, dto, actor, 'cancel', async (m, row) => {
      const d = await this.detailFrom(m, row);
      if (scaled(d.received) !== 0n)
        conflict('Estorne explicitamente os recebimentos antes de cancelar.');
      row.cancelled = true;
      return { details: { previous_status: d.status } };
    });
  }
}
function scaledPositive(value: string) {
  return value.startsWith('-') ? -scaled(value.slice(1)) : scaled(value);
}
