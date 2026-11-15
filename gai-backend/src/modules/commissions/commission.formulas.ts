/**
 * Fórmulas das comissões (doc 06 §6.2). Valores em centavos (BigInt),
 * percentuais com duas casas.
 */
export class CommissionRuleError extends Error {}

const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const PCT = /^\d{1,3}(\.\d{1,2})?$/;

const cents = (value: string) => {
  if (!MONEY.test(value))
    throw new CommissionRuleError(
      'Valor deve usar ponto decimal e até duas casas.',
    );
  const [w, f = ''] = value.split('.');
  return BigInt(w) * 100n + BigInt(f.padEnd(2, '0'));
};
const money = (value: bigint) =>
  `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;

/** comissão = valor × % / 100 (meio para cima); o valor manual prevalece. */
export function commissionAmount(
  contractValue: string,
  percent: string,
  manual: string | null,
): string {
  if (manual !== null) return money(cents(manual));
  if (!PCT.test(percent))
    throw new CommissionRuleError('Percentual deve ter até duas casas.');
  const [w, f = ''] = percent.split('.');
  const basisPoints = BigInt(w) * 100n + BigInt(f.padEnd(2, '0'));
  if (basisPoints > 10000n)
    throw new CommissionRuleError('Percentual acima de 100%.');
  return money((cents(contractValue) * basisPoints * 2n + 10000n) / 20000n);
}

export type CommissionStatus = 'paid' | 'overdue' | 'pending';

/** Pago se tem data de pagamento; atrasado se a prevista já passou; senão pendente. */
export function commissionStatus(
  paidOn: string | null,
  expectedOn: string | null,
  today: string,
): CommissionStatus {
  if (paidOn) return 'paid';
  if (expectedOn && expectedOn < today) return 'overdue';
  return 'pending';
}

/** Chave de unicidade do parceiro: nome + empresa sem acento, caixa ou espaços extras. */
export function partnerKey(name: string, company: string | null | undefined) {
  const fold = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/\s+/g, ' ')
      .trim();
  return `${fold(name)}|${fold(company ?? '')}`;
}
