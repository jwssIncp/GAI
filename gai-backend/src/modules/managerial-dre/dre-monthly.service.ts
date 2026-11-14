import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceSettingsService } from '../finance-settings/finance-settings.service';
import { CashFlowBoardService } from '../receivables/cash-flow-board.service';
import { DreAccount, DreEntry, DrePeriod } from './dre.entity';
import {
  DreMonthlyValueEntity,
  DreRecognitionRuleEntity,
  DreReportLayoutEntity,
  type DreLayoutData,
} from './dre-monthly.entities';
import {
  actualCell,
  buildGrid,
  flowKindOf,
  fromCents,
  type GridContext,
  RULE_KINDS,
  RULE_LABELS,
  type RuleKind,
  toCents,
  windowShares,
} from './dre-monthly.formulas';

const SOURCED = ['receivable', 'expense', 'payment'];
export const EMPTY_LAYOUT: DreLayoutData = {
  hidden: [],
  summary: [],
  post_operational: [],
};

/**
 * Leitura da DRE mensal. Fica no módulo de recebíveis (exportado) porque usa os
 * movimentos do fluxo de caixa e é usada pelos indicadores do fluxo; a escrita
 * (lançar, importar, configurar) fica no módulo da DRE.
 */
@Injectable()
export class DreMonthlyService {
  constructor(
    private readonly ds: DataSource,
    private readonly board: CashFlowBoardService,
    private readonly settings: FinanceSettingsService,
  ) {}

  async layout(
    org: number,
  ): Promise<{ revision: number; data: DreLayoutData }> {
    const l = await this.ds.manager.findOneBy(DreReportLayoutEntity, {
      organizationId: org,
    });
    return l
      ? { revision: l.revision, data: { ...EMPTY_LAYOUT, ...l.data } }
      : { revision: 0, data: EMPTY_LAYOUT };
  }

  async rules(org: number) {
    const rows = await this.ds.manager.find(DreRecognitionRuleEntity, {
      where: { organizationId: org },
    });
    return Object.fromEntries(rows.map((r) => [r.kind, r])) as Partial<
      Record<RuleKind, DreRecognitionRuleEntity>
    >;
  }

  /** Contexto completo para montar a grade; nulo sem parâmetros vigentes. */
  async context(org: number, today: string) {
    let p;
    try {
      p = await this.settings.valuesAt(org, today);
    } catch {
      return null;
    }
    const m = this.ds.manager;
    const [allAccounts, layout, rules, values, entries, periods, flowItems] =
      await Promise.all([
        m.find(DreAccount, { where: { organizationId: org } }),
        this.layout(org),
        this.rules(org),
        m.find(DreMonthlyValueEntity, { where: { organizationId: org } }),
        m.find(DreEntry, { where: { organizationId: org } }),
        m.find(DrePeriod, { where: { organizationId: org } }),
        this.board.items(org, today),
      ]);
    const post = new Set(layout.data.post_operational);
    const accounts = allAccounts
      .filter((a) => a.data.posting && a.data.active)
      .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))
      .map((a) => ({
        id: a.id,
        code: a.code,
        name: a.data.name,
        group: a.data.group,
        post_operational: post.has(a.id),
      }));
    const flow = new Map<string, bigint>();
    for (const i of flowItems.items) {
      if (i.status === 'reversed' || i.currency !== 'BRL') continue;
      const k = flowKindOf(i);
      if (!k) continue;
      const key = `${k.kind}|${i.date.slice(0, 7)}`;
      flow.set(key, (flow.get(key) ?? 0n) + k.sign * toCents(i.gross));
    }
    const entered = new Map<string, bigint>();
    for (const v of values)
      if (v.amount !== null)
        entered.set(`${v.accountId}|${v.month}`, toCents(String(v.amount)));
    const classified = new Map<string, { manual: bigint; sourced: bigint }>();
    let sourcedAfterCutoff = 0;
    for (const e of entries) {
      if (e.data.status !== 'recognized') continue;
      const sourced = SOURCED.includes(e.data.source?.kind);
      for (const a of e.data.allocations) {
        if (!a.account) continue;
        const key = `${a.account.id}|${a.month}`;
        const c = classified.get(key) ?? { manual: 0n, sourced: 0n };
        if (sourced) {
          c.sourced += toCents(a.amount);
          if (a.month >= p.dre_regime_cutoff_month) sourcedAfterCutoff++;
        } else c.manual += toCents(a.amount);
        classified.set(key, c);
      }
    }
    const closed = new Map<string, Record<string, string> | null>();
    for (const period of periods)
      if (period.closed)
        closed.set(
          period.month,
          (period.data as { grid?: Record<string, string> }).grid ?? null,
        );
    const ctx: GridContext = {
      today,
      cutoff: p.dre_regime_cutoff_month,
      accounts,
      rules: Object.fromEntries(
        Object.entries(rules).map(([k, r]) => [k, r.accountId]),
      ),
      flow,
      entered,
      classified,
      closed,
      params: {
        partnerPct: p.partner_commission_pct,
        branch: p.fixed_cost_branch,
        itemModes: { ...p.fixed_cost_item_modes },
        itemAmounts: { ...(p.fixed_cost_item_amounts ?? {}) },
      },
    };
    const warnings: string[] = [];
    if (sourcedAfterCutoff)
      warnings.push(
        `${sourcedAfterCutoff} classificação(ões) de recebível, despesa ou diária a partir do corte foram substituídas pela alimentação automática do fluxo.`,
      );
    const missing = RULE_KINDS.filter((k) => !ctx.rules[k]);
    if (missing.length)
      warnings.push(
        `Sem conta associada: ${missing.map((k) => RULE_LABELS[k]).join('; ')}. Associe em "Configurar".`,
      );
    for (const [month, snap] of closed)
      if (!snap)
        warnings.push(
          `Competência ${month.split('-').reverse().join('/')} foi fechada antes da DRE mensal: valores recalculados (reabra e feche de novo para congelar).`,
        );
    return { ctx, params: p, layout, rules, allAccounts, warnings };
  }

  async grid(org: number, year: string, today: string) {
    const c = await this.context(org, today);
    if (!c) return null;
    return {
      ...buildGrid(c.ctx, year),
      window: windowShares(c.ctx),
      warnings: c.warnings,
    };
  }

  async flowItems(org: number, today: string) {
    return (await this.board.items(org, today)).items.filter(
      (i) => i.status !== 'reversed' && i.currency === 'BRL',
    );
  }

  /** Coluna do mês (valores reais) para congelar no fechamento. */
  async column(org: number, month: string, today: string) {
    const c = await this.context(org, today);
    if (!c) return null;
    return Object.fromEntries(
      c.ctx.accounts.map((a) => [
        String(a.id),
        fromCents(actualCell(c.ctx, a, month).value),
      ]),
    );
  }
}
