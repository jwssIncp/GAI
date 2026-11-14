import type { DreGroup } from './dre.dto';
import type { RuleKind } from './dre-monthly.formulas';

/**
 * Modelo padrão de DRE do GAI (versionado). Só é aplicado por ação explícita
 * de quem tem dre:configure, depois de uma pré-visualização; completa o que
 * falta e nunca sobrescreve (conta com o mesmo código, associação já feita e
 * contas pós-operacionais já marcadas ficam como estão). Tudo é editável
 * depois. Nenhuma conta com nome de pessoa: "Pessoal fixo" substitui as contas
 * nominais do INVESTOR e cada organização detalha como quiser.
 */
export const DRE_DEFAULT_MODEL_VERSION = 'gai-dre-padrao-v2';

export interface ModelAccount {
  code: string;
  name: string;
  group: DreGroup;
  /** Agrupadora (sintética): só organiza, não recebe valor. */
  synthetic: boolean;
  parent?: string;
  /** Pós-operacional (abaixo do resultado operacional). */
  post_operational?: boolean;
}

const a = (
  code: string,
  name: string,
  group: DreGroup,
  extra: Partial<ModelAccount> = {},
): ModelAccount => ({
  code,
  name,
  group,
  synthetic: !code.includes('.'),
  parent: code.includes('.') ? code.split('.')[0] : undefined,
  ...extra,
});

export const DRE_DEFAULT_MODEL: ModelAccount[] = [
  a('1', 'Receitas', 'revenue'),
  a('1.01', 'Receita de serviços (faturamento)', 'revenue'),
  a('1.02', 'Reembolsos recebidos de clientes', 'revenue'),
  a('1.03', 'Outras receitas operacionais', 'revenue'),
  a('1.04', 'Revenda de placas de patrimônio', 'revenue'),
  a('2', 'Deduções da receita', 'deductions'),
  a('2.01', 'Imposto de renda sobre o faturamento', 'deductions'),
  a('2.02', 'Adicional de IR', 'deductions'),
  a('2.03', 'Descontos e abatimentos', 'deductions'),
  a('3', 'Custos variáveis', 'direct_cost'),
  a('3.01', 'Inventariantes (diárias)', 'direct_cost'),
  a('3.02', 'Despesas reembolsáveis', 'direct_cost'),
  a('3.03', 'Despesas não reembolsáveis', 'direct_cost'),
  a('3.04', 'Placas de patrimônio', 'direct_cost'),
  a('3.05', 'Comissões comerciais', 'direct_cost'),
  a('3.06', 'Equipamentos e licenças', 'direct_cost'),
  a('3.07', 'Outros custos variáveis', 'direct_cost'),
  a('4', 'Custos fixos', 'operating_expense'),
  a('4.01', 'Pessoal fixo', 'operating_expense'),
  a('4.02', 'Contabilidade e serviços administrativos', 'operating_expense'),
  a('4.03', 'Outros custos fixos', 'operating_expense'),
  a('5', 'Pós-operacional', 'operating_expense'),
  a('5.01', 'Comissão do sócio', 'operating_expense', {
    post_operational: true,
  }),
  a('5.02', 'Filial', 'operating_expense', { post_operational: true }),
  a('5.03', 'Marketing', 'operating_expense', { post_operational: true }),
  a('5.04', 'Back-office', 'operating_expense', { post_operational: true }),
  a('6', 'Receitas financeiras', 'financial_income'),
  a('6.01', 'Receitas financeiras', 'financial_income'),
  a('7', 'Despesas financeiras', 'financial_expense'),
  a('7.01', 'Despesas financeiras', 'financial_expense'),
  a('8', 'Tributos sobre o lucro', 'income_tax'),
  a('8.01', 'IRPJ e CSLL', 'income_tax'),
];

/** Associações do modelo: tipo de movimento / papel → código da conta. */
export const DRE_DEFAULT_RULES: Record<RuleKind, string> = {
  billing_revenue: '1.01',
  reimbursement_revenue: '1.02',
  income_tax: '2.01',
  additional_income_tax: '2.02',
  field_agents: '3.01',
  reimbursable_expenses: '3.02',
  non_reimbursable_expenses: '3.03',
  asset_tags: '3.04',
  asset_tags_revenue: '1.04',
  commissions: '3.05',
  equipment: '3.06',
  partner_commission: '5.01',
  branch: '5.02',
  back_office: '5.04',
};

type PlanAction = 'create' | 'exists' | 'conflict';
type PlannedAccount = ModelAccount & {
  action: PlanAction;
  account_id: number | null;
  note: string | null;
};

export interface ExistingAccount {
  id: number;
  code: string;
  name: string;
  group: DreGroup;
  posting: boolean;
  active: boolean;
}

/**
 * Plano de aplicação (pré-visualização): o que será criado, o que já existe e
 * o que não pode ser usado (mesmo código com outro grupo/tipo ou excluída).
 */
export function planDefaultModel(
  existing: ExistingAccount[],
  rules: Partial<Record<RuleKind, number>>,
  postOperational: number[],
) {
  const byCode = new Map(existing.map((x) => [x.code, x]));
  const accounts = DRE_DEFAULT_MODEL.map((m): PlannedAccount => {
    const e = byCode.get(m.code);
    if (!e)
      return {
        ...m,
        action: 'create',
        account_id: null,
        note: null,
      };
    const ok = e.group === m.group && e.posting === !m.synthetic && e.active;
    return {
      ...m,
      action: ok ? 'exists' : 'conflict',
      account_id: e.id,
      note: ok
        ? null
        : !e.active
          ? 'conta com este código está excluída: restaure ou troque o código'
          : 'já existe com outro grupo ou tipo: mantida como está',
    };
  });
  const norm = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  // Só associa conta criada agora ou já existente com o mesmo nome: mesmo
  // código com outro nome pode ser outra coisa e não recebe papel do modelo.
  const sameName = new Set(
    accounts
      .filter(
        (x) =>
          x.action === 'create' ||
          (x.action === 'exists' &&
            norm(byCode.get(x.code)!.name) === norm(x.name)),
      )
      .map((x) => x.code),
  );
  for (const x of accounts)
    if (x.action === 'exists' && !x.synthetic && !sameName.has(x.code))
      x.note = 'mesmo código com outro nome: mantida, sem associação do modelo';
  // Conta do modelo que poderá ser usada (criada agora ou já existente e compatível).
  const usable = new Set(
    accounts.filter((x) => x.action !== 'conflict').map((x) => x.code),
  );
  const parentBlocked = (code: string) => {
    const parent = DRE_DEFAULT_MODEL.find((m) => m.code === code)?.parent;
    return parent !== undefined && !usable.has(parent);
  };
  for (const x of accounts)
    if (x.action === 'create' && parentBlocked(x.code)) {
      x.action = 'conflict';
      x.note =
        'agrupadora do modelo indisponível (mesmo código com outro grupo ou excluída)';
      usable.delete(x.code);
    }
  const mapping = (Object.keys(DRE_DEFAULT_RULES) as RuleKind[]).map((kind) => {
    const code = DRE_DEFAULT_RULES[kind];
    if (rules[kind]) return { kind, code, action: 'kept' as const };
    return {
      kind,
      code,
      action:
        usable.has(code) && sameName.has(code)
          ? ('map' as const)
          : ('skip' as const),
    };
  });
  const post = accounts
    .filter((x) => x.post_operational && x.action !== 'conflict')
    .map((x) => ({
      code: x.code,
      action:
        x.account_id !== null && postOperational.includes(x.account_id)
          ? ('kept' as const)
          : ('mark' as const),
    }));
  return {
    version: DRE_DEFAULT_MODEL_VERSION,
    accounts,
    rules: mapping,
    post_operational: post,
    totals: {
      create: accounts.filter((x) => x.action === 'create').length,
      exists: accounts.filter((x) => x.action === 'exists').length,
      conflict: accounts.filter((x) => x.action === 'conflict').length,
      map: mapping.filter((x) => x.action === 'map').length,
    },
  };
}
