/**
 * DRE mensal (doc 06 §7.5, etapa 9): grade conta × mês sobre o plano de contas
 * configurável. Funções puras; valores em centavos (BigInt), com sinal.
 *
 * Valor real de uma célula (conta, mês):
 * - mês fechado: o valor congelado no fechamento (nunca recalculado);
 * - antes do mês de corte: lançado (digitado/importado) + classificações;
 * - a partir do corte: fluxo de caixa (pelas regras de reconhecimento) +
 *   lançado (ajuste) + classificações manuais (as classificações de origens
 *   do fluxo — recebível, despesa, diária — são substituídas pelo fluxo).
 * Estimativa (só no ano corrente, do mês corrente em diante, mês aberto e sem
 * valor lançado): custo fixo repete o último valor; filial, equipamentos,
 * back-office e adicional de IR pelos parâmetros; comissão do sócio por
 * trimestre (zero se o trimestre for negativo). Estimativa nunca é gravada.
 */
import type { DreGroup } from './dre.dto';

export const FLOW_KINDS = [
  'billing_revenue',
  'reimbursement_revenue',
  'income_tax',
  'field_agents',
  'reimbursable_expenses',
  'non_reimbursable_expenses',
  'asset_tags',
  'asset_tags_revenue',
  'commissions',
] as const;
export const ROLE_KINDS = [
  'additional_income_tax',
  'equipment',
  'back_office',
  'branch',
  'partner_commission',
] as const;
export type FlowKind = (typeof FLOW_KINDS)[number];
export type RoleKind = (typeof ROLE_KINDS)[number];
export type RuleKind = FlowKind | RoleKind;
export const RULE_KINDS: RuleKind[] = [...FLOW_KINDS, ...ROLE_KINDS];
export const RULE_LABELS: Record<RuleKind, string> = {
  billing_revenue: 'Receita de faturamento (entradas do fluxo)',
  reimbursement_revenue: 'Reembolsos recebidos do cliente',
  income_tax: 'Imposto de renda sobre o faturamento',
  field_agents: 'Inventariantes (diárias)',
  reimbursable_expenses: 'Despesas reembolsáveis',
  non_reimbursable_expenses: 'Despesas não reembolsáveis',
  asset_tags: 'Placas de patrimônio (custo do fornecedor)',
  asset_tags_revenue: 'Revenda de placas ao cliente (líquida dos impostos)',
  commissions: 'Comissões de parceiros',
  additional_income_tax: 'Adicional de IR (projeção)',
  equipment: 'Equipamentos e licenças (projeção)',
  back_office: 'Back-office (projeção)',
  branch: 'Filial (projeção)',
  partner_commission: 'Comissão do sócio (projeção)',
};

export const toCents = (v: string | number | null | undefined): bigint => {
  if (v === null || v === undefined || v === '') return 0n;
  const s = typeof v === 'number' ? v.toFixed(2) : v.trim();
  const negative = s.startsWith('-');
  const [w, f = ''] = s.replace(/^[-+]/, '').split('.');
  const c = BigInt(w || '0') * 100n + BigInt((f + '00').slice(0, 2));
  return negative ? -c : c;
};
export const fromCents = (c: bigint): string => {
  const abs = c < 0n ? -c : c;
  return `${c < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
};
const divRound = (a: bigint, b: bigint): bigint => {
  const negative = a < 0n !== b < 0n;
  const x = a < 0n ? -a : a;
  const y = b < 0n ? -b : b;
  const q = (x * 2n + y) / (2n * y);
  return negative ? -q : q;
};
const abs = (v: bigint) => (v < 0n ? -v : v);
/** "13.33" → 133300 (1% = 10.000). */
const pctUnits = (value: string): bigint => {
  const [w, f = ''] = value.split('.');
  return BigInt(w) * 10_000n + BigInt(f.padEnd(4, '0').slice(0, 4));
};

export const addMonth = (ym: string, n: number): string => {
  const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
export const monthsOf = (year: string) =>
  Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`,
  );

/** Tipo de reconhecimento de um movimento do fluxo e o sinal na conta. */
export function flowKindOf(i: {
  direction: 'in' | 'out';
  group: string;
  origin: string;
}): { kind: FlowKind; sign: 1n | -1n } | null {
  if (i.origin === 'income_tax') return { kind: 'income_tax', sign: 1n };
  if (i.origin === 'field_agent_payment')
    return { kind: 'field_agents', sign: 1n };
  if (i.origin === 'expense')
    return i.group === 'to_reimburse'
      ? { kind: 'reimbursable_expenses', sign: 1n }
      : { kind: 'non_reimbursable_expenses', sign: 1n };
  if (i.origin === 'commission') return { kind: 'commissions', sign: 1n };
  if (i.origin === 'asset_tag_cost') return { kind: 'asset_tags', sign: 1n };
  // Revenda ao cliente é receita (não abate o custo: evita custo negativo).
  if (i.origin === 'asset_tag') return { kind: 'asset_tags_revenue', sign: 1n };
  if (i.direction === 'in' && i.group === 'billing')
    return { kind: 'billing_revenue', sign: 1n };
  if (i.direction === 'in' && i.group === 'reimbursement')
    return { kind: 'reimbursement_revenue', sign: 1n };
  return null;
}

export interface GridAccount {
  id: number;
  code: string;
  name: string;
  group: DreGroup;
  post_operational: boolean;
}
export type ItemMode = 'fixed' | 'average_3_months' | 'zero';
export interface GridContext {
  /** Hoje (AAAA-MM-DD): define o mês corrente da projeção. */
  today: string;
  /** Mês de corte do regime (AAAA-MM). */
  cutoff: string;
  accounts: GridAccount[];
  rules: Partial<Record<RuleKind, number>>;
  /** Fluxo agregado: chave `${kind}|${month}`. */
  flow: Map<string, bigint>;
  /** Valor lançado (digitado/importado): chave `${accountId}|${month}`. */
  entered: Map<string, bigint>;
  /** Classificações reconhecidas: manuais e de origens do fluxo. */
  classified: Map<string, { manual: bigint; sourced: bigint }>;
  /** Meses fechados: coluna congelada (id da conta → valor) ou nula (fechado antes desta etapa). */
  closed: Map<string, Record<string, string> | null>;
  params: {
    partnerPct: string;
    branch: string;
    itemModes: Partial<Record<RoleKind, ItemMode>>;
    itemAmounts: Partial<Record<RoleKind, string>>;
  };
}

export interface Cell {
  month: string;
  value: string;
  flow: string;
  entered: string | null;
  classified: string;
  estimate: string | null;
  estimate_basis: string | null;
  closed: boolean;
}

const INCOME_GROUPS: DreGroup[] = ['revenue', 'financial_income'];
const ITEM_ROLES: RoleKind[] = [
  'additional_income_tax',
  'equipment',
  'back_office',
];

/** Valor real (sem estimativa) e composição de uma célula. */
export function actualCell(ctx: GridContext, a: GridAccount, month: string) {
  const key = `${a.id}|${month}`;
  if (ctx.closed.has(month)) {
    const snap = ctx.closed.get(month);
    if (snap) {
      const v = toCents(snap[String(a.id)] ?? '0.00');
      return {
        value: v,
        flow: 0n,
        entered: null as bigint | null,
        classified: 0n,
        closed: true,
      };
    }
  }
  const fromCutoff = month >= ctx.cutoff;
  const kinds = FLOW_KINDS.filter((k) => ctx.rules[k] === a.id);
  const flow = fromCutoff
    ? kinds.reduce((s, k) => s + (ctx.flow.get(`${k}|${month}`) ?? 0n), 0n)
    : 0n;
  const cls = ctx.classified.get(key);
  const classified = cls
    ? fromCutoff
      ? cls.manual
      : cls.manual + cls.sourced
    : 0n;
  const entered = ctx.entered.has(key) ? ctx.entered.get(key)! : null;
  return {
    value: flow + classified + (entered ?? 0n),
    flow,
    entered,
    classified,
    closed: ctx.closed.has(month),
  };
}

const roleOf = (ctx: GridContext, a: GridAccount): RoleKind | null =>
  ROLE_KINDS.find((k) => ctx.rules[k] === a.id) ?? null;
const isFlowFed = (ctx: GridContext, a: GridAccount) =>
  FLOW_KINDS.some((k) => ctx.rules[k] === a.id);

/** Média dos 3 meses anteriores ao mês corrente (valor absoluto, como o INVESTOR). */
export function average3(ctx: GridContext, a: GridAccount): bigint {
  const current = ctx.today.slice(0, 7);
  let total = 0n;
  for (let k = 1; k <= 3; k++)
    total += abs(actualCell(ctx, a, addMonth(current, -k)).value);
  return divRound(total, 3n);
}

/** Último valor não zero até o mês corrente (12 meses para trás). */
export function lastValue(ctx: GridContext, a: GridAccount): bigint {
  const current = ctx.today.slice(0, 7);
  for (let k = 0; k < 12; k++) {
    const v = actualCell(ctx, a, addMonth(current, -k)).value;
    if (v !== 0n) return v;
  }
  return 0n;
}

export interface LineValues {
  revenue: bigint;
  deductions: bigint;
  net_revenue: bigint;
  variable_costs: bigint;
  fixed_costs: bigint;
  total_costs: bigint;
  operating_result: bigint;
  post_operational: bigint;
  financial_result: bigint;
  income_taxes: bigint;
  final_result: bigint;
}
export const LINE_LABELS: Record<keyof LineValues, string> = {
  revenue: 'Receita bruta',
  deductions: 'Deduções (impostos sobre a receita)',
  net_revenue: 'Receita líquida',
  variable_costs: 'Custos variáveis',
  fixed_costs: 'Custos fixos',
  total_costs: 'Custo total',
  operating_result: 'Resultado operacional',
  post_operational: 'Pós-operacional',
  financial_result: 'Resultado financeiro',
  income_taxes: 'Tributos sobre o lucro',
  final_result: 'Resultado final',
};

/** Linhas calculadas de um mês a partir do valor de cada conta. */
export function lines(
  accounts: GridAccount[],
  value: (a: GridAccount) => bigint,
  exclude?: number,
): LineValues {
  const sum = (f: (a: GridAccount) => boolean) =>
    accounts
      .filter((a) => a.id !== exclude && f(a))
      .reduce((s, a) => s + value(a), 0n);
  const inGroup = (g: DreGroup) => (a: GridAccount) =>
    !a.post_operational && a.group === g;
  const revenue = sum(inGroup('revenue'));
  const deductions = sum(inGroup('deductions'));
  const net = revenue - deductions;
  const variable = sum(inGroup('direct_cost'));
  const fixed = sum(inGroup('operating_expense'));
  const operating = net - variable - fixed;
  const post = accounts
    .filter((a) => a.id !== exclude && a.post_operational)
    .reduce(
      (s, a) => s + (INCOME_GROUPS.includes(a.group) ? -value(a) : value(a)),
      0n,
    );
  const financial =
    sum(inGroup('financial_income')) - sum(inGroup('financial_expense'));
  const taxes = sum(inGroup('income_tax'));
  return {
    revenue,
    deductions,
    net_revenue: net,
    variable_costs: variable,
    fixed_costs: fixed,
    total_costs: variable + fixed,
    operating_result: operating,
    post_operational: post,
    financial_result: financial,
    income_taxes: taxes,
    final_result: operating - post + financial - taxes,
  };
}

/** Grade de um ano: células reais + estimativas + linhas calculadas. */
export function buildGrid(ctx: GridContext, year: string) {
  const months = monthsOf(year);
  const current = ctx.today.slice(0, 7);
  const projecting = (m: string) =>
    m.slice(0, 4) === current.slice(0, 4) && m >= current && !ctx.closed.has(m);
  const actual = new Map<string, ReturnType<typeof actualCell>>();
  for (const a of ctx.accounts)
    for (const m of months) actual.set(`${a.id}|${m}`, actualCell(ctx, a, m));
  const hasLaunched = (a: GridAccount, m: string) => {
    const c = actual.get(`${a.id}|${m}`)!;
    return c.entered !== null || c.classified !== 0n;
  };
  const estimate = new Map<string, { value: bigint; basis: string }>();
  for (const a of ctx.accounts) {
    if (isFlowFed(ctx, a)) continue;
    const role = roleOf(ctx, a);
    if (role === 'partner_commission') continue;
    let est: { value: bigint; basis: string } | null = null;
    if (role && ITEM_ROLES.includes(role)) {
      const mode = ctx.params.itemModes[role] ?? 'zero';
      if (mode === 'fixed')
        est = {
          value: toCents(ctx.params.itemAmounts[role] ?? '0.00'),
          basis: 'valor fixo dos parâmetros',
        };
      else if (mode === 'average_3_months')
        est = {
          value: average3(ctx, a),
          basis: 'média dos 3 meses anteriores',
        };
    } else if (role === 'branch')
      est = {
        value: toCents(ctx.params.branch),
        basis: 'custo fixo da filial dos parâmetros',
      };
    else if (a.group === 'operating_expense' && !a.post_operational)
      est = { value: lastValue(ctx, a), basis: 'repete o último valor' };
    if (!est || est.value === 0n) continue;
    for (const m of months)
      if (projecting(m) && !hasLaunched(a, m))
        estimate.set(`${a.id}|${m}`, est);
  }
  const valueOf = (a: GridAccount, m: string) =>
    actual.get(`${a.id}|${m}`)!.value +
    (estimate.get(`${a.id}|${m}`)?.value ?? 0n);
  // Comissão do sócio: por trimestre, % do operacional (zero se negativo).
  const partner = ctx.accounts.find(
    (a) => roleOf(ctx, a) === 'partner_commission',
  );
  if (partner) {
    const pct = pctUnits(ctx.params.partnerPct);
    for (let q = 0; q < 4; q++) {
      const qm = months.slice(q * 3, q * 3 + 3);
      if (!qm.some(projecting)) continue;
      const op = qm.reduce(
        (s, m) =>
          s +
          lines(ctx.accounts, (a) => valueOf(a, m), partner.id)
            .operating_result,
        0n,
      );
      const already = qm.reduce(
        (s, m) => s + actual.get(`${partner.id}|${m}`)!.value,
        0n,
      );
      const due = (op > 0n ? divRound(op * pct, 1_000_000n) : 0n) - already;
      const target = qm[2];
      if (due > 0n && projecting(target) && !hasLaunched(partner, target))
        estimate.set(`${partner.id}|${target}`, {
          value: due,
          basis: `${ctx.params.partnerPct.replace('.', ',')}% do resultado operacional do ${q + 1}º trimestre`,
        });
    }
  }
  const accounts = ctx.accounts.map((a) => {
    const cells: Cell[] = months.map((m) => {
      const c = actual.get(`${a.id}|${m}`)!;
      const e = estimate.get(`${a.id}|${m}`);
      return {
        month: m,
        value: fromCents(c.value + (e?.value ?? 0n)),
        flow: fromCents(c.flow),
        entered: c.entered === null ? null : fromCents(c.entered),
        classified: fromCents(c.classified),
        estimate: e ? fromCents(e.value) : null,
        estimate_basis: e?.basis ?? null,
        closed: c.closed,
      };
    });
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      group: a.group,
      post_operational: a.post_operational,
      role: roleOf(ctx, a),
      flow_kinds: FLOW_KINDS.filter((k) => ctx.rules[k] === a.id),
      cells,
      total: fromCents(cells.reduce((s, c) => s + toCents(c.value), 0n)),
    };
  });
  const perMonth = months.map((m) => lines(ctx.accounts, (a) => valueOf(a, m)));
  const keys = Object.keys(LINE_LABELS) as Array<keyof LineValues>;
  return {
    year,
    months,
    current_month: current,
    cutoff: ctx.cutoff,
    accounts,
    lines: keys.map((key) => ({
      key,
      label: LINE_LABELS[key],
      values: perMonth.map((l) => fromCents(l[key])),
      total: fromCents(perMonth.reduce((s, l) => s + l[key], 0n)),
    })),
    estimates: [...estimate.values()].length,
    month_state: months.map((m) => ({
      month: m,
      closed: ctx.closed.has(m),
      projected: projecting(m),
      automatic: m >= ctx.cutoff,
    })),
  };
}

/**
 * Janela dos % de custo variável (pctVar12 do INVESTOR): os 12 meses anteriores
 * ao mês corrente, só os que têm receita bruta, sobre a receita bruta da DRE.
 */
export function windowShares(ctx: GridContext) {
  const current = ctx.today.slice(0, 7);
  const account = (k: RuleKind) =>
    ctx.accounts.find((a) => a.id === ctx.rules[k]) ?? null;
  const pick = (k: RuleKind, m: string) => {
    const a = account(k);
    return a ? abs(actualCell(ctx, a, m).value) : 0n;
  };
  let revenue = 0n;
  // Receita sujeita ao IR do faturamento (revenda de placas e reembolsos não
  // pagam esse IR de novo): a conta da receita de faturamento.
  let taxed = 0n;
  const billing = account('billing_revenue');
  let fieldAgents = 0n;
  let nonReimbursable = 0n;
  let commissions = 0n;
  let used = 0;
  for (let k = 1; k <= 12; k++) {
    const m = addMonth(current, -k);
    const r = lines(ctx.accounts, (a) => actualCell(ctx, a, m).value).revenue;
    if (r === 0n) continue;
    used++;
    revenue += r;
    taxed += billing ? abs(actualCell(ctx, billing, m).value) : r;
    fieldAgents += pick('field_agents', m);
    nonReimbursable += pick('non_reimbursable_expenses', m);
    commissions += pick('commissions', m);
  }
  return {
    from: addMonth(current, -12),
    to: addMonth(current, -1),
    months_with_revenue: used,
    revenue: fromCents(revenue),
    taxed_revenue: fromCents(taxed > revenue ? revenue : taxed),
    field_agents: fromCents(fieldAgents),
    non_reimbursable: fromCents(nonReimbursable),
    commissions: fromCents(commissions),
    missing: (
      ['field_agents', 'non_reimbursable_expenses', 'commissions'] as RuleKind[]
    ).filter((k) => !account(k)),
  };
}
