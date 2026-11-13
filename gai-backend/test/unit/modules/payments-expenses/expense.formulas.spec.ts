import {
  addMonths,
  agentBalance,
  contractShare,
  defaultExpenseType,
  ExpenseRuleError,
  installmentPlan,
  isToReimburse,
  lineBalance,
  validateInstallments,
} from '../../../../src/modules/payments-expenses/domain/expense.formulas';

describe('Fórmulas das despesas (doc 06 §3.4, D-E, §8.1)', () => {
  it('tipo padrão vem de "despesas por conta de" do contrato', () => {
    expect(defaultExpenseType(['client'])).toBe('reimbursable');
    expect(defaultExpenseType(['company', 'company'])).toBe('non_reimbursable');
    expect(defaultExpenseType([null, 'client'])).toBe('reimbursable');
    // contratos divergentes ou sem resposta: não há padrão, a pessoa escolhe
    expect(defaultExpenseType(['client', 'company'])).toBeNull();
    expect(defaultExpenseType([])).toBeNull();
  });

  it('parcelas: cota arredondada, resto na última, vencimentos +1…n meses', () => {
    // R$ 100,00 em 3x a partir de 15/01/2026: 33,33 + 33,33 + 33,34
    expect(installmentPlan('100.00', 3, '2026-01-15')).toEqual([
      { number: 1, due_date: '2026-02-15', amount: '33.33' },
      { number: 2, due_date: '2026-03-15', amount: '33.33' },
      { number: 3, due_date: '2026-04-15', amount: '33.34' },
    ]);
    // R$ 10,00 em 3x: cota 3,33 (3,333…), última 3,34
    expect(
      installmentPlan('10.00', 3, '2026-11-13').map((l) => l.amount),
    ).toEqual(['3.33', '3.33', '3.34']);
    // R$ 0,05 em 2x: cota arredondada para cima (0,025 → 0,03), última 0,02
    expect(
      installmentPlan('0.05', 2, '2026-11-13').map((l) => l.amount),
    ).toEqual(['0.03', '0.02']);
    // R$ 200,00 em 1x: parcela única vence um mês depois
    expect(installmentPlan('200.00', 1, '2026-11-13')).toEqual([
      { number: 1, due_date: '2026-12-13', amount: '200.00' },
    ]);
  });

  it('parcelas: soma sempre igual ao valor e limites', () => {
    for (const [amount, n] of [
      ['1234.56', 7],
      ['999.99', 12],
      ['0.10', 10],
    ] as const) {
      const plan = installmentPlan(amount, n, '2026-01-31');
      const sum = plan.reduce(
        (s, l) => s + Math.round(Number(l.amount) * 100),
        0,
      );
      expect(sum).toBe(Math.round(Number(amount) * 100));
    }
    expect(() => installmentPlan('0.05', 10, '2026-01-01')).toThrow(
      ExpenseRuleError,
    );
    expect(() => installmentPlan('10.00', 0, '2026-01-01')).toThrow(
      ExpenseRuleError,
    );
    expect(() => installmentPlan('10.00', 121, '2026-01-01')).toThrow(
      ExpenseRuleError,
    );
  });

  it('meses: dia limitado ao fim do mês e virada de ano', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('grade editada: preserva valores e datas, mas a soma tem de bater', () => {
    expect(
      validateInstallments('100.00', [
        { due_date: '2026-02-10', amount: '50' },
        { due_date: '2026-03-20', amount: '50.00' },
      ]),
    ).toEqual([
      { number: 1, due_date: '2026-02-10', amount: '50.00' },
      { number: 2, due_date: '2026-03-20', amount: '50.00' },
    ]);
    expect(() =>
      validateInstallments('100.00', [
        { due_date: '2026-02-10', amount: '60.00' },
        { due_date: '2026-03-10', amount: '50.00' },
      ]),
    ).toThrow(
      /soma das parcelas \(110.00\) difere do valor da despesa \(100.00\)/,
    );
    expect(() =>
      validateInstallments('100.00', [
        { due_date: '2026-02-30x', amount: '100.00' },
      ]),
    ).toThrow(/vencimento inválido/);
    expect(() =>
      validateInstallments('0.00', [
        { due_date: '2026-02-10', amount: '0.00' },
      ]),
    ).toThrow(/positivo/);
  });

  it('"A reembolsar": tipo da despesa reembolsável, contada e fora de lote faturado', () => {
    const base = {
      expenseType: 'reimbursable',
      status: 'approved',
      batchStatus: null,
    };
    expect(isToReimburse(base)).toBe(true);
    expect(isToReimburse({ ...base, batchStatus: 'open' })).toBe(true); // lote ainda não faturado
    expect(isToReimburse({ ...base, batchStatus: 'cancelled' })).toBe(true);
    expect(isToReimburse({ ...base, batchStatus: 'billed' })).toBe(false);
    expect(isToReimburse({ ...base, batchStatus: 'received' })).toBe(false);
    expect(isToReimburse({ ...base, status: 'rejected' })).toBe(false);
    expect(isToReimburse({ ...base, status: 'cancelled' })).toBe(false);
    expect(isToReimburse({ ...base, expenseType: 'non_reimbursable' })).toBe(
      false,
    );
    expect(isToReimburse({ ...base, expenseType: null })).toBe(false); // não classificada
  });

  it('saldos: por lançamento (depositado − valor) e do técnico (adiantamentos − despesas)', () => {
    expect(lineBalance('150.00', '120.50')).toBe('29.50');
    expect(lineBalance('100.00', '120.50')).toBe('-20.50');
    expect(lineBalance(null, '120.50')).toBeNull();
    // adiantamentos 500 + 300; despesas 450,25 + 400 → saldo −50,25
    expect(agentBalance(['500.00', '300.00'], ['450.25', '400.00'])).toBe(
      '-50.25',
    );
    expect(agentBalance([], [])).toBe('0.00');
    expect(agentBalance(['1000.00'], ['250.00'])).toBe('750.00');
  });

  it('% do contrato = (reembolsáveis + não reembolsáveis) / contrato × 100', () => {
    // (3.000 + 1.500) / 30.000 = 15%
    expect(contractShare('3000.00', '1500.00', '30000.00')).toBe('15.00');
    // 1/3 = 33,33%
    expect(contractShare('100.00', '0.00', '300.00')).toBe('33.33');
    expect(contractShare('100.00', '0.00', '0.00')).toBeNull();
  });
});
