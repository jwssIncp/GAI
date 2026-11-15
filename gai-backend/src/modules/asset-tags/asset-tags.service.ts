import { assertDreMonthsOpen } from '../managerial-dre/dre-closed-period';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { assertNotFuture } from '../../common/finance/settlement-date';
import type { FinancialEvent } from '../../common/finance/financial-event';
import { UserRole } from '../auth/domain/enums/user.enums';
import { ContractEntity } from '../contracts/contract.entity';
import { FinanceSettingsService } from '../finance-settings/finance-settings.service';
import { civilToday } from '../finance-settings/finance-settings.policy';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import {
  AssetTagRuleError,
  assetTagExpenseType,
  assetTagTotals,
  centsToMoney,
  normalizeCivilDate,
  sequenceQuantity,
  settlementDate,
  toUnits,
} from './asset-tag.formulas';
import type {
  AssetTagOrderInputDto,
  AssetTagOrderQueryDto,
} from './asset-tag.dto';
import {
  AssetTagOrderAuditLogEntity,
  AssetTagOrderEntity,
} from './asset-tag-order.entity';

export interface AssetTagActor {
  id: number;
  systemRoles: string[];
  organizationId: number | null;
}

const OPEN_PROJECT = ['draft', 'active', 'paused'];
const LIMIT = 5000;
const civil = (v: Date | string | null | undefined) =>
  v == null
    ? null
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : String(v).slice(0, 10);
/** Decimal do banco (texto no MySQL, número no SQLite) com até 4 casas. */
const unit = (v: string | number) => {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(String(v));
  if (!m) throw new Error(`Valor unitário inválido: ${String(v)}`);
  return `${m[1]}.${(m[2] ?? '').padEnd(4, '0').slice(0, 4)}`;
};
const sumCents = (values: string[]) =>
  centsToMoney(
    values.reduce((s, v) => {
      const neg = v.startsWith('-');
      const [w, f = ''] = v.replace('-', '').split('.');
      const c = BigInt(w) * 100n + BigInt(f.padEnd(2, '0'));
      return s + (neg ? -c : c);
    }, 0n),
  );

const FIELD_LABEL: Record<string, string> = {
  project_id: 'Projeto',
  proposal_number: 'Nº proposta',
  ordered_on: 'Data',
  quantity: 'Quantidade',
  sequence_start: 'Sequência inicial',
  sequence_end: 'Sequência final',
  model: 'Modelo',
  supplier_name: 'Fornecedor',
  unit_cost: 'Custo unitário',
  supplier_payment_status: 'Pagamento ao fornecedor',
  supplier_expected_payment_on: 'Previsão de pagamento',
  supplier_paid_on: 'Data de pagamento',
  unit_price: 'Valor unitário ao cliente',
  client_expected_receipt_on: 'Previsão de recebimento',
  client_received_on: 'Data de recebimento',
  expense_type_override: 'Tipo de despesa',
  notes: 'Observação',
};

/** Placas de patrimônio (doc 06 §5, etapa 5). */
@Injectable()
export class AssetTagsService {
  constructor(
    private readonly ds: DataSource,
    private readonly settings: FinanceSettingsService,
  ) {}

  organization(actor: AssetTagActor): number {
    if (
      actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
      !actor.organizationId
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Selecione uma organização para consultar as placas.',
      });
    return actor.organizationId;
  }

  /** Parâmetros vigentes numa data; sem versão vigente, nada é inventado. */
  private async parametersAt(organizationId: number, date: string) {
    try {
      const v = await this.settings.valuesAt(organizationId, date);
      return {
        tag_tax_pct: v.tag_tax_pct,
        tag_models: v.tag_models,
        default_tag_supplier: v.default_tag_supplier,
      };
    } catch {
      return null;
    }
  }

  async list(filters: AssetTagOrderQueryDto, actor: AssetTagActor) {
    const organizationId = this.organization(actor);
    const today = civilToday();
    const orders = await this.ds.getRepository(AssetTagOrderEntity).find({
      where: {
        organizationId,
        ...(filters.project_id ? { projectId: filters.project_id } : {}),
      },
      order: { orderedOn: 'DESC', id: 'DESC' },
      take: LIMIT + 1,
    });
    if (orders.length > LIMIT)
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `Mais de ${LIMIT} pedidos; filtre por projeto.`,
      });
    const projects = await this.ds
      .getRepository(ProjectEntity)
      .find({ where: { organizationId } });
    const rows = await this.rows(organizationId, orders, projects);
    const term = filters.proposal?.trim().toLowerCase();
    const visible = rows.filter(
      (r) =>
        (!filters.supplier_status ||
          r.supplier_payment_status === filters.supplier_status) &&
        (!filters.received ||
          (filters.received === 'yes') === r.client_received) &&
        (!filters.expense_type ||
          (filters.expense_type === 'unclassified'
            ? r.expense_type === null
            : r.expense_type === filters.expense_type)) &&
        (!term || (r.proposal_number ?? '').toLowerCase().includes(term)),
    );
    const qty = (list: typeof visible) =>
      list.reduce((s, r) => s + r.quantity, 0);
    // Pedido sem % de impostos vigente não apaga o total: soma os calculáveis
    // e informa quantos ficaram de fora (e desde quando, para o link retroativo).
    const missing = visible.filter((r) => r.net_value === null);
    const calculable = visible.filter((r) => r.net_value !== null);
    const missingSince = missing.map((r) => r.ordered_on).sort()[0] ?? null;
    const current = await this.parametersAt(organizationId, today);
    return {
      today,
      parameters: {
        configured: current !== null,
        tag_tax_pct: current?.tag_tax_pct ?? null,
        tag_models: current?.tag_models ?? null,
        default_tag_supplier: current?.default_tag_supplier ?? null,
      },
      projects: projects
        .map((p) => ({
          id: Number(p.id),
          name: p.name,
          open: OPEN_PROJECT.includes(p.status),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      kpis: {
        purchased: qty(visible),
        supplier_pending: qty(
          visible.filter((r) => r.supplier_payment_status === 'pending'),
        ),
        to_receive: qty(visible.filter((r) => !r.client_received)),
        cost_total: sumCents(visible.map((r) => r.cost_total)),
        value_total: sumCents(visible.map((r) => r.value_total)),
        /** Soma dos pedidos calculáveis (os sem % de impostos ficam de fora). */
        net_profit: sumCents(calculable.map((r) => r.net_profit!)),
        /** Pedidos sem % de impostos vigente na data do pedido. */
        missing_tax_count: missing.length,
        /** Data do pedido mais antigo sem % (sugestão de versão retroativa). */
        missing_tax_since: missingSince,
      },
      totals: {
        count: visible.length,
        quantity: qty(visible),
        cost_total: sumCents(visible.map((r) => r.cost_total)),
        value_total: sumCents(visible.map((r) => r.value_total)),
        net_value: sumCents(calculable.map((r) => r.net_value!)),
        net_profit: sumCents(calculable.map((r) => r.net_profit!)),
        missing_tax_count: missing.length,
      },
      items: visible,
    };
  }

  private async rows(
    organizationId: number,
    orders: AssetTagOrderEntity[],
    projects: ProjectEntity[],
  ) {
    const projectIds = [...new Set(orders.map((o) => Number(o.projectId)))];
    const contracts = projectIds.length
      ? await this.ds.getRepository(ContractEntity).find({
          where: { organizationId, projectId: In(projectIds) },
        })
      : [];
    const payers = new Map<number, Array<string | null | undefined>>();
    for (const c of contracts.filter(
      (c) => !['cancelled', 'archived'].includes(c.data.status),
    ))
      payers.set(Number(c.projectId), [
        ...(payers.get(Number(c.projectId)) ?? []),
        c.data.tags_paid_by,
      ]);
    const name = new Map(projects.map((p) => [Number(p.id), p.name]));
    const taxCache = new Map<string, string | null>();
    const taxAt = async (date: string) => {
      if (!taxCache.has(date))
        taxCache.set(
          date,
          (await this.parametersAt(organizationId, date))?.tag_tax_pct ?? null,
        );
      return taxCache.get(date)!;
    };
    const out = [];
    for (const o of orders) {
      const orderedOn = civil(o.orderedOn)!;
      const projectId = Number(o.projectId);
      const unitCost = unit(o.unitCost);
      const unitPrice = unit(o.unitPrice);
      const taxPct = await taxAt(orderedOn);
      const totals = assetTagTotals({
        quantity: Number(o.quantity),
        unitCost,
        unitPrice,
        taxPct,
      });
      const contractType = assetTagExpenseType(
        payers.get(projectId) ?? [],
        null,
      );
      out.push({
        id: Number(o.id),
        project_id: projectId,
        project_name: name.get(projectId) ?? `#${projectId}`,
        proposal_number: o.proposalNumber,
        ordered_on: orderedOn,
        quantity: Number(o.quantity),
        sequence_start:
          o.sequenceStart == null ? null : Number(o.sequenceStart),
        sequence_end: o.sequenceEnd == null ? null : Number(o.sequenceEnd),
        quantity_from_sequence:
          sequenceQuantity(
            o.sequenceStart == null ? null : Number(o.sequenceStart),
            o.sequenceEnd == null ? null : Number(o.sequenceEnd),
          ).quantity !== null,
        model: o.model,
        supplier_name: o.supplierName,
        unit_cost: unitCost,
        supplier_payment_status: o.supplierPaymentStatus,
        supplier_expected_payment_on: civil(o.supplierExpectedPaymentOn),
        supplier_paid_on: civil(o.supplierPaidOn),
        unit_price: unitPrice,
        client_expected_receipt_on: civil(o.clientExpectedReceiptOn),
        client_received: o.clientReceivedOn !== null,
        client_received_on: civil(o.clientReceivedOn),
        expense_type: assetTagExpenseType(
          payers.get(projectId) ?? [],
          o.expenseTypeOverride,
        ),
        expense_type_source: o.expenseTypeOverride
          ? 'manual'
          : contractType
            ? 'contract'
            : null,
        contract_expense_type: contractType,
        tax_pct: taxPct,
        ...totals,
        notes: o.notes,
        updated_at: new Date(o.updatedAt).toISOString(),
      });
    }
    return out;
  }

  async create(dto: AssetTagOrderInputDto, actor: AssetTagActor) {
    const organizationId = this.organization(actor);
    if (!dto.project_id) this.invalid('project_id', 'Escolha o projeto.');
    if (!dto.ordered_on)
      this.invalid('ordered_on', 'Informe a data do pedido.');
    if (!dto.unit_cost) this.invalid('unit_cost', 'Informe o custo unitário.');
    if (!dto.unit_price)
      this.invalid('unit_price', 'Informe o valor unitário ao cliente.');
    const draft = this.ds.getRepository(AssetTagOrderEntity).create({
      organizationId,
      supplierPaymentStatus: 'pending',
      supplierExpectedPaymentOn: null,
      supplierPaidOn: null,
      clientExpectedReceiptOn: null,
      clientReceivedOn: null,
      expenseTypeOverride: null,
      sequenceStart: null,
      sequenceEnd: null,
      proposalNumber: null,
      model: null,
      notes: null,
      quantity: 0,
      createdById: actor.id,
    });
    const params = await this.parametersAt(organizationId, civilToday());
    if (!dto.supplier_name && params)
      dto.supplier_name = params.default_tag_supplier;
    if (!dto.supplier_name)
      this.invalid('supplier_name', 'Informe o fornecedor.');
    await this.apply(organizationId, draft, dto, actor, true);
    return this.save(organizationId, draft, null, 'CREATE', actor);
  }

  async update(id: number, dto: AssetTagOrderInputDto, actor: AssetTagActor) {
    const organizationId = this.organization(actor);
    const current = await this.find(organizationId, id);
    const before = { ...current };
    await this.apply(organizationId, current, dto, actor, false);
    return this.save(organizationId, current, before, 'UPDATE', actor);
  }

  async remove(id: number, actor: AssetTagActor) {
    const organizationId = this.organization(actor);
    const current = await this.find(organizationId, id);
    await assertDreMonthsOpen(
      this.ds.manager,
      organizationId,
      [
        current.supplierPaidOn ??
          current.supplierExpectedPaymentOn ??
          current.orderedOn,
        current.clientReceivedOn ?? current.clientExpectedReceiptOn,
      ],
      'Não é possível excluir o pedido de placas',
    );
    await this.ds.transaction(async (m) => {
      await m.getRepository(AssetTagOrderEntity).softDelete({ id });
      await m.getRepository(AssetTagOrderAuditLogEntity).save({
        organizationId,
        orderId: id,
        operation: 'DELETE',
        performedBy: actor.id,
        changes: {
          deleted: { before: false, after: true },
          quantity: { before: current.quantity, after: null },
        },
      });
    });
    return { id };
  }

  /** Aplica o formulário (criação ou edição parcial em linha) com as regras do doc 06 §5.2. */
  private async apply(
    organizationId: number,
    o: AssetTagOrderEntity,
    dto: AssetTagOrderInputDto,
    actor: AssetTagActor,
    creating: boolean,
  ) {
    const today = civilToday();
    try {
      if (dto.project_id !== undefined) {
        const project = await this.ds
          .getRepository(ProjectEntity)
          .findOneBy({ id: dto.project_id, organizationId });
        if (!project) this.invalid('project_id', 'Projeto não encontrado.');
        o.projectId = dto.project_id;
      }
      if (dto.proposal_number !== undefined)
        o.proposalNumber = dto.proposal_number?.trim() || null;
      if (dto.ordered_on !== undefined)
        o.orderedOn = normalizeCivilDate(dto.ordered_on)!;
      if (dto.model !== undefined) {
        const model = dto.model?.trim() || null;
        const params = await this.parametersAt(organizationId, today);
        if (model && params && !params.tag_models.includes(model))
          this.invalid(
            'model',
            `Modelo fora da lista: ${params.tag_models.join(', ')}.`,
          );
        o.model = model;
      }
      if (dto.supplier_name !== undefined) {
        if (!dto.supplier_name.trim())
          this.invalid('supplier_name', 'Informe o fornecedor.');
        o.supplierName = dto.supplier_name.trim();
      }
      if (dto.unit_cost !== undefined) {
        toUnits(dto.unit_cost);
        o.unitCost = dto.unit_cost;
      }
      if (dto.unit_price !== undefined) {
        toUnits(dto.unit_price);
        o.unitPrice = dto.unit_price;
      }
      if (dto.sequence_start !== undefined)
        o.sequenceStart = dto.sequence_start;
      if (dto.sequence_end !== undefined) o.sequenceEnd = dto.sequence_end;
      const seq = sequenceQuantity(
        o.sequenceStart == null ? null : Number(o.sequenceStart),
        o.sequenceEnd == null ? null : Number(o.sequenceEnd),
      );
      if (seq.error) this.invalid('sequence_end', seq.error);
      if (seq.quantity !== null)
        o.quantity = seq.quantity; // quantidade só leitura
      else if (dto.quantity !== undefined) o.quantity = dto.quantity;
      else if (creating)
        this.invalid('quantity', 'Informe a quantidade ou a sequência.');
      if (dto.supplier_expected_payment_on !== undefined)
        o.supplierExpectedPaymentOn = normalizeCivilDate(
          dto.supplier_expected_payment_on,
        );
      if (
        dto.supplier_paid !== undefined ||
        dto.supplier_paid_on !== undefined
      ) {
        o.supplierPaidOn = settlementDate(
          dto.supplier_paid,
          dto.supplier_paid_on,
          civil(o.supplierPaidOn),
          today,
        );
        assertNotFuture(
          o.supplierPaidOn,
          'A data de pagamento ao fornecedor',
          today,
        );
        o.supplierPaymentStatus = o.supplierPaidOn ? 'paid' : 'pending';
      }
      if (dto.client_expected_receipt_on !== undefined)
        o.clientExpectedReceiptOn = normalizeCivilDate(
          dto.client_expected_receipt_on,
        );
      if (
        dto.client_received !== undefined ||
        dto.client_received_on !== undefined
      )
        o.clientReceivedOn = settlementDate(
          dto.client_received,
          dto.client_received_on,
          civil(o.clientReceivedOn),
          today,
        );
      if (
        dto.client_received !== undefined ||
        dto.client_received_on !== undefined
      )
        assertNotFuture(
          o.clientReceivedOn,
          'A data de recebimento do cliente',
          today,
        );
      if (dto.expense_type_override !== undefined)
        o.expenseTypeOverride = dto.expense_type_override;
      if (dto.notes !== undefined) o.notes = dto.notes?.trim() || null;
      o.updatedById = actor.id;
    } catch (error) {
      if (error instanceof AssetTagRuleError)
        this.invalid('form', error.message);
      throw error;
    }
  }

  private async save(
    organizationId: number,
    o: AssetTagOrderEntity,
    before: AssetTagOrderEntity | null,
    operation: 'CREATE' | 'UPDATE',
    actor: AssetTagActor,
  ) {
    const snapshot = (e: AssetTagOrderEntity | null) =>
      e
        ? {
            project_id: Number(e.projectId),
            proposal_number: e.proposalNumber,
            ordered_on: civil(e.orderedOn),
            quantity: Number(e.quantity),
            sequence_start:
              e.sequenceStart == null ? null : Number(e.sequenceStart),
            sequence_end: e.sequenceEnd == null ? null : Number(e.sequenceEnd),
            model: e.model,
            supplier_name: e.supplierName,
            unit_cost: e.unitCost == null ? null : unit(e.unitCost),
            supplier_payment_status: e.supplierPaymentStatus,
            supplier_expected_payment_on: civil(e.supplierExpectedPaymentOn),
            supplier_paid_on: civil(e.supplierPaidOn),
            unit_price: e.unitPrice == null ? null : unit(e.unitPrice),
            client_expected_receipt_on: civil(e.clientExpectedReceiptOn),
            client_received_on: civil(e.clientReceivedOn),
            expense_type_override: e.expenseTypeOverride,
            notes: e.notes,
          }
        : null;
    const a = snapshot(before);
    const b = snapshot(o)!;
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(b) as Array<keyof typeof b>)
      if (JSON.stringify(a?.[key] ?? null) !== JSON.stringify(b[key] ?? null))
        changes[key] = { before: a?.[key] ?? null, after: b[key] };
    await this.assertOpenMonths(organizationId, a, b, Object.keys(changes));
    const saved = await this.ds.transaction(async (m) => {
      const row = await m.getRepository(AssetTagOrderEntity).save(o);
      if (Object.keys(changes).length)
        await m.getRepository(AssetTagOrderAuditLogEntity).save({
          organizationId,
          orderId: Number(row.id),
          operation,
          performedBy: actor.id,
          changes,
        });
      return row;
    });
    return {
      id: Number(saved.id),
      changed: Object.keys(changes).map((k) => FIELD_LABEL[k] ?? k),
    };
  }

  /**
   * O pedido entra no fluxo (e na DRE) em dois eventos: o custo (pago, previsto
   * ou pedido) e a revenda (recebida ou prevista). Mudar o que compõe um evento
   * mexe no mês antigo e no novo; nenhum pode estar em competência fechada.
   */
  private async assertOpenMonths(
    organizationId: number,
    a: Record<string, unknown> | null,
    b: Record<string, unknown>,
    changed: string[],
  ) {
    const COST = [
      'project_id',
      'ordered_on',
      'quantity',
      'sequence_start',
      'sequence_end',
      'unit_cost',
      'supplier_payment_status',
      'supplier_expected_payment_on',
      'supplier_paid_on',
      'expense_type_override',
    ];
    const RECEIPT = [
      'project_id',
      'quantity',
      'sequence_start',
      'sequence_end',
      'unit_price',
      'client_expected_receipt_on',
      'client_received_on',
    ];
    const date = (s: Record<string, unknown> | null, ...keys: string[]) =>
      s
        ? ((keys.map((k) => s[k]).find(Boolean) as string | undefined) ?? null)
        : null;
    const cost = (s: Record<string, unknown> | null) =>
      date(s, 'supplier_paid_on', 'supplier_expected_payment_on', 'ordered_on');
    const receipt = (s: Record<string, unknown> | null) =>
      date(s, 'client_received_on', 'client_expected_receipt_on');
    const dates: Array<string | null> = [];
    if (changed.some((k) => COST.includes(k))) dates.push(cost(a), cost(b));
    if (changed.some((k) => RECEIPT.includes(k)))
      dates.push(receipt(a), receipt(b));
    if (!dates.length) return;
    const only = (key: string) =>
      changed.every((k) => k === key || k === 'supplier_payment_status');
    await assertDreMonthsOpen(
      this.ds.manager,
      organizationId,
      dates,
      !a
        ? 'Não é possível lançar o pedido de placas'
        : only('supplier_paid_on')
          ? !b.supplier_paid_on
            ? 'Não é possível desfazer o pagamento ao fornecedor'
            : a.supplier_paid_on
              ? 'Não é possível alterar a data de pagamento ao fornecedor'
              : 'Não é possível registrar o pagamento ao fornecedor'
          : only('client_received_on')
            ? !b.client_received_on
              ? 'Não é possível desfazer o recebimento da revenda'
              : 'Não é possível registrar o recebimento da revenda'
            : 'Não é possível alterar o pedido de placas',
    );
  }

  private async find(organizationId: number, id: number) {
    const order = await this.ds
      .getRepository(AssetTagOrderEntity)
      .findOneBy({ id, organizationId });
    if (!order)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Pedido de placas não encontrado.',
      });
    return order;
  }

  /**
   * Eventos para o fluxo de caixa e a DRE (linha Etiquetas, doc 06 §5.3), sem
   * gravar nada: saída do custo na data de pagamento (ou previsão, ou pedido) e
   * entrada do valor líquido na data de recebimento (ou previsão). Sem % de
   * impostos vigente, a entrada fica de fora (não inventa o desconto).
   */
  async events(organizationId: number): Promise<FinancialEvent[]> {
    const orders = await this.ds
      .getRepository(AssetTagOrderEntity)
      .find({ where: { organizationId } });
    const projects = await this.ds
      .getRepository(ProjectEntity)
      .find({ where: { organizationId } });
    const rows = await this.rows(organizationId, orders, projects);
    return rows.flatMap((r) => {
      const label = `Placas ${r.proposal_number ? `proposta ${r.proposal_number}` : `pedido #${r.id}`} — ${r.project_name}`;
      const out: FinancialEvent[] = [
        {
          key: `asset_tag_order:${r.id}:cost`,
          source: 'asset_tag_order',
          source_id: r.id,
          project_id: r.project_id,
          direction: 'outflow',
          date:
            r.supplier_paid_on ??
            r.supplier_expected_payment_on ??
            r.ordered_on,
          realized: r.supplier_payment_status === 'paid',
          amount: r.cost_total,
          dre_line: 'tags',
          description: `${label} (custo ${r.supplier_name})`,
        },
      ];
      const receiptDate = r.client_received_on ?? r.client_expected_receipt_on;
      if (r.net_value !== null && receiptDate)
        out.push({
          key: `asset_tag_order:${r.id}:receipt`,
          source: 'asset_tag_order',
          source_id: r.id,
          project_id: r.project_id,
          direction: 'inflow',
          date: receiptDate,
          realized: r.client_received,
          amount: r.net_value,
          dre_line: 'tags',
          description: `${label} (recebimento líquido)`,
        });
      return out;
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
