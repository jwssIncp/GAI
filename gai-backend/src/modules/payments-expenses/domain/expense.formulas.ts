/**
 * Fórmulas das despesas (doc 06 §3.4, doc 07 §2.3 e decisões D-B, D-E e §8.1).
 * Todo valor em centavos (BigInt): nada de ponto flutuante.
 */
import { fromCents, percentOf, toCents } from './remuneration.formulas';

export const EXPENSE_TYPES = ['reimbursable', 'non_reimbursable'] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];
export const PAYMENT_METHODS = ['cash', 'installments', 'invoiced'] as const;
export type ExpensePaymentMethod = (typeof PAYMENT_METHODS)[number];
export const MAX_INSTALLMENTS = 120;

/** Despesas que contam nos totais: nem canceladas nem rejeitadas (D-L). */
export const COUNTED_EXPENSE = (status: string) =>
  status !== 'cancelled' && status !== 'rejected';

export class ExpenseRuleError extends Error {}

/**
 * Tipo padrão de uma despesa nova, a partir de "despesas por conta de" do contrato:
 * cliente → reembolsável; empresa → não reembolsável. Contratos com respostas
 * diferentes (ou sem resposta) não definem padrão: a pessoa escolhe.
 */
export function defaultExpenseType(
  payers: Array<string | null | undefined>,
): ExpenseType | null {
  const set = new Set(payers.filter(Boolean));
  if (set.size !== 1) return null;
  return set.has('client')
    ? 'reimbursable'
    : set.has('company')
      ? 'non_reimbursable'
      : null;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data civil + n meses; o dia é limitado ao último dia do mês de destino (31/01 + 1 = 28/02). */
export function addMonths(civil: string, months: number): string {
  const match = DATE.exec(civil);
  if (!match) throw new ExpenseRuleError('Data inválida.');
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export interface InstallmentLine {
  number: number;
  due_date: string;
  amount: string;
}

/**
 * Parcelas "a prazo" (D-E, regra do INVESTOR): cota = arredondar(valor / n, 2);
 * as n − 1 primeiras recebem a cota e a última o restante; vencimentos =
 * data da compra + 1, 2, … n meses. A soma sempre bate com o valor.
 */
export function installmentPlan(
  amount: string,
  count: number,
  purchaseDate: string,
): InstallmentLine[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS)
    throw new ExpenseRuleError(`Informe de 1 a ${MAX_INSTALLMENTS} parcelas.`);
  const total = toCents(amount);
  const n = BigInt(count);
  const share = (total * 2n + n) / (2n * n); // arredondamento meio para cima
  const last = total - share * (n - 1n);
  if (share <= 0n || last <= 0n)
    throw new ExpenseRuleError(
      `O valor não comporta ${count} parcelas de pelo menos R$ 0,01.`,
    );
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    due_date: addMonths(purchaseDate, i + 1),
    amount: fromCents(i === count - 1 ? last : share),
  }));
}

/** Grade editada pela pessoa: cada parcela > 0, data válida e soma igual ao valor. */
export function validateInstallments(
  amount: string,
  lines: Array<{ due_date: string; amount: string }>,
): InstallmentLine[] {
  if (!lines.length || lines.length > MAX_INSTALLMENTS)
    throw new ExpenseRuleError(`Informe de 1 a ${MAX_INSTALLMENTS} parcelas.`);
  let sum = 0n;
  const out = lines.map((line, i) => {
    if (!DATE.test(line.due_date) || Number.isNaN(Date.parse(line.due_date)))
      throw new ExpenseRuleError(`Parcela ${i + 1}: vencimento inválido.`);
    const cents = toCents(line.amount);
    if (cents <= 0n)
      throw new ExpenseRuleError(`Parcela ${i + 1}: valor deve ser positivo.`);
    sum += cents;
    return { number: i + 1, due_date: line.due_date, amount: fromCents(cents) };
  });
  if (sum !== toCents(amount))
    throw new ExpenseRuleError(
      `A soma das parcelas (${fromCents(sum)}) difere do valor da despesa (${fromCents(toCents(amount))}).`,
    );
  return out;
}

/** Lote que já foi cobrado do cliente: a despesa sai de "A reembolsar". */
export const BILLED_BATCH = (status: string | null | undefined) =>
  status === 'billed' || status === 'received';

/**
 * "A reembolsar" (regra única, §8.1 aprovada): despesa reembolsável (pelo tipo
 * da própria despesa), contada nos totais e ainda não incluída num lote faturado.
 */
export function isToReimburse(expense: {
  expenseType: string | null;
  status: string;
  batchStatus: string | null;
}): boolean {
  return (
    expense.expenseType === 'reimbursable' &&
    COUNTED_EXPENSE(expense.status) &&
    !BILLED_BATCH(expense.batchStatus)
  );
}

/** Saldo por lançamento (exportações): depositado − valor; sem depósito, não há saldo. */
export function lineBalance(
  deposited: string | null,
  amount: string,
): string | null {
  if (deposited === null) return null;
  return fromCents(toCents(deposited) - toCents(amount));
}

/** Saldo do técnico no projeto: Σ adiantamentos − Σ despesas (pode ser negativo). */
export function agentBalance(advances: string[], expenses: string[]): string {
  const sum = (values: string[]) => values.reduce((s, v) => s + toCents(v), 0n);
  return fromCents(sum(advances) - sum(expenses));
}

/** % do contrato = (reembolsáveis + não reembolsáveis) / valor do contrato × 100. */
export function contractShare(
  reimbursable: string,
  nonReimbursable: string,
  contractValue: string,
): string | null {
  return percentOf(
    fromCents(toCents(reimbursable) + toCents(nonReimbursable)),
    contractValue,
  );
}
