import { BadRequestException, ConflictException } from '@nestjs/common';
import { isCivilDate } from '../../common/validation/civil-date';
import type { FinanceSettingsValuesDto } from './finance-settings.dto';

export const FINANCE_SETTINGS_PERMISSIONS = [
  'finance-settings:read',
  'finance-settings:update',
] as const;

export const FINANCE_SETTINGS_TIMEZONE = 'America/Sao_Paulo';

export const FIXED_COST_ITEM_MODES = [
  'average_3_months',
  'fixed',
  'zero',
] as const;
export type FixedCostItemMode = (typeof FIXED_COST_ITEM_MODES)[number];

export function invalid(message: string): never {
  throw new BadRequestException({ code: 'FINANCE_SETTINGS_INVALID', message });
}
export function conflict(message: string): never {
  throw new ConflictException({ code: 'FINANCE_SETTINGS_CONFLICT', message });
}
export function missingSettings(): never {
  throw new ConflictException({
    code: 'FINANCE_SETTINGS_MISSING',
    message:
      'A organização ainda não tem parâmetros financeiros vigentes. Configure em Financeiro › Parâmetros financeiros.',
  });
}

/**
 * Valores iniciais oferecidos a uma organização sem parâmetros (seed ou botão
 * "Criar com valores padrão"). São os valores do INVESTOR (doc 06 §8).
 * Nenhum cálculo lê este objeto: os cálculos usam sempre a versão vigente
 * gravada para a organização e falham quando ela não existe.
 */
export function defaultFinanceSettingsValues(
  validFrom: string = civilToday(),
): FinanceSettingsValuesDto {
  return {
    income_tax_pct: '13.33',
    tag_tax_pct: '16.00',
    default_daily_rate: '185.00',
    budget_productivity_items_per_day: 80,
    budgeted_non_reimbursable_expense_pct: '20.00',
    technician_expense_alert_pct: '30.00',
    commercial_origins: [
      { code: 'recurring', label: 'Recorrente', commission_pct: '4.00' },
      { code: 'inbound', label: 'Inbound', commission_pct: '6.00' },
      { code: 'outbound_new', label: 'Outbound Novo', commission_pct: '8.00' },
      { code: 'board', label: 'Diretoria', commission_pct: '4.00' },
    ],
    partner_commission_pct: '10.00',
    fixed_cost_operation: '10915.00',
    fixed_cost_branch: '3021.00',
    // Padrão do INVESTOR (fluxo_caixa.html, PADRAO): os três itens em "média de
    // 3 meses" e valores fixos zerados. O valor só é exigido no modo "fixo".
    fixed_cost_item_modes: {
      additional_income_tax: 'average_3_months',
      equipment: 'average_3_months',
      back_office: 'average_3_months',
    },
    fixed_cost_item_amounts: {
      additional_income_tax: '0.00',
      equipment: '0.00',
      back_office: '0.00',
    },
    economic_break_even_margin_pct: '10.00',
    first_installment_days_after_contract: 30,
    // Corte da DRE automática: por organização, a partir do início dos
    // parâmetros (nunca uma data fixa no código).
    dre_regime_cutoff_month: validFrom.slice(0, 7),
    expense_reasons: [
      'Transporte',
      'Refeição',
      'Lanche',
      'Lavanderia',
      'Outros',
    ],
    tag_models: ['Alumínio', 'Aço', 'Policarbonato'],
    default_tag_supplier: 'Planner',
    field_agent_document_max_bytes: 2 * 1024 * 1024,
    expense_attachment_max_bytes: 8 * 1024 * 1024,
    expense_attachment_max_files: 2,
    require_approval: true,
  };
}

const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

function cents(value: string, pattern: RegExp, label: string): bigint {
  if (typeof value !== 'string' || !pattern.test(value))
    invalid(`${label}: use números com ponto decimal e até duas casas.`);
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
function formatCents(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
function money(value: string, label: string): string {
  return formatCents(cents(value, MONEY, label));
}
function percent(value: string, label: string): string {
  const scaled = cents(value, PERCENT, label);
  if (scaled > 10000n)
    invalid(`${label}: o percentual não pode passar de 100.`);
  return formatCents(scaled);
}
function textList(values: string[], label: string): string[] {
  const out = values.map((value) => value.trim());
  if (!out.length || out.some((value) => !value))
    invalid(`${label}: informe ao menos um item, sem itens vazios.`);
  const seen = new Set(out.map((value) => value.toLocaleLowerCase('pt-BR')));
  if (seen.size !== out.length) invalid(`${label}: há itens repetidos.`);
  return out;
}

const FIXED_COST_ITEM_LABELS = {
  additional_income_tax: 'Adicional de IR',
  equipment: 'Equipamentos',
  back_office: 'Back-office',
} as const;

/** Valor de cada item de custo fixo; no modo "fixo" ele é obrigatório e maior que zero (como no INVESTOR). */
function fixedAmounts(dto: FinanceSettingsValuesDto) {
  const out = {} as FinanceSettingsValuesDto['fixed_cost_item_amounts'];
  for (const key of Object.keys(FIXED_COST_ITEM_LABELS) as Array<
    keyof typeof FIXED_COST_ITEM_LABELS
  >) {
    const label = FIXED_COST_ITEM_LABELS[key];
    const amount = cents(dto.fixed_cost_item_amounts[key], MONEY, label);
    if (dto.fixed_cost_item_modes[key] === 'fixed' && amount <= 0n)
      invalid(`Informe o valor fixo de ${label} (maior que zero).`);
    out[key] = formatCents(amount);
  }
  return out;
}

/** Normaliza e valida as regras que o class-validator não cobre sozinho. */
export function normalizeFinanceSettingsValues(
  dto: FinanceSettingsValuesDto,
  platformMaxUploadBytes: number,
): FinanceSettingsValuesDto {
  const origins = dto.commercial_origins.map((origin) => ({
    code: origin.code.trim(),
    label: origin.label.trim(),
    commission_pct: percent(
      origin.commission_pct,
      `Comissão da origem ${origin.label}`,
    ),
  }));
  if (!origins.length) invalid('Informe ao menos uma origem comercial.');
  if (new Set(origins.map((origin) => origin.code)).size !== origins.length)
    invalid('Origens comerciais: há códigos repetidos.');
  textList(
    origins.map((origin) => origin.label),
    'Origens comerciais',
  );
  for (const [label, bytes] of [
    ['Documentos do inventariante', dto.field_agent_document_max_bytes],
    ['Anexos de despesa', dto.expense_attachment_max_bytes],
  ] as const)
    if (bytes > platformMaxUploadBytes)
      invalid(
        `${label}: o limite por arquivo não pode passar do teto da plataforma (${platformMaxUploadBytes} bytes).`,
      );
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dto.dre_regime_cutoff_month))
    invalid('Mês de corte da DRE: use o formato AAAA-MM.');
  return {
    income_tax_pct: percent(dto.income_tax_pct, '% de IR sobre faturamento'),
    tag_tax_pct: percent(dto.tag_tax_pct, '% de impostos sobre placas'),
    default_daily_rate: money(dto.default_daily_rate, 'Diária padrão'),
    budget_productivity_items_per_day: dto.budget_productivity_items_per_day,
    budgeted_non_reimbursable_expense_pct: percent(
      dto.budgeted_non_reimbursable_expense_pct,
      '% orçado de despesas não reembolsáveis',
    ),
    technician_expense_alert_pct: percent(
      dto.technician_expense_alert_pct,
      '% de alerta de despesas de técnicos',
    ),
    commercial_origins: origins,
    partner_commission_pct: percent(
      dto.partner_commission_pct,
      '% de comissão do sócio',
    ),
    fixed_cost_operation: money(
      dto.fixed_cost_operation,
      'Custo fixo da operação',
    ),
    fixed_cost_branch: money(dto.fixed_cost_branch, 'Custo fixo da filial'),
    fixed_cost_item_modes: { ...dto.fixed_cost_item_modes },
    fixed_cost_item_amounts: fixedAmounts(dto),
    economic_break_even_margin_pct: percent(
      dto.economic_break_even_margin_pct,
      'Margem do ponto de equilíbrio econômico',
    ),
    first_installment_days_after_contract:
      dto.first_installment_days_after_contract,
    dre_regime_cutoff_month: dto.dre_regime_cutoff_month,
    expense_reasons: textList(dto.expense_reasons, 'Motivos de despesa'),
    tag_models: textList(dto.tag_models, 'Modelos de placa'),
    default_tag_supplier: dto.default_tag_supplier.trim(),
    field_agent_document_max_bytes: dto.field_agent_document_max_bytes,
    expense_attachment_max_bytes: dto.expense_attachment_max_bytes,
    expense_attachment_max_files: dto.expense_attachment_max_files,
    require_approval: dto.require_approval,
  };
}

/** Data civil de hoje no fuso da operação (AAAA-MM-DD). */
export function civilToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FINANCE_SETTINGS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Regras de vigência: versões só são acrescentadas e nenhuma existente muda.
 * A nova versão pode começar:
 * - antes da primeira (preenche o período que estava sem parâmetros: os
 *   lançamentos antigos passam a ter valor, e nenhum valor já usado muda);
 * - depois da última, inclusive no passado (vale desde essa data; a tela avisa
 *   "será aplicada a todos os lançamentos desde DD/MM/AAAA").
 * Começar entre versões existentes é recusado (mudaria valores já vigentes),
 * assim como alcançar competência já fechada na DRE.
 */
export function assertNewVersionStart(
  validFrom: string,
  existingStarts: string[],
  today: string,
  closedDreMonths: string[] = [],
): void {
  if (!isCivilDate(validFrom)) invalid('Início da vigência: data inválida.');
  if (existingStarts.includes(validFrom))
    conflict(`Já existe uma versão que vale a partir de ${br(validFrom)}.`);
  const sorted = [...existingStarts].sort();
  const earliest = sorted[0] ?? null;
  const latest = sorted[sorted.length - 1] ?? null;
  const before = earliest !== null && validFrom < earliest;
  if (earliest !== null && !before && validFrom < latest)
    conflict(
      `A nova versão precisa começar antes da primeira (${br(earliest)}) ou depois da última (${br(latest)}); entre versões mudaria valores já vigentes.`,
    );
  // Período afetado: do início até a primeira versão (preenchimento) ou até hoje.
  const end = before ? earliest : today;
  if (validFrom < end) {
    const from = validFrom.slice(0, 7);
    const to = end.slice(0, 7);
    const hit = closedDreMonths.filter((m) => m >= from && m <= to).sort();
    if (hit.length)
      conflict(
        `A vigência alcançaria competência fechada na DRE (${hit.join(', ')}). Reabra a competência ou escolha uma data posterior.`,
      );
  }
}

const br = (civil: string) => civil.split('-').reverse().join('/');
const brMonth = (month: string) => month.split('-').reverse().join('/');

/**
 * Mês de corte da DRE automática (por organização, nos parâmetros):
 * - não pode ser antes do início dos parâmetros da organização (sem
 *   parâmetro vigente o fluxo não tem IR);
 * - mudar o corte em relação à versão vizinha não pode atravessar competência
 *   fechada da DRE (o mês mudaria de regime depois de fechado).
 */
export function assertCutoff(
  cutoff: string,
  validFrom: string,
  previous: Array<{ validFrom: string; cutoff: string }>,
  closedDreMonths: string[] = [],
): void {
  const starts = [validFrom, ...previous.map((p) => p.validFrom)].sort();
  const firstMonth = starts[0].slice(0, 7);
  if (cutoff < firstMonth)
    invalid(
      `O mês de corte da DRE automática (${brMonth(cutoff)}) não pode ser antes do início dos parâmetros da organização (${brMonth(firstMonth)}): sem parâmetro vigente o fluxo não tem IR.`,
    );
  const sorted = [...previous].sort((a, b) =>
    a.validFrom.localeCompare(b.validFrom),
  );
  const neighbour =
    validFrom < (sorted[0]?.validFrom ?? '')
      ? sorted[0]
      : sorted[sorted.length - 1];
  if (!neighbour || neighbour.cutoff === cutoff) return;
  const [from, to] = [neighbour.cutoff, cutoff].sort();
  const hit = closedDreMonths.filter((m) => m >= from && m < to).sort();
  if (hit.length)
    conflict(
      `Mudar o corte de ${brMonth(neighbour.cutoff)} para ${brMonth(cutoff)} mudaria o regime de competência já fechada (${hit.map(brMonth).join(', ')}). Reabra a competência ou mantenha o corte.`,
    );
}

/** Versão vigente numa data: a de maior início que não seja posterior a ela. */
export function versionInForce<T extends { validFrom: string }>(
  versions: T[],
  date: string,
): T | null {
  let found: T | null = null;
  for (const version of versions)
    if (
      version.validFrom <= date &&
      (!found || version.validFrom > found.validFrom)
    )
      found = version;
  return found;
}
