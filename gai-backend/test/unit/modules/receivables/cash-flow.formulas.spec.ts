import {
  addDays,
  addMonths,
  amendmentProposal,
  cashFlowKpis,
  contractProposal,
  type FlowItem,
  incomeTax,
  lastDayOfNextMonth,
  splitEqual,
  splitPercentages,
} from '../../../../src/modules/receivables/cash-flow.formulas';

describe('Fluxo de caixa: fórmulas (doc 06 §7.2–§7.4)', () => {
  it('parcelas do contrato: data do contrato + prazo da 1ª parcela + i meses', () => {
    // 12.000 em 3 iguais, contrato 02/11/2026, prazo 30 dias → 02/12, 02/01, 02/02
    expect(
      contractProposal({
        value: '12000.00',
        contractedOn: '2026-11-02',
        firstInstallmentDays: 30,
        plan: { mode: 'equal', installments: 3 },
      }),
    ).toEqual([
      { number: 1, due_on: '2026-12-02', amount: '4000.00' },
      { number: 2, due_on: '2027-01-02', amount: '4000.00' },
      { number: 3, due_on: '2027-02-02', amount: '4000.00' },
    ]);
    // 10.000 em 30%/70%, contrato 01/05/2026 → 31/05 e 30/06 (dia limitado ao fim do mês)
    expect(
      contractProposal({
        value: '10000.00',
        contractedOn: '2026-05-01',
        firstInstallmentDays: 30,
        plan: {
          mode: 'percentages',
          installments: 2,
          percentages: ['30.00', '70.00'],
        },
      }),
    ).toEqual([
      { number: 1, due_on: '2026-05-31', amount: '3000.00' },
      { number: 2, due_on: '2026-06-30', amount: '7000.00' },
    ]);
    // Sem plano: 1 parcela de 100%
    expect(
      contractProposal({
        value: '1000.00',
        contractedOn: '2026-01-31',
        firstInstallmentDays: 0,
        plan: null,
      }),
    ).toEqual([{ number: 1, due_on: '2026-01-31', amount: '1000.00' }]);
  });

  it('aditivo: valor / parcelas, 1ª na data do aditivo + prazo; resto na última', () => {
    expect(
      amendmentProposal({
        value: '3000.00',
        datedOn: '2026-12-05',
        installments: 2,
        firstInstallmentDays: 30,
      }),
    ).toEqual([
      { number: 1, due_on: '2027-01-04', amount: '1500.00' },
      { number: 2, due_on: '2027-02-04', amount: '1500.00' },
    ]);
    expect(splitEqual('100.00', 3)).toEqual(['33.33', '33.33', '33.34']);
    expect(splitPercentages('100.00', ['33.33', '33.33', '33.34'])).toEqual([
      '33.33',
      '33.33',
      '33.34',
    ]);
  });

  it('IR derivado = valor × %IR (meio para cima); negativo no estorno', () => {
    expect(incomeTax('4000.00', '13.33')).toBe('533.20');
    expect(incomeTax('7000.00', '13.33')).toBe('933.10');
    expect(incomeTax('1500.00', '13.33')).toBe('199.95');
    expect(incomeTax('3000.00', '13.33')).toBe('399.90');
    expect(incomeTax('-4000.00', '13.33')).toBe('-533.20');
    expect(incomeTax('0.10', '13.33')).toBe('0.01'); // 0,01333 → 0,01
  });

  it('datas: +dias, +meses (fim de mês) e último dia do mês seguinte', () => {
    expect(addDays('2026-11-02', 30)).toBe('2026-12-02');
    expect(addDays('2026-12-05', 30)).toBe('2027-01-04');
    expect(addMonths('2026-05-31', 1)).toBe('2026-06-30');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(lastDayOfNextMonth('2026-11-13')).toBe('2026-12-31');
    expect(lastDayOfNextMonth('2026-12-02')).toBe('2027-01-31');
  });

  it('KPIs: mês, próximo mês (líquido de IR), ano e atrasos a partir da mesma lista', () => {
    const item = (
      p: Partial<FlowItem> &
        Pick<FlowItem, 'key' | 'direction' | 'date' | 'gross' | 'status'>,
    ): FlowItem => ({
      group: p.direction === 'in' ? 'billing' : 'non_reimbursable',
      origin: 'contract',
      origin_label: '',
      project_id: 1,
      project_name: 'A',
      currency: 'BRL',
      expected_on: p.date,
      realized_on: p.status === 'realized' ? p.date : null,
      overdue: false,
      overdue_days: 0,
      net: p.gross,
      derived: false,
      installment: null,
      contract_pct: null,
      description: '',
      refs: {},
      ...p,
    });
    const items = [
      item({
        key: 'a',
        direction: 'in',
        date: '2026-12-02',
        gross: '4000.00',
        net: '3466.80',
        status: 'realized',
      }),
      item({
        key: 'ir-a',
        direction: 'out',
        date: '2026-12-02',
        gross: '533.20',
        status: 'realized',
        origin: 'income_tax',
        derived: true,
      }),
      item({
        key: 'b',
        direction: 'in',
        date: '2027-01-02',
        gross: '4000.00',
        net: '3466.80',
        status: 'open',
      }),
      item({
        key: 'ir-b',
        direction: 'out',
        date: '2027-01-02',
        gross: '533.20',
        status: 'open',
        origin: 'income_tax',
        derived: true,
      }),
      item({
        key: 'c',
        direction: 'out',
        date: '2026-12-10',
        gross: '1000.00',
        status: 'open',
      }),
      item({
        key: 'd',
        direction: 'out',
        date: '2027-01-13',
        gross: '100.00',
        status: 'open',
      }),
      item({
        key: 'e',
        direction: 'in',
        date: '2026-05-31',
        gross: '3000.00',
        net: '2600.10',
        status: 'open',
        overdue: true,
      }),
      item({
        key: 'f',
        direction: 'in',
        date: '2027-01-04',
        gross: '1500.00',
        net: '1300.05',
        status: 'proposed',
      }),
    ];
    // estornado: fica fora de todos os KPIs
    items.push(
      item({
        key: 'rev',
        direction: 'in',
        date: '2026-12-05',
        gross: '9999.00',
        status: 'reversed',
      }),
    );
    const [brl] = cashFlowKpis(items, { month: '2026-12', year: '2026' });
    // mês: 4.000 recebido; saídas 533,20 pagas + 1.000 a pagar → 4.000 − 1.533,20
    expect(brl.month).toEqual({
      reference: '2026-12',
      in_realized: '4000.00',
      in_open: '0.00',
      out_realized: '533.20',
      out_open: '1000.00',
      total: '2466.80',
    });
    // próximo: entradas líquidas 3.466,80 + 1.300,05; saídas sem IR: 100
    expect(brl.next_month).toEqual({
      reference: '2027-01',
      in_gross: '5500.00',
      in_net: '4766.85',
      out: '100.00',
      total: '4666.85',
    });
    // ano 2026: entradas 4.000 + 3.000; saídas 533,20 + 1.000
    expect(brl.year).toEqual({
      reference: '2026',
      in: '7000.00',
      out: '1533.20',
      total: '5466.80',
      in_open_net: '2600.10',
      out_open: '1000.00',
    });
    expect(brl.overdue).toEqual({
      in: '3000.00',
      in_count: 1,
      out: '0.00',
      out_count: 0,
    });
    expect(brl.proposed).toEqual({ amount: '1500.00', count: 1 });
  });
});
