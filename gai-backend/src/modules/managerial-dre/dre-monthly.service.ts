import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FinanceSettingsService } from '../finance-settings/finance-settings.service';
import { CashFlowBoardService } from '../receivables/cash-flow-board.service';
import { DreAccount, DreEntry, DrePeriod } from './dre.entity';
import type { DreGroup } from './dre.dto';
import type { DreLineInput } from './dre.policy';
import {
  DreMonthlyValueEntity,
  DreRecognitionRuleEntity,
  DreReportLayoutEntity,
  type DreLayoutData,
} from './dre-monthly.entities';
import {
  actualCell,
  buildGrid,
  FLOW_KINDS,
  flowKindOf,
  fromCents,
  type GridContext,
  RULE_KINDS,
  RULE_LABELS,
  type RuleKind,
  toCents,
  windowShares,
} from './dre-monthly.formulas';
import { fixedCostFlowItems } from './dre-fixed-costs.formulas';

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
  /**
   * @param pre movimentos do fluxo já calculados nesta requisição (evita
   * recalcular o fluxo inteiro: é a parte cara da consulta).
   */
  async context(
    org: number,
    today: string,
    pre?: Awaited<ReturnType<CashFlowBoardService['items']>>,
  ) {
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
        pre ?? this.board.items(org, today),
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
    /** Mesmo fluxo, aberto por projeto (Demonstrativo por projeto). */
    const flowByProject = new Map<string, bigint>();
    const items = flowItems.items.filter(
      (i) => i.status !== 'reversed' && i.currency === 'BRL',
    );
    for (const i of items) {
      const k = flowKindOf(i);
      if (!k) continue;
      const v = k.sign * toCents(i.gross);
      const key = `${k.kind}|${i.date.slice(0, 7)}`;
      flow.set(key, (flow.get(key) ?? 0n) + v);
      const pk = `${key}|${i.project_id ?? ''}`;
      flowByProject.set(pk, (flowByProject.get(pk) ?? 0n) + v);
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
    // Corte antes do início dos parâmetros (dado anterior à regra da etapa 10):
    // os meses entre o corte e o início ficam sem IR. Republique o corte.
    const [{ first }] = await m.query<Array<{ first: string | Date | null }>>(
      'SELECT MIN(valid_from) AS first FROM finance_settings_versions WHERE organization_id = ?',
      [org],
    );
    const firstMonth = first
      ? (first instanceof Date ? first.toISOString() : String(first)).slice(
          0,
          7,
        )
      : null;
    if (firstMonth && p.dre_regime_cutoff_month < firstMonth)
      warnings.push(
        `O mês de corte (${p.dre_regime_cutoff_month.split('-').reverse().join('/')}) é anterior ao início dos parâmetros (${firstMonth.split('-').reverse().join('/')}): publique uma versão dos parâmetros com o corte correto ou uma versão retroativa.`,
      );
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
    return {
      ctx,
      params: p,
      layout,
      rules,
      allAccounts,
      warnings,
      items,
      flowByProject,
      entries,
      periods,
    };
  }

  async grid(
    org: number,
    year: string,
    today: string,
    pre?: Awaited<ReturnType<CashFlowBoardService['items']>>,
  ) {
    const c = await this.context(org, today, pre);
    return c ? this.gridFrom(c, year) : null;
  }

  /** Grade de um ano a partir de um contexto já montado. */
  gridFrom(
    c: NonNullable<Awaited<ReturnType<DreMonthlyService['context']>>>,
    year: string,
  ) {
    return {
      ...buildGrid(c.ctx, year),
      window: windowShares(c.ctx),
      warnings: c.warnings,
    };
  }

  /**
   * Custos fixos da DRE como saídas do fluxo (lançado ou estimado), nos anos
   * pedidos; com `withValues`, também nos anos que têm valor lançado na DRE.
   */
  fixedCosts(
    c: NonNullable<Awaited<ReturnType<DreMonthlyService['context']>>>,
    years: string[],
    withValues = false,
  ) {
    const all = new Set(years);
    if (withValues) {
      for (const key of c.ctx.entered.keys())
        all.add(key.split('|')[1].slice(0, 4));
      for (const key of c.ctx.classified.keys())
        all.add(key.split('|')[1].slice(0, 4));
      for (const month of c.ctx.closed.keys()) all.add(month.slice(0, 4));
    }
    return [...all]
      .sort()
      .flatMap((y) => fixedCostFlowItems(buildGrid(c.ctx, y)));
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

  /** Corte e regras da organização, sem recalcular o fluxo (consultas leves). */
  async regime(org: number, today: string) {
    let p;
    try {
      p = await this.settings.valuesAt(org, today);
    } catch {
      return null;
    }
    const rules = await this.rules(org);
    return {
      cutoff: p.dre_regime_cutoff_month,
      rules: Object.fromEntries(
        Object.entries(rules).map(([k, r]) => [k, r.accountId]),
      ) as Partial<Record<RuleKind, number>>,
    };
  }

  /**
   * Linhas do Demonstrativo a partir da DRE mensal (mesmos valores da grade,
   * sem estimativas): mês fechado com coluna congelada usa a coluna; senão,
   * fluxo (por projeto) + lançado + classificações (as de origens do fluxo só
   * antes do corte).
   */
  reportRows(
    c: NonNullable<Awaited<ReturnType<DreMonthlyService['context']>>>,
    range: string[],
    projectId?: number,
  ): DreLineInput[] {
    const rows: DreLineInput[] = [];
    const accounts = new Map(c.ctx.accounts.map((a) => [a.id, a]));
    const push = (
      a: { id: number; code: string; name: string; group: DreGroup },
      month: string,
      amount: bigint,
      project: number | null,
      origin: string,
      entry?: {
        id: number;
        revision: number;
        description: string;
        key: string | null;
      },
    ) => {
      if (amount === 0n) return;
      if (projectId && project !== projectId) return;
      rows.push({
        entry_id: entry?.id ?? 0,
        revision: entry?.revision ?? 0,
        month,
        currency: 'BRL',
        project_id: project,
        amount: fromCents(amount),
        group: a.group,
        account_code: a.code,
        account_name: `${a.code} ${a.name}`,
        description: entry?.description ?? origin,
        source_key: entry?.key ?? origin,
      });
    };
    for (const month of range) {
      const snap = c.ctx.closed.get(month);
      if (snap) {
        for (const a of c.ctx.accounts)
          push(
            a,
            month,
            toCents(snap[String(a.id)] ?? '0.00'),
            null,
            'Competência fechada (coluna congelada)',
          );
        continue;
      }
      const fromCutoff = month >= c.ctx.cutoff;
      for (const a of c.ctx.accounts) {
        if (fromCutoff)
          for (const k of FLOW_KINDS) {
            if (c.ctx.rules[k] !== a.id) continue;
            for (const [key, v] of c.flowByProject) {
              const [kind, m, p] = key.split('|');
              if (kind === k && m === month)
                push(a, month, v, p ? Number(p) : null, 'Fluxo de caixa');
            }
          }
        const e = c.ctx.entered.get(`${a.id}|${month}`);
        if (e !== undefined) push(a, month, e, null, 'Lançado na DRE mensal');
      }
      for (const entry of c.entries) {
        if (entry.data.status !== 'recognized') continue;
        const sourced = SOURCED.includes(entry.data.source?.kind);
        if (sourced && fromCutoff) continue;
        for (const al of entry.data.allocations) {
          const a = al.account ? accounts.get(al.account.id) : undefined;
          if (!a || al.month !== month) continue;
          push(a, month, toCents(al.amount), entry.projectId, 'Classificação', {
            id: entry.id,
            revision: entry.revision,
            description: entry.data.description,
            key: entry.sourceKey,
          });
        }
      }
    }
    return rows;
  }

  /**
   * Verificação do fechamento de um mês (etapa 10). Bloqueios não se
   * contornam; avisos exigem ciência explícita, registrada no fechamento.
   */
  async checklist(org: number, month: string, today: string) {
    const c = await this.context(org, today);
    if (!c) return null;
    const blockers: Array<{ code: string; message: string }> = [];
    const warnings: Array<{
      code: string;
      message: string;
      count: number;
      amount: string | null;
    }> = [];
    const br = month.split('-').reverse().join('/');
    const inMonth = c.items.filter((i) => i.date.startsWith(month));
    const drafts = c.entries.filter(
      (e) =>
        e.data.status === 'draft' &&
        e.data.allocations.some((a) => a.month === month),
    );
    if (drafts.length)
      warnings.push({
        code: 'draft_entries',
        message: `${drafts.length} classificação(ões) em rascunho com valor em ${br} ficam fora da DRE.`,
        count: drafts.length,
        amount: null,
      });
    if (month >= c.ctx.cutoff) {
      const [y, mm] = month.split('-').map(Number);
      const last = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
      try {
        await this.settings.valuesAt(org, last);
      } catch {
        blockers.push({
          code: 'no_parameters',
          message: `Sem parâmetros financeiros vigentes em ${br}: publique a versão dos parâmetros.`,
        });
      }
      const unmapped = FLOW_KINDS.filter(
        (k) =>
          !c.ctx.rules[k] && inMonth.some((i) => flowKindOf(i)?.kind === k),
      );
      if (unmapped.length)
        blockers.push({
          code: 'unmapped_kinds',
          message: `Movimentos de ${br} sem conta associada na DRE: ${unmapped.map((k) => RULE_LABELS[k]).join('; ')}.`,
        });
      const taxed = new Set(
        c.items.filter((i) => i.origin === 'income_tax').map((i) => i.key),
      );
      const untaxed = inMonth.filter(
        (i) =>
          i.direction === 'in' &&
          i.group === 'billing' &&
          !taxed.has(`ir:${i.key}`),
      );
      if (untaxed.length)
        blockers.push({
          code: 'revenue_without_tax',
          message: `${untaxed.length} entrada(s) de faturamento em ${br} sem IR calculado (${fromCents(untaxed.reduce((s2, i) => s2 + toCents(i.gross), 0n))}): falta parâmetro vigente na data.`,
        });
      const open = inMonth.filter(
        (i) => i.status === 'open' || i.status === 'proposed',
      );
      if (open.length)
        warnings.push({
          code: 'open_items',
          message: `${open.length} movimento(s) ainda previstos ou propostos com data em ${br} serão congelados como estão (receba, pague ou reprograme antes, se for o caso).`,
          count: open.length,
          amount: fromCents(open.reduce((s2, i) => s2 + toCents(i.gross), 0n)),
        });
      const review = this.reviewEntries(c).filter((e) =>
        e.months.includes(month),
      );
      if (review.length)
        warnings.push({
          code: 'review_entries',
          message: `${review.length} classificação(ões) de origem do fluxo com valor em ${br} estão substituídas pela DRE automática (revise e anule).`,
          count: review.length,
          amount: null,
        });
    }
    return {
      month,
      cutoff: c.ctx.cutoff,
      automatic: month >= c.ctx.cutoff,
      blockers,
      warnings,
    };
  }

  /** Classificações de recebível/despesa/diária com valor a partir do corte (a revisar). */
  reviewEntries(
    c: NonNullable<Awaited<ReturnType<DreMonthlyService['context']>>>,
  ) {
    return c.entries
      .filter(
        (e) =>
          e.data.status === 'recognized' &&
          SOURCED.includes(e.data.source?.kind) &&
          e.data.allocations.some((a) => a.month >= c.ctx.cutoff),
      )
      .map((e) => ({
        id: e.id,
        revision: e.revision,
        description: e.data.description,
        source: e.data.source?.kind,
        project_id: e.projectId,
        months: [...new Set(e.data.allocations.map((a) => a.month))].sort(),
        amount: fromCents(
          e.data.allocations.reduce((s2, a) => s2 + toCents(a.amount), 0n),
        ),
      }));
  }
}
