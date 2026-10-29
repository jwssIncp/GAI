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
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { ReceivableEntity } from '../receivables/receivable.entity';
import { ExpenseEntity } from '../payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { ExpenseStatus } from '../payments-expenses/domain/enums/expense-status.enum';
import { PaymentStatus } from '../payments-expenses/domain/enums/payment-status.enum';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../auth/domain/ports/permission-resolver.port';
import { hash } from '../receivables/receivable.policy';
import {
  AccountSnapshot,
  DreAccount,
  DreAccountVersion,
  DreCommand,
  DreEntry,
  DreEntryVersion,
  DrePeriod,
  EntryData,
  SourceSnapshot,
} from './dre.entity';
import {
  DRE_GROUPS,
  DreAccountDto,
  DreAccountEditDto,
  DreCloseDto,
  DreCommandDto,
  DreEntryDto,
  DreEntryEditDto,
  DreGroup,
  DreReopenDto,
  DreReportDto,
  DreScopeDto,
} from './dre.dto';
import {
  calculateDre,
  conflict,
  decimal,
  DRE_ENGINE,
  DreLineInput,
  GROUP_LABELS,
  invalid,
  month,
  months,
  scaled,
} from './dre.policy';
import type { DreReport } from './dre.report';
const SOURCE_READS = ['receivables:read', 'expenses:read', 'payments:read'];
const sourcePermission = (kind: string): string | undefined =>
  Object.assign({} as Record<string, string>, {
    receivable: 'receivables:read',
    expense: 'expenses:read',
    payment: 'payments:read',
  })[kind];
function civil(value: Date | string | null) {
  return value == null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
}
@Injectable()
export class DreService {
  constructor(
    readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
    @Inject(PERMISSION_RESOLVER) private readonly resolver: PermissionResolver,
  ) {}
  org(actor: ProjectActorContext, requested?: number) {
    const org = this.scope.resolveOrganizationFilter(actor, requested);
    if (org == null) invalid('Informe a organização.');
    return org;
  }
  async require(actor: ProjectActorContext, keys: string[]) {
    if (!(await hasAllPermissions(actor, keys, this.resolver)))
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Permissões insuficientes para a DRE.',
      });
  }
  async project(m: EntityManager, org: number, id?: number | null) {
    if (
      id != null &&
      !(await m.exists(ProjectEntity, { where: { id, organizationId: org } }))
    )
      invalid('Projeto fora da organização.');
  }
  private async command(
    f: DreScopeDto,
    dto: DreCommandDto,
    actor: ProjectActorContext,
    operation: string,
    perform: (
      m: EntityManager,
      org: number,
    ) => Promise<Record<string, unknown>>,
  ) {
    const org = this.org(actor, f.organization_id),
      fingerprint = hash({ operation, dto, project: f.project_id ?? null });
    if (dto.reason.trim().length < 5)
      invalid('Justificativa significativa obrigatória.');
    return this.ds.transaction(async (m) => {
      if (this.ds.options.type === 'mysql')
        await m.query('SELECT id FROM organizations WHERE id=? FOR UPDATE', [
          org,
        ]);
      const prior = await m.findOne(DreCommand, {
        where: { organizationId: org, commandKey: dto.command_key },
      });
      if (prior) {
        if (prior.hash !== fingerprint || prior.actorId !== actor.id)
          conflict('Chave reutilizada com conteúdo ou autor diferente.');
        return prior.result;
      }
      const result = await perform(m, org);
      await m.save(
        DreCommand,
        m.create(DreCommand, {
          organizationId: org,
          commandKey: dto.command_key,
          hash: fingerprint,
          actorId: actor.id,
          operation,
          reason: dto.reason.trim(),
          result,
          recordedAt: new Date(),
        }),
      );
      return result;
    });
  }
  async accounts(f: DreScopeDto, actor: ProjectActorContext) {
    return this.ds.manager
      .find(DreAccount, {
        where: { organizationId: this.org(actor, f.organization_id) },
        order: { code: 'ASC' },
        take: 1001,
      })
      .then((rows) => {
        if (rows.length > 1000) invalid('Limite de 1.000 contas.');
        return rows;
      });
  }
  async accountHistory(id: number, actor: ProjectActorContext) {
    const a = await this.ds.manager.findOneBy(DreAccount, { id });
    if (!a) throw new NotFoundException('Conta não encontrada.');
    this.scope.assertCanAccessProject(actor, a.organizationId);
    return {
      account: a,
      versions: await this.ds.manager.find(DreAccountVersion, {
        where: { accountId: id, organizationId: a.organizationId },
        order: { revision: 'DESC' },
      }),
    };
  }
  private async accountVersion(
    m: EntityManager,
    a: DreAccount,
    actor: ProjectActorContext,
    reason: string,
  ) {
    await m.save(
      DreAccountVersion,
      m.create(DreAccountVersion, {
        organizationId: a.organizationId,
        accountId: a.id,
        revision: a.revision,
        data: a.data,
        actorId: actor.id,
        recordedAt: new Date(),
        reason,
      }),
    );
  }
  private async insertAccount(
    m: EntityManager,
    org: number,
    dto: Omit<DreAccountDto, 'command_key' | 'reason'>,
    actor: ProjectActorContext,
    reason: string,
  ) {
    if (
      await m.exists(DreAccount, {
        where: { organizationId: org, code: dto.code },
      })
    )
      conflict('Código de conta já cadastrado.');
    if (dto.name.trim().length < 3) invalid('Nome de conta obrigatório.');
    if (dto.parent_id) {
      const p = await m.findOneBy(DreAccount, {
        id: dto.parent_id,
        organizationId: org,
      });
      if (!p || !p.data.active || p.data.posting || p.data.group !== dto.group)
        invalid('Conta pai deve ser agrupadora ativa do mesmo grupo.');
      await this.accountSnapshot(m, p);
    }
    const a = await m.save(
      DreAccount,
      m.create(DreAccount, {
        organizationId: org,
        code: dto.code,
        revision: 1,
        data: {
          name: dto.name.trim(),
          group: dto.group,
          parent_id: dto.parent_id ?? null,
          posting: dto.posting,
          active: true,
        },
      }),
    );
    a.id = Number(a.id);
    await this.accountVersion(m, a, actor, reason);
    return a;
  }
  createAccount(
    f: DreScopeDto,
    dto: DreAccountDto,
    actor: ProjectActorContext,
  ) {
    return this.command(f, dto, actor, 'account-create', (m, org) =>
      this.insertAccount(m, org, dto, actor, dto.reason).then((a) => ({
        ...a,
      })),
    );
  }
  editAccount(
    id: number,
    f: DreScopeDto,
    dto: DreAccountEditDto,
    actor: ProjectActorContext,
  ) {
    return this.command(f, dto, actor, 'account-edit:' + id, async (m, org) => {
      const a = await m.findOneBy(DreAccount, { id, organizationId: org });
      if (!a) throw new NotFoundException('Conta não encontrada.');
      if (a.revision !== dto.revision) conflict('Conta alterada. Atualize.');
      if (dto.name.trim().length < 3) invalid('Nome obrigatório.');
      a.revision++;
      a.data = { ...a.data, name: dto.name.trim(), active: dto.active };
      await m
        .createQueryBuilder()
        .update(DreAccount)
        .set({ revision: a.revision, data: () => ':data' })
        .where('id=:id AND organization_id=:org', {
          id,
          org,
          data: JSON.stringify(a.data),
        })
        .execute();
      await this.accountVersion(m, a, actor, dto.reason);
      return { ...a };
    });
  }
  bootstrap(f: DreScopeDto, dto: DreCommandDto, actor: ProjectActorContext) {
    return this.command(f, dto, actor, 'accounts-bootstrap', async (m, org) => {
      if (await m.count(DreAccount, { where: { organizationId: org } }))
        conflict(
          'O plano sugerido só pode ser publicado em organização sem contas.',
        );
      const children: Record<DreGroup, string[]> = {
        revenue: ['Receita de serviços', 'Outras receitas operacionais'],
        deductions: [
          'Tributos sobre receitas',
          'Descontos e abatimentos',
          'Devoluções e cancelamentos',
        ],
        direct_cost: [
          'Equipes de campo',
          'Deslocamento',
          'Hospedagem',
          'Alimentação',
          'Materiais',
          'Outros custos diretos',
        ],
        operating_expense: [
          'Administrativas',
          'Comerciais',
          'Tecnologia',
          'Serviços de terceiros',
          'Outras despesas operacionais',
        ],
        financial_income: ['Receitas financeiras'],
        financial_expense: ['Despesas financeiras'],
        income_tax: ['Tributos sobre lucro reconhecidos'],
      };
      let index = 0;
      for (const group of DRE_GROUPS) {
        const code = String(++index),
          parent = await this.insertAccount(
            m,
            org,
            { code, name: GROUP_LABELS[group], group, posting: false },
            actor,
            dto.reason,
          );
        let n = 0;
        for (const name of children[group])
          await this.insertAccount(
            m,
            org,
            {
              code: code + '.' + String(++n).padStart(2, '0'),
              name,
              group,
              parent_id: parent.id,
              posting: true,
            },
            actor,
            dto.reason,
          );
      }
      return {
        published: true,
        accounts: await m.count(DreAccount, { where: { organizationId: org } }),
      };
    });
  }
  private async accountSnapshot(
    m: EntityManager,
    a: DreAccount,
  ): Promise<AccountSnapshot> {
    const path = [a.code + ' ' + a.data.name],
      seen = new Set([a.id]);
    let p = a.data.parent_id;
    while (p) {
      if (seen.has(p) || seen.size >= 6)
        invalid('Hierarquia cíclica ou maior que seis níveis.');
      seen.add(p);
      const parent = await m.findOneBy(DreAccount, {
        id: p,
        organizationId: a.organizationId,
      });
      if (!parent) invalid('Hierarquia incompleta.');
      path.unshift(parent.code + ' ' + parent.data.name);
      p = parent.data.parent_id;
    }
    return {
      id: a.id,
      revision: a.revision,
      code: a.code,
      name: a.data.name,
      group: a.data.group,
      path,
    };
  }
  async source(
    m: EntityManager,
    org: number,
    kind: string,
    id: number,
    actor: ProjectActorContext,
    write = false,
  ): Promise<SourceSnapshot> {
    const key = sourcePermission(kind);
    if (!key)
      invalid(
        'Origem não elegível. Contratos, orçamentos, baixas e prestações não geram reconhecimento automático.',
      );
    await this.require(actor, [key]);
    const lock =
      write && this.ds.options.type === 'mysql'
        ? { lock: { mode: 'pessimistic_read' as const } }
        : {};
    let project_id: number | null,
      amount: string,
      currency: string | null,
      eligible: boolean,
      description: string,
      hint_date: string | null;
    if (kind === 'receivable') {
      const r = await m.findOne(ReceivableEntity, {
        where: { id, organizationId: org },
        ...lock,
      });
      if (!r) invalid('Recebível não encontrado na organização.');
      project_id = r.projectId;
      amount = r.amount;
      currency = r.currency;
      eligible = !r.cancelled;
      description = r.data.description;
      hint_date = r.data.issued_on;
    } else if (kind === 'expense') {
      const r = await m.findOne(ExpenseEntity, {
        where: { id, organizationId: org },
        ...lock,
      });
      if (!r) invalid('Despesa não encontrada na organização.');
      project_id = Number(r.projectId);
      amount = r.amount;
      currency = null;
      eligible =
        r.status === ExpenseStatus.APPROVED || r.status === ExpenseStatus.PAID;
      description = r.description;
      hint_date = civil(r.expenseDate);
    } else {
      const r = await m.findOne(FieldAgentPaymentEntity, {
        where: { id, organizationId: org },
        ...lock,
      });
      if (!r) invalid('Pagamento não encontrado na organização.');
      project_id = Number(r.projectId);
      amount = r.finalAmount;
      currency = null;
      eligible =
        r.status === PaymentStatus.APPROVED || r.status === PaymentStatus.PAID;
      description = 'Pagamento de inventariante #' + r.id;
      hint_date = civil(r.startDate);
    }
    return {
      kind,
      id,
      key: kind + ':' + id,
      project_id,
      amount,
      currency,
      eligible,
      description,
      hint_date,
      hash: hash({ kind, id, project_id, amount, currency, eligible }),
    };
  }
  private async candidatesFrom(
    m: EntityManager,
    f: DreScopeDto,
    actor: ProjectActorContext,
  ) {
    const org = this.org(actor, f.organization_id);
    await this.project(m, org, f.project_id);
    await this.require(actor, SOURCE_READS);
    const out: SourceSnapshot[] = [];
    const rs = await m.find(ReceivableEntity, {
      where: {
        organizationId: org,
        ...(f.project_id ? { projectId: f.project_id } : {}),
      },
      take: 10001,
    });
    const es = await m.find(ExpenseEntity, {
      where: {
        organizationId: org,
        ...(f.project_id ? { projectId: f.project_id } : {}),
      },
      take: 10001,
    });
    const ps = await m.find(FieldAgentPaymentEntity, {
      where: {
        organizationId: org,
        ...(f.project_id ? { projectId: f.project_id } : {}),
      },
      take: 10001,
    });
    if (rs.length > 10000 || es.length > 10000 || ps.length > 10000)
      invalid('Refine o projeto: limite de 10.000 fontes por família.');
    for (const [kind, rows] of [
      ['receivable', rs],
      ['expense', es],
      ['payment', ps],
    ] as const)
      for (const r of rows) {
        const s = await this.source(m, org, kind, Number(r.id), actor);
        if (s.eligible && s.amount && scaled(s.amount) > 0n) out.push(s);
      }
    return out;
  }
  async candidates(f: DreScopeDto, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const pool = await this.candidatesFrom(m, f, actor),
        entries = await this.entryRows(m, f, actor),
        byKey = new Map(
          entries.filter((e) => e.sourceKey).map((e) => [e.sourceKey, e]),
        );
      const rows = pool.map((s) => ({
        ...s,
        entry_id: byKey.get(s.key)?.id ?? null,
        recognition_status: byKey.get(s.key)?.data.status ?? 'unclassified',
      }));
      return {
        items: rows.slice((f.page - 1) * f.page_size, f.page * f.page_size),
        total: rows.length,
        page: f.page,
        page_size: f.page_size,
        note: 'Datas de origem são referências documentais, não competências. Contratos, orçamentos, recebimentos e prestações agrupadoras não são novas receitas/custos.',
      };
    });
  }
  private async entryRows(
    m: EntityManager,
    f: DreScopeDto,
    actor: ProjectActorContext,
  ) {
    const org = this.org(actor, f.organization_id);
    await this.project(m, org, f.project_id);
    const rows = await m.find(DreEntry, {
      where: {
        organizationId: org,
        ...(f.project_id ? { projectId: f.project_id } : {}),
      },
      order: { id: 'DESC' },
      take: 10001,
    });
    if (rows.length > 10000)
      invalid('Refine o projeto: limite de 10.000 fatos econômicos.');
    return rows;
  }
  async entries(f: DreScopeDto, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const rows = await this.entryRows(m, f, actor);
      return {
        items: rows.slice((f.page - 1) * f.page_size, f.page * f.page_size),
        total: rows.length,
        page: f.page,
        page_size: f.page_size,
      };
    });
  }
  async detail(id: number, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const e = await m.findOneBy(DreEntry, { id });
      if (!e) throw new NotFoundException('Reconhecimento não encontrado.');
      this.scope.assertCanAccessProject(actor, e.organizationId);
      return {
        ...e,
        versions: await m.find(DreEntryVersion, {
          where: { entryId: id, organizationId: e.organizationId },
          order: { revision: 'DESC' },
        }),
      };
    });
  }
  private async unlocked(m: EntityManager, org: number, competences: string[]) {
    for (const c of new Set(competences)) {
      month(c);
      if (
        await m.exists(DrePeriod, {
          where: { organizationId: org, month: c, closed: true },
        })
      )
        conflict(
          'Competência ' +
            c +
            ' fechada. Reabra com autorização antes de ajustar.',
        );
    }
  }
  private async entryData(
    m: EntityManager,
    org: number,
    dto: DreEntryDto,
    actor: ProjectActorContext,
  ): Promise<EntryData> {
    if (
      dto.description.trim().length < 3 ||
      dto.event_document.trim().length < 5 ||
      dto.economic_key.trim().length < 3
    )
      invalid('Descrição, documento do evento e chave econômica obrigatórios.');
    let source: SourceSnapshot;
    if (dto.source_kind === 'manual') {
      if (dto.source_id) invalid('Origem manual não admite ID financeiro.');
      await this.project(m, org, dto.project_id);
      source = {
        kind: 'manual',
        id: null,
        key: null,
        project_id: dto.project_id ?? null,
        amount: null,
        currency: dto.currency,
        eligible: true,
        description: dto.event_document,
        hint_date: null,
        hash: hash({
          manual: dto.economic_key.trim(),
          project: dto.project_id ?? null,
          currency: dto.currency,
        }),
      };
    } else {
      if (!dto.source_id) invalid('ID de origem obrigatório.');
      source = await this.source(
        m,
        org,
        dto.source_kind,
        dto.source_id,
        actor,
        true,
      );
      if (source.project_id !== (dto.project_id ?? null))
        invalid('Projeto deve corresponder à origem.');
      if (source.currency && source.currency !== dto.currency)
        invalid('Moeda diverge da origem.');
      if (!source.currency && (dto.currency_reason ?? '').trim().length < 5)
        invalid(
          'A origem não informa moeda. Declare a moeda e justifique documentalmente.',
        );
      if (!source.eligible && dto.status === 'recognized')
        invalid(
          'Origem não elegível para novo reconhecimento. Use exclusão/estorno gerencial justificado.',
        );
    }
    const allocations: EntryData['allocations'] = [];
    let total = 0n;
    const seen = new Set<string>();
    if (['draft', 'recognized'].includes(dto.status) && !dto.allocations.length)
      invalid('Informe pelo menos uma competência.');
    for (const a of dto.allocations) {
      month(a.month);
      const amount = scaled(a.amount);
      if (amount <= 0n) invalid('Valores devem ser positivos.');
      total += amount;
      const k = a.month + ':' + (a.account_id ?? 'null');
      if (seen.has(k))
        invalid('Competência/conta repetida. Consolide o valor.');
      seen.add(k);
      let account: AccountSnapshot | null = null;
      if (a.account_id) {
        const c = await m.findOneBy(DreAccount, {
          id: a.account_id,
          organizationId: org,
        });
        if (!c || !c.data.active || !c.data.posting)
          invalid('Conta não é analítica ativa desta organização.');
        account = await this.accountSnapshot(m, c);
        if (
          dto.source_kind === 'receivable' &&
          !['revenue', 'financial_income'].includes(account.group)
        )
          invalid(
            'Recebível deve ser classificado em receita. Deduções requerem fato documental próprio.',
          );
        if (
          ['expense', 'payment'].includes(dto.source_kind) &&
          ['revenue', 'financial_income'].includes(account.group)
        )
          invalid('Gasto não pode ser classificado como receita.');
      }
      allocations.push({ month: a.month, amount: decimal(amount), account });
    }
    if (total > 999999999999999n) invalid('Total acima do limite monetário.');
    if (source.amount && total > scaled(source.amount))
      invalid('Reconhecimento supera o valor documental da origem.');
    return {
      economic_key: dto.economic_key.trim(),
      event_document: dto.event_document.trim(),
      description: dto.description.trim(),
      currency: dto.currency,
      currency_reason: dto.currency_reason?.trim() ?? '',
      status: dto.status,
      source,
      allocations,
    };
  }
  private async version(
    m: EntityManager,
    e: DreEntry,
    actor: ProjectActorContext,
    reason: string,
  ) {
    await m.save(
      DreEntryVersion,
      m.create(DreEntryVersion, {
        organizationId: e.organizationId,
        entryId: e.id,
        revision: e.revision,
        data: e.data,
        hash: hash(e.data),
        actorId: actor.id,
        recordedAt: new Date(),
        reason,
      }),
    );
  }
  createEntry(f: DreScopeDto, dto: DreEntryDto, actor: ProjectActorContext) {
    return this.command(f, dto, actor, 'entry-create', async (m, org) => {
      const data = await this.entryData(m, org, dto, actor);
      await this.unlocked(
        m,
        org,
        data.allocations.map((a) => a.month),
      );
      if (
        (await m.exists(DreEntry, {
          where: { organizationId: org, economicKey: data.economic_key },
        })) ||
        (data.source.key &&
          (await m.exists(DreEntry, {
            where: { organizationId: org, sourceKey: data.source.key },
          })))
      )
        conflict(
          'Fato econômico/origem já possui classificação. Ajuste o registro existente.',
        );
      const e = await m.save(
        DreEntry,
        m.create(DreEntry, {
          organizationId: org,
          projectId: data.source.project_id,
          economicKey: data.economic_key,
          sourceKey: data.source.key,
          revision: 1,
          data,
        }),
      );
      e.id = Number(e.id);
      await this.version(m, e, actor, dto.reason);
      return { ...e };
    });
  }
  editEntry(
    id: number,
    f: DreScopeDto,
    dto: DreEntryEditDto,
    actor: ProjectActorContext,
  ) {
    return this.command(f, dto, actor, 'entry-adjust:' + id, async (m, org) => {
      const e = await m.findOneBy(DreEntry, { id, organizationId: org });
      if (!e) throw new NotFoundException('Reconhecimento não encontrado.');
      if (e.revision !== dto.revision)
        conflict('Reconhecimento alterado. Atualize.');
      if (
        e.data.source.kind !== dto.source_kind ||
        e.data.source.id !== (dto.source_id ?? null) ||
        e.economicKey !== dto.economic_key.trim() ||
        e.projectId !== (dto.project_id ?? null) ||
        e.data.currency !== dto.currency
      )
        conflict(
          'Identidade econômica, projeto, origem e moeda são imutáveis.',
        );
      const data = await this.entryData(m, org, dto, actor);
      await this.unlocked(
        m,
        org,
        [...e.data.allocations, ...data.allocations].map((a) => a.month),
      );
      e.data = data;
      e.revision++;
      const result = await m
        .createQueryBuilder()
        .update(DreEntry)
        .set({ revision: e.revision, data: () => ':data' })
        .where('id=:id AND organization_id=:org AND revision=:old', {
          id,
          org,
          old: dto.revision,
          data: JSON.stringify(data),
        })
        .execute();
      if (result.affected !== 1) conflict('Conflito de revisão.');
      await this.version(m, e, actor, dto.reason);
      return { ...e };
    });
  }
  async periods(f: DreScopeDto, actor: ProjectActorContext) {
    const periods = await this.ds.manager.find(DrePeriod, {
      where: { organizationId: this.org(actor, f.organization_id) },
      order: { month: 'DESC' },
      take: 1000,
    });
    return periods.map((p) => ({
      ...p,
      data: { ...p.data, snapshot: { complete: p.data.snapshot.complete } },
    }));
  }
  async periodDetail(c: string, f: DreScopeDto, actor: ProjectActorContext) {
    month(c);
    await this.require(actor, SOURCE_READS);
    const org = this.org(actor, f.organization_id);
    return {
      period: await this.ds.manager.findOneBy(DrePeriod, {
        organizationId: org,
        month: c,
      }),
      history: await this.ds.manager
        .find(DreCommand, {
          where: { organizationId: org },
          order: { id: 'DESC' },
          take: 10000,
        })
        .then((rows) =>
          rows.filter(
            (r) =>
              r.operation === 'period-close:' + c ||
              r.operation === 'period-reopen:' + c,
          ),
        ),
    };
  }
  close(
    c: string,
    f: DreScopeDto,
    dto: DreCloseDto,
    actor: ProjectActorContext,
  ) {
    month(c);
    return this.command(f, dto, actor, 'period-close:' + c, async (m, org) => {
      if (f.project_id)
        invalid('Fechamento é organizacional: retire o filtro de projeto.');
      if (c >= new Date().toISOString().slice(0, 7))
        invalid('Fechamento exige mês civil encerrado.');
      if (dto.policy_reference.trim().length < 10)
        invalid('Referência de política aprovada obrigatória.');
      let p = await m.findOneBy(DrePeriod, { organizationId: org, month: c });
      if (p?.closed) conflict('Competência já fechada.');
      if ((p?.revision ?? 0) !== dto.revision)
        conflict('Competência alterada. Atualize.');
      const cert = {
        currency: dto.currency,
        reviewed_groups: dto.reviewed_groups,
        sources_reviewed: dto.sources_reviewed,
      };
      const report = await this.reportFrom(
        m,
        {
          organization_id: org,
          start_month: c,
          end_month: c,
          page: 1,
          page_size: 20,
        },
        actor,
        cert,
      );
      if (!report.complete && !dto.allow_incomplete)
        conflict(
          'Apuração incompleta. Classifique pendências ou autorize explicitamente fechamento parcial na política.',
        );
      const data = {
        currency: dto.currency,
        policy_reference: dto.policy_reference.trim(),
        reviewed_groups: dto.reviewed_groups,
        sources_reviewed: dto.sources_reviewed,
        allow_incomplete: dto.allow_incomplete,
        snapshot: report as unknown as Record<string, unknown>,
        hash: hash(report),
      };
      if (!p) {
        p = await m.save(
          DrePeriod,
          m.create(DrePeriod, {
            organizationId: org,
            month: c,
            revision: 1,
            closed: true,
            data,
          }),
        );
        p.id = Number(p.id);
      } else {
        p.revision++;
        p.closed = true;
        p.data = data;
        await m
          .createQueryBuilder()
          .update(DrePeriod)
          .set({ revision: p.revision, closed: true, data: () => ':data' })
          .where('id=:id', { id: p.id, data: JSON.stringify(data) })
          .execute();
      }
      return { ...p };
    });
  }
  reopen(
    c: string,
    f: DreScopeDto,
    dto: DreReopenDto,
    actor: ProjectActorContext,
  ) {
    month(c);
    return this.command(f, dto, actor, 'period-reopen:' + c, async (m, org) => {
      const p = await m.findOneBy(DrePeriod, { organizationId: org, month: c });
      if (!p || !p.closed || p.revision !== dto.revision)
        conflict('Competência não fechada ou revisão divergente.');
      p.closed = false;
      p.revision++;
      await m.update(
        DrePeriod,
        { id: p.id, organizationId: org },
        { closed: false, revision: p.revision },
      );
      return { ...p };
    });
  }
  async report(f: DreReportDto, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', (m) =>
      this.reportFrom(m, f, actor),
    );
  }
  async reportFrom(
    m: EntityManager,
    f: DreReportDto,
    actor: ProjectActorContext,
    cert?: {
      currency: string;
      reviewed_groups: DreGroup[];
      sources_reviewed: boolean;
    },
  ): Promise<DreReport> {
    const range = months(f.start_month, f.end_month),
      org = this.org(actor, f.organization_id);
    await this.project(m, org, f.project_id);
    const entries = await this.entryRows(m, f, actor),
      periods = await m.find(DrePeriod, { where: { organizationId: org } }),
      canSources = await hasAllPermissions(actor, SOURCE_READS, this.resolver);
    const pool = canSources ? await this.candidatesFrom(m, f, actor) : [],
      seen = new Map(
        entries.filter((e) => e.sourceKey).map((e) => [e.sourceKey, e]),
      );
    const pending = pool.flatMap((s) => {
        const e = seen.get(s.key);
        if (e && ['excluded', 'void'].includes(e.data.status)) return [];
        const allocated =
          e?.data.status === 'recognized'
            ? e.data.allocations.reduce((sum, a) => sum + scaled(a.amount), 0n)
            : 0n;
        const remaining = scaled(s.amount ?? '0.00') - allocated;
        return !e || e.data.status === 'draft' || remaining > 0n
          ? [
              {
                ...s,
                remaining_amount: decimal(remaining > 0n ? remaining : 0n),
              },
            ]
          : [];
      }),
      stale = pool.filter((s) => {
        const e = seen.get(s.key);
        return e && e.data.source.hash !== s.hash;
      });
    if (canSources)
      for (const e of entries)
        if (
          e.sourceKey &&
          !pool.some((s) => s.key === e.sourceKey) &&
          !['void', 'excluded'].includes(e.data.status)
        ) {
          try {
            const s = await this.source(
              m,
              org,
              e.data.source.kind,
              e.data.source.id!,
              actor,
            );
            if (s.hash !== e.data.source.hash) stale.push(s);
          } catch {
            stale.push({
              ...e.data.source,
              eligible: false,
              description:
                'Origem removida ou indisponível: revisão necessária.',
            });
          }
        }
    const rows: DreLineInput[] = [],
      unclassified: Array<Record<string, unknown>> = [];
    for (const e of entries)
      for (const a of e.data.allocations)
        if (
          range.includes(a.month) &&
          ['recognized', 'draft'].includes(e.data.status)
        ) {
          if (e.data.status === 'draft') {
            unclassified.push({
              entry_id: e.id,
              account_code: a.account?.code ?? null,
              month: a.month,
              amount: a.amount,
              currency: e.data.currency,
              reason: 'Reconhecimento em rascunho',
              description: e.data.description,
            });
            continue;
          }
          const r = {
            entry_id: e.id,
            revision: e.revision,
            month: a.month,
            currency: e.data.currency,
            project_id: e.projectId,
            amount: a.amount,
            group: a.account?.group ?? null,
            account_code: a.account?.code ?? null,
            account_name: a.account?.path.join(' / ') ?? null,
            description: e.data.description,
            source_key: e.sourceKey,
          };
          rows.push(r);
          if (!r.group)
            unclassified.push({ ...r, reason: 'Conta não definida' });
        }
    if (rows.length > 50000)
      invalid('Limite de 50.000 alocações. Refine período/projeto.');
    const certFor = (c: string, currency: string) => {
      const p = periods.find((p) => p.month === c && p.closed);
      const candidate =
        cert ??
        (p
          ? {
              currency: p.data.currency,
              reviewed_groups: p.data.reviewed_groups,
              sources_reviewed: p.data.sources_reviewed,
            }
          : null);
      return candidate?.currency === currency
        ? candidate
        : { reviewed_groups: [] as DreGroup[], sources_reviewed: false };
    };
    const currencies = [
      ...new Set([
        ...rows.map((r) => r.currency),
        ...unclassified.map((r) => String(r.currency)),
        ...(cert
          ? [cert.currency]
          : periods
              .filter((p) => p.closed && range.includes(p.month))
              .map((p) => p.data.currency)),
      ]),
    ];
    const gaps =
      pending.length > 0 ||
      stale.length > 0 ||
      !canSources ||
      unclassified.length > 0;
    const totals = currencies.map((currency) => {
      const reviewed = DRE_GROUPS.filter((g) =>
        range.every(
          (c) =>
            certFor(c, currency).sources_reviewed &&
            certFor(c, currency).reviewed_groups.includes(g),
        ),
      );
      return {
        currency,
        ...calculateDre(
          rows.filter((r) => r.currency === currency),
          reviewed,
          gaps,
        ),
      };
    });
    const monthly = range.flatMap((c) =>
      currencies.map((currency) => ({
        month: c,
        currency,
        closed: periods.find((p) => p.month === c)?.closed ?? false,
        ...calculateDre(
          rows.filter((r) => r.month === c && r.currency === currency),
          certFor(c, currency).sources_reviewed
            ? certFor(c, currency).reviewed_groups
            : [],
          gaps,
        ),
      })),
    );
    const byProject = [...new Set(rows.map((r) => r.project_id))].flatMap(
      (project_id) =>
        currencies.map((currency) => ({
          project_id,
          currency,
          ...calculateDre(
            rows.filter(
              (r) => r.project_id === project_id && r.currency === currency,
            ),
            DRE_GROUPS.filter((g) =>
              range.every(
                (c) =>
                  certFor(c, currency).sources_reviewed &&
                  certFor(c, currency).reviewed_groups.includes(g),
              ),
            ),
            gaps,
          ),
        })),
    );
    const warnings = [
      'DRE gerencial por competência explícita; não é demonstração contábil oficial.',
      'Valores apurados parciais não são lucro definitivo. Ausência de cobertura não equivale a zero.',
      'Datas financeiras são referências documentais; não atribuem competência automaticamente.',
    ];
    if (pending.length)
      warnings.push(
        'Fontes sem reconhecimento: competência desconhecida, apresentadas fora dos resultados independentemente do período consultado.',
      );
    if (!canSources)
      warnings.push(
        'Cobertura de fontes indisponível por falta de leituras específicas.',
      );
    if (stale.length)
      warnings.push(
        'Origens econômicas alteradas requerem revisão explícita do reconhecimento.',
      );
    const report = {
      engine_version: DRE_ENGINE,
      organization_id: org,
      filters: f,
      generated_at: new Date().toISOString(),
      complete: totals.length > 0 && totals.every((t) => t.complete),
      totals,
      monthly,
      by_project: byProject,
      rows,
      unclassified,
      pending_sources: pending,
      stale_sources: stale,
      source_permissions: canSources ? SOURCE_READS : [],
      warnings,
      periods: periods
        .filter((p) => range.includes(p.month))
        .map((p) => ({
          month: p.month,
          revision: p.revision,
          closed: p.closed,
          closure_hash: p.data.hash,
          policy_reference: p.data.policy_reference,
        })),
      entry_versions: entries.map((e) => ({
        id: e.id,
        revision: e.revision,
        hash: hash(e.data),
      })),
    };
    if (f.compare_start_month || f.compare_end_month) {
      if (!f.compare_start_month || !f.compare_end_month)
        invalid('Informe as duas competências de comparação.');
      if (
        months(f.compare_start_month, f.compare_end_month).length !==
        range.length
      )
        invalid('Comparação exige períodos com a mesma quantidade de meses.');
      const comparison = await this.reportFrom(
        m,
        {
          ...f,
          start_month: f.compare_start_month,
          end_month: f.compare_end_month,
          compare_start_month: undefined,
          compare_end_month: undefined,
        },
        actor,
      );
      return {
        ...report,
        comparison: {
          start_month: f.compare_start_month,
          end_month: f.compare_end_month,
          totals: comparison.totals,
        },
      };
    }
    return { ...report, comparison: null };
  }
}
