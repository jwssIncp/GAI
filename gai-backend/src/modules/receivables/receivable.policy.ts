import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { civil, decimal, paymentPlan, scaled } from '../budgets/budget.policy';
import { BudgetPaymentDto } from '../budgets/budget.dto';
export { civil, decimal, scaled };
export const FINANCE_PERMISSIONS = [
  'receivables:read',
  'receivables:edit',
  'receivables:receive',
  'receivables:reverse',
  'cash-flow:read',
  'finance:export',
];
export function invalid(message: string): never {
  throw new BadRequestException({ code: 'FINANCE_INVALID', message });
}
export function conflict(message: string): never {
  throw new ConflictException({ code: 'FINANCE_CONFLICT', message });
}
export function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function signed(value: string) {
  return value.startsWith('-') ? -scaled(value.slice(1)) : scaled(value);
}
export function plan(
  amount: string,
  payment: BudgetPaymentDto,
  issued: string,
) {
  civil(issued);
  if (scaled(amount) <= 0n) invalid('O valor deve ser positivo.');
  const p = paymentPlan(scaled(amount), payment, issued);
  if (p.rows.some((r) => scaled(r.amount) <= 0n))
    invalid('Todas as parcelas devem ter valor positivo.');
  return p;
}
export function balance(
  amount: string,
  movements: Array<{ operation: string; amount: string | null }>,
) {
  const received = movements.reduce(
    (s, e) => s + (e.amount == null ? 0n : signed(e.amount)),
    0n,
  );
  const open = scaled(amount) - received;
  if (received < 0n || open < 0n) conflict('Saldo financeiro inconsistente.');
  return {
    received: decimal(received),
    open: decimal(open),
    status: open === 0n ? 'paid' : received > 0n ? 'partial' : 'open',
  };
}
