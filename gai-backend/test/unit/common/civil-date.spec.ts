import { UpdateInventoryAccountingItemDto } from '../../../src/modules/inventory-accounting-items/application/dto/inventory-accounting-item-inputs';
import { InventoryAccountingItemScopeService } from '../../../src/modules/inventory-accounting-items/application/services/inventory-accounting-item-scope.service';
import { validateSync } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { isCivilDate } from '../../../src/common/validation/civil-date';
import { CIVIL_DATE_TRANSFORMER } from '../../../src/common/persistence/civil-date.transformer';
import { CreateInventoryObservationDto } from '../../../src/modules/inventory-operations/application/inventory-operation.dto';
import {
  PaymentInputDto,
  ExpenseInputDto,
  MarkAsPaidDto,
} from '../../../src/modules/payments-expenses/application/dto/payments-expenses-inputs';
import { ContractDataDto } from '../../../src/modules/contracts/contract.dto';
import { BudgetPaymentDto } from '../../../src/modules/budgets/budget.dto';
import {
  ReceivableInputDto,
  ReceiptDto,
  ReverseReceiptDto,
} from '../../../src/modules/receivables/receivable.dto';
import {
  CreateExpenseAccountabilityDto,
  GenerateExpenseInstallmentsDto,
} from '../../../src/modules/expense-accountabilities/expense-accountability.dto';
import { PaymentsExpensesScopeService } from '../../../src/modules/payments-expenses/application/services/payments-expenses-scope.service';
import { civil } from '../../../src/modules/budgets/budget.policy';
import { month } from '../../../src/modules/managerial-dre/dre.policy';
import { monthlyDueDate } from '../../../src/modules/expense-accountabilities/monthly-due-date.policy';

describe('Civil date contract: Gregorian day, not an instant', () => {
  it('requires an explicit offset on captured instants while retaining valid UTC conversion', () => {
    for (const value of [
      '2026-03-31',
      '2026-03-31T23:30:00',
      '2026-02-30T12:00:00Z',
    ]) {
      expect(
        validateSync(
          Object.assign(new CreateInventoryObservationDto(), {
            captured_at: value,
          }),
        ).some((e) => e.property === 'captured_at'),
      ).toBe(true);
    }
    const value = '2026-03-31T23:30:00-03:00';
    expect(
      validateSync(
        Object.assign(new CreateInventoryObservationDto(), {
          captured_at: value,
        }),
      ).some((e) => e.property === 'captured_at'),
    ).toBe(false);
    expect(new Date(value).toISOString()).toBe('2026-04-01T02:30:00.000Z');
  });
  it('binds UTC-anchored Date values as civil strings and does not reinterpret reads', () => {
    expect(CIVIL_DATE_TRANSFORMER.to(new Date('2024-02-29T00:00:00Z'))).toBe(
      '2024-02-29',
    );
    expect(CIVIL_DATE_TRANSFORMER.to('2024-02-29')).toBe('2024-02-29');
    expect(() => CIVIL_DATE_TRANSFORMER.to(new Date('invalid'))).toThrow(
      BadRequestException,
    );
    expect(CIVIL_DATE_TRANSFORMER.from('1900-01-01')).toBe('1900-01-01');
  });
  it.each([
    '1000-01-01',
    '9999-12-31',
    '2000-02-29',
    '2024-02-29',
    '2026-02-28',
    '2026-04-30',
  ])('accepts %s without normalization', (value) => {
    expect(isCivilDate(value)).toBe(true);
    expect(civil(value)).toBe(value);
  });
  it.each([
    '2026-02-30',
    '2026-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-00-10',
    '2026-13-01',
    '2026-01-00',
    '2026-01-32',
    '0000-01-01',
    '0999-12-31',
    '10000-01-01',
    '2026-1-01',
    '01/02/2026',
    '2026-02-28T00:00:00Z',
    ' 2026-02-28',
    '',
    null,
    undefined,
    20260228,
  ])('rejects invalid civil value %s', (value) => {
    expect(isCivilDate(value)).toBe(false);
    expect(() => civil(value as string)).toThrow(BadRequestException);
  });
  it('rejects out-of-range and nonfinite acquisition dates from spreadsheets', () => {
    const scope = new InventoryAccountingItemScopeService();
    for (const value of [
      '2026-02-30',
      '0999-01-01',
      new Date('0999-01-01T00:00:00Z'),
      NaN,
      Infinity,
      -4000000,
    ])
      expect(scope.parseDate(value)).toBeNull();
    expect(scope.parseDate('2024-02-29')?.toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    );
    expect(scope.parseDate(1)?.toISOString()).toBe('1899-12-31T00:00:00.000Z');
  });
  const fields: Array<[new () => object, string]> = [
    [PaymentInputDto, 'start_date'],
    [PaymentInputDto, 'end_date'],
    [PaymentInputDto, 'payment_date'],
    [ExpenseInputDto, 'expense_date'],
    [UpdateInventoryAccountingItemDto, 'acquisition_date'],
    [MarkAsPaidDto, 'payment_date'],
    [ContractDataDto, 'starts_on'],
    [BudgetPaymentDto, 'first_due_on'],
    [ReceivableInputDto, 'issued_on'],
    [ReceiptDto, 'received_on'],
    [ReverseReceiptDto, 'reversed_on'],
    [CreateExpenseAccountabilityDto, 'period_start'],
    [GenerateExpenseInstallmentsDto, 'first_due_date'],
  ];
  it.each(fields)('%p validates its %s as a civil date', (Dto, field) => {
    for (const value of [
      '2026-02-30',
      '2026-13-01',
      '2026-01-01T00:00:00Z',
      '',
      '0999-01-01',
    ]) {
      expect(
        validateSync(Object.assign(new Dto(), { [field]: value })).some(
          (e) => e.property === field,
        ),
      ).toBe(true);
    }
    expect(
      validateSync(Object.assign(new Dto(), { [field]: '2024-02-29' })).some(
        (e) => e.property === field,
      ),
    ).toBe(false);
  });
  it('does not silently clear invalid optional payment dates inside the service', () => {
    const scope = new PaymentsExpensesScopeService();
    expect(scope.parseDate(undefined)).toBeNull();
    expect(scope.parseDate(null)).toBeNull();
    for (const value of ['', '2026-02-30'])
      expect(() => scope.parseDate(value)).toThrow(BadRequestException);
    expect(scope.parseDate('2024-02-29')?.toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    );
  });
  it('validates each custom installment date', () => {
    const dto = Object.assign(new BudgetPaymentDto(), {
      dates: ['2024-02-29', '2026-02-30'],
    });
    expect(validateSync(dto).some((e) => e.property === 'dates')).toBe(true);
  });
  it('keeps month-end policy and rejects schedules beyond the supported calendar', () => {
    expect(
      monthlyDueDate(new Date('2024-01-31T00:00:00Z'), 1)
        .toISOString()
        .slice(0, 10),
    ).toBe('2024-02-29');
    expect(
      monthlyDueDate(new Date('2024-01-31T00:00:00Z'), 2)
        .toISOString()
        .slice(0, 10),
    ).toBe('2024-03-31');
    expect(() => monthlyDueDate(new Date('9999-12-31T00:00:00Z'), 1)).toThrow(
      BadRequestException,
    );
  });
  it.each(['0000-01', '0999-12', '2026-00', '2026-13', '2026-02-30', '2026-2'])(
    'rejects invalid financial competence %s',
    (value) => expect(() => month(value)).toThrow(BadRequestException),
  );
});
