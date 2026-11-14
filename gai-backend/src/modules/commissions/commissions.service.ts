import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import type { FinancialEvent } from '../../common/finance/financial-event';
import { UserRole } from '../auth/domain/enums/user.enums';
import { ContractEntity } from '../contracts/contract.entity';
import { civilToday } from '../finance-settings/finance-settings.policy';
import {
  normalizeCivilDate,
  AssetTagRuleError,
} from '../asset-tags/asset-tag.formulas';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import {
  CommissionRuleError,
  commissionAmount,
  commissionStatus,
  partnerKey,
} from './commission.formulas';
import type {
  CommissionInputDto,
  CommissionQueryDto,
  PartnerInputDto,
} from './commission.dto';
import {
  CommissionAuditLogEntity,
  CommissionEntity,
  CommissionPartnerEntity,
} from './commission.entity';

export interface CommissionActor {
  id: number;
  systemRoles: string[];
  organizationId: number | null;
}

const LIMIT = 5000;
const OPEN_PROJECT = ['draft', 'active', 'paused'];
const civil = (v: Date | string | null | undefined) =>
  v == null
    ? null
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : String(v).slice(0, 10);
/** Decimal do banco (texto no MySQL, número no SQLite) → "0.00". */
const money = (v: string | number) => {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(String(v));
  if (!m) throw new Error(`Valor inválido: ${String(v)}`);
  return `${m[1]}.${(m[2] ?? '').padEnd(2, '0').slice(0, 2)}`;
};
const sum = (values: string[]) => {
  const c = values.reduce((s, v) => {
    const [w, f = ''] = v.split('.');
    return s + BigInt(w) * 100n + BigInt(f.padEnd(2, '0'));
  }, 0n);
  return `${c / 100n}.${String(c % 100n).padStart(2, '0')}`;
};
const partnerLabel = (p: { name: string; company: string | null }) =>
  p.company ? `${p.name} (${p.company})` : p.name;

const FIELD_LABEL: Record<string, string> = {
  project_id: 'Contrato',
  partner_id: 'Parceiro',
  contract_value: 'Valor do contrato',
  percent: '% comissão',
  amount_manual: 'Valor da comissão',
  expected_payment_on: 'Data prevista',
  paid_on: 'Data de pagamento',
  notes: 'Observação',
};

/** Comissões e parceiros (doc 06 §6, etapa 6). */
@Injectable()
export class CommissionsService {
  constructor(private readonly ds: DataSource) {}

  organization(actor: CommissionActor): number {
    if (
      actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
      !actor.organizationId
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Selecione uma organização para consultar as comissões.',
      });
    return actor.organizationId;
  }

  /** Valor do projeto = soma dos contratos vigentes (o que a tela usa ao trocar o contrato). */
  private async projectValues(organizationId: number, projectIds?: number[]) {
    const contracts = await this.ds.getRepository(ContractEntity).find({
      where: {
        organizationId,
        ...(projectIds
          ? { projectId: In(projectIds.length ? projectIds : [0]) }
          : {}),
      },
    });
    const out = new Map<number, { value: string; contractId: number | null }>();
    const live = contracts.filter(
      (c) => !['cancelled', 'archived'].includes(c.data.status),
    );
    for (const id of new Set(live.map((c) => Number(c.projectId)))) {
      const own = live.filter((c) => Number(c.projectId) === id);
      out.set(id, {
        value: sum(
          own.map((c) =>
            money(c.data.current_value ?? c.data.original_value ?? '0'),
          ),
        ),
        contractId: own.length === 1 ? Number(own[0].id) : null,
      });
    }
    return out;
  }

  async list(filters: CommissionQueryDto, actor: CommissionActor) {
    const organizationId = this.organization(actor);
    const today = civilToday();
    const rows = await this.ds.getRepository(CommissionEntity).find({
      where: {
        organizationId,
        ...(filters.project_id ? { projectId: filters.project_id } : {}),
        ...(filters.partner_id ? { partnerId: filters.partner_id } : {}),
      },
      take: LIMIT + 1,
    });
    if (rows.length > LIMIT)
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `Mais de ${LIMIT} comissões; filtre.`,
      });
    const projects = await this.ds
      .getRepository(ProjectEntity)
      .find({ where: { organizationId } });
    const partners = await this.ds
      .getRepository(CommissionPartnerEntity)
      .find({ where: { organizationId }, order: { name: 'ASC' } });
    const values = await this.projectValues(organizationId);
    const name = new Map(projects.map((p) => [Number(p.id), p.name]));
    const items = rows
      .map((c) => this.row(c, name, today))
      .filter((r) => !filters.status || r.status === filters.status)
      // Ordenada pela data prevista (sem previsão por último).
      .sort(
        (a, b) =>
          (a.expected_payment_on ?? '9999').localeCompare(
            b.expected_payment_on ?? '9999',
          ) || a.id - b.id,
      );
    const of = (status: string) => items.filter((r) => r.status === status);
    return {
      today,
      kpis: {
        total: sum(items.map((r) => r.amount)),
        paid: sum(of('paid').map((r) => r.amount)),
        pending: sum(of('pending').map((r) => r.amount)),
        overdue: sum(of('overdue').map((r) => r.amount)),
        overdue_count: of('overdue').length,
      },
      totals: {
        count: items.length,
        contract_value: sum(items.map((r) => r.contract_value)),
        amount: sum(items.map((r) => r.amount)),
      },
      projects: projects
        .map((p) => ({
          id: Number(p.id),
          name: p.name,
          open: OPEN_PROJECT.includes(p.status),
          contract_value: values.get(Number(p.id))?.value ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      partners: partners.map((p) => ({
        id: Number(p.id),
        name: p.name,
        company: p.company,
        label: partnerLabel(p),
      })),
      items,
    };
  }

  private row(
    c: CommissionEntity,
    projectName: Map<number, string>,
    today: string,
  ) {
    const value = money(c.contractValue);
    const percent = money(c.percent);
    const manual = c.amountManual == null ? null : money(c.amountManual);
    const expected = civil(c.expectedPaymentOn);
    const paid = civil(c.paidOn);
    return {
      id: Number(c.id),
      project_id: Number(c.projectId),
      project_name: projectName.get(Number(c.projectId)) ?? `#${c.projectId}`,
      contract_id: c.contractId == null ? null : Number(c.contractId),
      partner_id: Number(c.partnerId),
      partner_name: c.partnerNameSnapshot,
      contract_value: value,
      percent,
      calculated_amount: commissionAmount(value, percent, null),
      amount_manual: manual,
      amount: commissionAmount(value, percent, manual),
      expected_payment_on: expected,
      paid_on: paid,
      status: commissionStatus(paid, expected, today),
      notes: c.notes,
      updated_at: new Date(c.updatedAt).toISOString(),
    };
  }

  async create(dto: CommissionInputDto, actor: CommissionActor) {
    const organizationId = this.organization(actor);
    if (!dto.project_id)
      this.invalid('project_id', 'Escolha o contrato (projeto).');
    if (!dto.partner_id) this.invalid('partner_id', 'Escolha o parceiro.');
    if (dto.percent === undefined)
      this.invalid('percent', 'Informe o % de comissão.');
    const c = this.ds.getRepository(CommissionEntity).create({
      organizationId,
      contractId: null,
      amountManual: null,
      expectedPaymentOn: null,
      paidOn: null,
      notes: null,
      createdById: actor.id,
    });
    // Sem valor informado, o valor do contrato vem do projeto.
    await this.apply(organizationId, c, dto, actor);
    return this.save(organizationId, c, null, 'CREATE', actor);
  }

  async update(id: number, dto: CommissionInputDto, actor: CommissionActor) {
    const organizationId = this.organization(actor);
    const c = await this.find(organizationId, id);
    const before = { ...c };
    await this.apply(organizationId, c, dto, actor);
    return this.save(organizationId, c, before, 'UPDATE', actor);
  }

  async remove(id: number, actor: CommissionActor) {
    const organizationId = this.organization(actor);
    const c = await this.find(organizationId, id);
    await this.ds.transaction(async (m) => {
      await m.getRepository(CommissionEntity).softDelete({ id });
      await this.audit(
        m,
        organizationId,
        actor,
        'DELETE',
        { commissionId: id },
        {
          deleted: { before: false, after: true },
          amount_manual: { before: c.amountManual, after: null },
        },
      );
    });
    return { id };
  }

  private async apply(
    organizationId: number,
    c: CommissionEntity,
    dto: CommissionInputDto,
    actor: CommissionActor,
  ) {
    try {
      if (dto.project_id !== undefined) {
        const project = await this.ds
          .getRepository(ProjectEntity)
          .findOneBy({ id: dto.project_id, organizationId });
        if (!project) this.invalid('project_id', 'Projeto não encontrado.');
        const changed = Number(c.projectId) !== dto.project_id;
        c.projectId = dto.project_id;
        const info = (
          await this.projectValues(organizationId, [dto.project_id])
        ).get(dto.project_id);
        c.contractId = info?.contractId ?? null;
        // Trocar o contrato atualiza o valor do contrato com o valor do projeto.
        if (
          dto.contract_value === undefined &&
          (changed || c.contractValue == null)
        ) {
          if (!info)
            this.invalid(
              'contract_value',
              'O projeto não tem contrato vigente; informe o valor do contrato.',
            );
          c.contractValue = info.value;
        }
      }
      if (dto.partner_id !== undefined) {
        const partner = await this.ds
          .getRepository(CommissionPartnerEntity)
          .findOneBy({ id: dto.partner_id, organizationId });
        if (!partner) this.invalid('partner_id', 'Parceiro não encontrado.');
        c.partnerId = dto.partner_id;
        c.partnerNameSnapshot = partnerLabel(partner);
      }
      if (dto.contract_value !== undefined)
        c.contractValue = dto.contract_value;
      if (dto.percent !== undefined) c.percent = dto.percent;
      if (dto.amount_manual !== undefined) c.amountManual = dto.amount_manual;
      if (dto.expected_payment_on !== undefined)
        c.expectedPaymentOn = normalizeCivilDate(dto.expected_payment_on);
      if (dto.paid_on !== undefined) c.paidOn = normalizeCivilDate(dto.paid_on);
      if (dto.notes !== undefined) c.notes = dto.notes?.trim() || null;
      commissionAmount(
        money(c.contractValue),
        money(c.percent),
        c.amountManual == null ? null : money(c.amountManual),
      );
      c.updatedById = actor.id;
    } catch (error) {
      if (
        error instanceof CommissionRuleError ||
        error instanceof AssetTagRuleError
      )
        this.invalid('form', error.message);
      throw error;
    }
  }

  private async save(
    organizationId: number,
    c: CommissionEntity,
    before: CommissionEntity | null,
    operation: 'CREATE' | 'UPDATE',
    actor: CommissionActor,
  ) {
    const snap = (e: CommissionEntity | null) =>
      e
        ? {
            project_id: e.projectId == null ? null : Number(e.projectId),
            partner_id: e.partnerId == null ? null : Number(e.partnerId),
            contract_value:
              e.contractValue == null ? null : money(e.contractValue),
            percent: e.percent == null ? null : money(e.percent),
            amount_manual:
              e.amountManual == null ? null : money(e.amountManual),
            expected_payment_on: civil(e.expectedPaymentOn),
            paid_on: civil(e.paidOn),
            notes: e.notes,
          }
        : null;
    const a = snap(before);
    const b = snap(c)!;
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(b) as Array<keyof typeof b>)
      if (JSON.stringify(a?.[key] ?? null) !== JSON.stringify(b[key] ?? null))
        changes[key] = { before: a?.[key] ?? null, after: b[key] };
    const saved = await this.ds.transaction(async (m) => {
      const row = await m.getRepository(CommissionEntity).save(c);
      if (Object.keys(changes).length)
        await this.audit(
          m,
          organizationId,
          actor,
          operation,
          { commissionId: Number(row.id) },
          changes,
        );
      return row;
    });
    return {
      id: Number(saved.id),
      changed: Object.keys(changes).map((k) => FIELD_LABEL[k] ?? k),
    };
  }

  // ───────────── parceiros ─────────────

  async partners(actor: CommissionActor) {
    const organizationId = this.organization(actor);
    const rows = await this.ds
      .getRepository(CommissionPartnerEntity)
      .find({ where: { organizationId }, order: { name: 'ASC' } });
    const counts = await this.ds
      .getRepository(CommissionEntity)
      .createQueryBuilder('c')
      .select('c.partnerId', 'partner_id')
      .addSelect('COUNT(*)', 'n')
      .where('c.organizationId = :organizationId', { organizationId })
      .groupBy('c.partnerId')
      .getRawMany<{ partner_id: number | string; n: number | string }>();
    const n = new Map(counts.map((r) => [Number(r.partner_id), Number(r.n)]));
    return rows.map((p) => ({
      id: Number(p.id),
      name: p.name,
      company: p.company,
      label: partnerLabel(p),
      commissions: n.get(Number(p.id)) ?? 0,
    }));
  }

  /** Cadastro sem duplicar (nome + empresa, sem acento/caixa); re-cadastrar um excluído o restaura. */
  async createPartner(dto: PartnerInputDto, actor: CommissionActor) {
    const organizationId = this.organization(actor);
    const name = dto.name.trim().replace(/\s+/g, ' ');
    const company = dto.company?.trim().replace(/\s+/g, ' ') || null;
    if (name.length < 2) this.invalid('name', 'Informe o nome do parceiro.');
    const key = partnerKey(name, company);
    const repo = this.ds.getRepository(CommissionPartnerEntity);
    const existing = await repo.findOne({
      where: { organizationId, nameKey: key },
      withDeleted: true,
    });
    if (existing && !existing.deletedAt)
      throw new ConflictException({
        code: 'PARTNER_DUPLICATED',
        message: `Parceiro já cadastrado: ${partnerLabel(existing)}.`,
      });
    return this.ds.transaction(async (m) => {
      const r = m.getRepository(CommissionPartnerEntity);
      let saved: CommissionPartnerEntity;
      if (existing) {
        await r.restore({ id: existing.id });
        saved = existing;
      } else
        saved = await r.save(
          r.create({
            organizationId,
            name,
            company,
            nameKey: key,
            createdById: actor.id,
          }),
        );
      await this.audit(
        m,
        organizationId,
        actor,
        existing ? 'RESTORE_PARTNER' : 'CREATE_PARTNER',
        { partnerId: Number(saved.id) },
        {
          name: { before: null, after: name },
          company: { before: null, after: company },
        },
      );
      return {
        id: Number(saved.id),
        label: partnerLabel({ name: saved.name, company: saved.company }),
      };
    });
  }

  /** Exclui o parceiro da lista; as comissões já lançadas mantêm o nome. */
  async removePartner(id: number, actor: CommissionActor) {
    const organizationId = this.organization(actor);
    const partner = await this.ds
      .getRepository(CommissionPartnerEntity)
      .findOneBy({ id, organizationId });
    if (!partner)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Parceiro não encontrado.',
      });
    await this.ds.transaction(async (m) => {
      await m.getRepository(CommissionPartnerEntity).softDelete({ id });
      await this.audit(
        m,
        organizationId,
        actor,
        'DELETE_PARTNER',
        { partnerId: id },
        {
          deleted: { before: false, after: true },
        },
      );
    });
    return { id };
  }

  /**
   * Eventos para o fluxo de caixa e a DRE (linha Comissão Comercial, doc 06 §6.3):
   * saída "Comissão — parceiro" na data de pagamento ou na prevista. Sem nenhuma
   * das duas, não há data para o fluxo e o evento fica de fora.
   */
  async events(organizationId: number): Promise<FinancialEvent[]> {
    const today = civilToday();
    const rows = await this.ds
      .getRepository(CommissionEntity)
      .find({ where: { organizationId } });
    const projects = await this.ds
      .getRepository(ProjectEntity)
      .find({ where: { organizationId } });
    const name = new Map(projects.map((p) => [Number(p.id), p.name]));
    return rows
      .map((c) => this.row(c, name, today))
      .filter((r) => r.paid_on ?? r.expected_payment_on)
      .map((r) => ({
        key: `commission:${r.id}`,
        source: 'commission' as const,
        source_id: r.id,
        project_id: r.project_id,
        direction: 'outflow' as const,
        date: (r.paid_on ?? r.expected_payment_on)!,
        realized: r.status === 'paid',
        amount: r.amount,
        dre_line: 'commercial_commission' as const,
        description: `Comissão — ${r.partner_name} (${r.project_name})`,
      }));
  }

  private async find(organizationId: number, id: number) {
    const c = await this.ds
      .getRepository(CommissionEntity)
      .findOneBy({ id, organizationId });
    if (!c)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Comissão não encontrada.',
      });
    return c;
  }

  private audit(
    m: EntityManager,
    organizationId: number,
    actor: CommissionActor,
    operation: string,
    target: { commissionId?: number; partnerId?: number },
    changes: Record<string, { before: unknown; after: unknown }>,
  ) {
    return m.getRepository(CommissionAuditLogEntity).save({
      organizationId,
      commissionId: target.commissionId ?? null,
      partnerId: target.partnerId ?? null,
      operation,
      performedBy: actor.id,
      changes,
    });
  }

  private invalid(field: string, message: string): never {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message,
      details: [{ field, message }],
    });
  }
}
