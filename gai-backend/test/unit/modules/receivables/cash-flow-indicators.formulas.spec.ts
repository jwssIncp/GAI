import {
  accountingBreakEven,
  averageCollectionDays,
  contributionMargin,
  economicBreakEven,
  fixedCostMonthly,
  netMargin,
  partnerCommission,
  pctOf,
  pctText,
  pctUnits,
  ratio,
  saleResult,
} from '../../../../src/modules/receivables/cash-flow-indicators.formulas';

describe('indicadores do fluxo de caixa (fórmulas)', () => {
  it('percentuais em unidades de 1e-4 ponto', () => {
    expect(pctUnits('13.33')).toBe(133300n);
    expect(pctUnits('8')).toBe(80000n);
    expect(pctText(605030n)).toBe('60.50');
    expect(pctText(86670n)).toBe('8.67');
    expect(pctText(-262743n * 100n)).toBe('-2627.43');
    expect(ratio('533.20', '4000.00')).toBe(133300n);
    expect(ratio('1.00', '0.00')).toBeNull();
  });

  it('margem de contribuição: 100 − IR − diárias − não reemb. − comissão − sócio × (1 − IR)', () => {
    // receita 4.000; IR 533,20 (13,33%); diárias 500 (12,5%); não reemb. 200 (5%);
    // comissão 120 (3%); sócio 10% × 86,67% = 8,667%
    const m = contributionMargin({
      revenue: '4000.00',
      incomeTax: '533.20',
      fieldAgents: '500.00',
      nonReimbursable: '200.00',
      commissions: '120.00',
      partnerPct: '10.00',
    })!;
    expect(m.mc).toBe('57.50'); // 100 − 13,33 − 12,5 − 5 − 3 − 8,667 = 57,503
    expect(m.mce).toBe('62.50'); // MC + não reembolsáveis
    expect(m.partner_effective_pct).toBe('8.67');
    expect(m.units.mce).toBe(625030n);
    expect(
      contributionMargin({
        revenue: '0.00',
        incomeTax: '0.00',
        fieldAgents: '0.00',
        nonReimbursable: '0.00',
        commissions: '0.00',
        partnerPct: '10.00',
      }),
    ).toBeNull();
  });

  it('custo fixo: uma só função para cards e detalhamento; "média DRE" fica indisponível (nunca zero silencioso)', () => {
    const f = fixedCostMonthly({
      operation: '10915.00',
      branch: '3021.00',
      modes: {
        additional_income_tax: 'average_3_months',
        equipment: 'fixed',
        back_office: 'zero',
      },
      amounts: { equipment: '500.00' },
    });
    expect(f.total).toBe('14436.00'); // 10.915 + 3.021 + 500 + 0
    expect(f.unavailable).toEqual(['additional_income_tax']);
    expect(
      f.items.find((i) => i.key === 'additional_income_tax')!.amount,
    ).toBeNull();
    expect(f.items.find((i) => i.key === 'back_office')!.amount).toBe('0.00');
  });

  it('ponto de equilíbrio contábil: falta = −resultado / MCe', () => {
    expect(accountingBreakEven('-164215.10', 655030n)).toBe('250698.59');
    expect(accountingBreakEven('100.00', 655030n)).toBe('0.00'); // atingido
    expect(accountingBreakEven('-1.00', 0n)).toBeNull(); // MCe ≤ 0: indefinido
  });

  it('ponto de equilíbrio econômico: (margem × receita − resultado) / (MCe − margem)', () => {
    // (700 + 164.215,10) / 0,55503 = 297.128,26
    expect(economicBreakEven('-164215.10', '7000.00', '10.00', 655030n)).toBe(
      '297128.26',
    );
    // resultado já cobre a margem: 0
    expect(economicBreakEven('1000.00', '7000.00', '10.00', 655030n)).toBe(
      '0.00',
    );
    expect(economicBreakEven('0.00', '7000.00', '70.00', 655030n)).toBeNull();
  });

  it('margem líquida usa 1 − IR dos parâmetros (não 0,8667 fixo)', () => {
    // −33.689,20 / (84.000 − 4.650/0,8667) = −42,84% (cenário de referência)
    expect(netMargin('-33689.20', '84000.00', '4650.00', '13.33')).toBe(
      '-42.84',
    );
    // −164.215,10 / (7.000 − 650/0,8667) = −2.627,43%: além de ±1.000%, indefinida
    expect(netMargin('-164215.10', '7000.00', '650.00', '13.33')).toBeNull();
    // IR 10%: 1.000 / (11.000 − 900/0,9) = 10,00%
    expect(netMargin('1000.00', '11000.00', '900.00', '10.00')).toBe('10.00');
    expect(netMargin('1.00', '100.00', '100.00', '10.00')).toBeNull();
  });

  it('prazo médio de recebimento ponderado pelo valor (1 casa)', () => {
    expect(
      averageCollectionDays([
        {
          amount: '4000.00',
          contracted_on: '2026-11-02',
          received_on: '2026-11-10',
        },
      ]),
    ).toBe('8.0');
    // (1.000 × 10 + 3.000 × 30) / 4.000 = 25,0
    expect(
      averageCollectionDays([
        {
          amount: '1000.00',
          contracted_on: '2026-01-01',
          received_on: '2026-01-11',
        },
        {
          amount: '3000.00',
          contracted_on: '2026-01-01',
          received_on: '2026-01-31',
        },
      ]),
    ).toBe('25.0');
    expect(averageCollectionDays([])).toBeNull();
  });

  it('comissão do sócio: % do operacional de cada trimestre, só quando positivo', () => {
    expect(
      partnerCommission(['12000.00', '-5000.00', '333.35', '0.00'], '10.00'),
    ).toEqual({
      quarters: ['1200.00', '0.00', '33.34', '0.00'],
      year: '1233.34',
    });
  });

  it('venda simulada: resultado = venda do ano × MC (+ não reemb. × % se as despesas são do cliente)', () => {
    expect(pctOf('5000.00', 125000n)).toBe('625.00');
    expect(pctOf('3000.00', 133300n)).toBe('399.90');
    // 5.000 × 60,503% = 3.025,15
    expect(
      saleResult({
        yearSale: '5000.00',
        clientPaysExpenses: false,
        mcUnits: 605030n,
        nonReimbursableUnits: 50000n,
      }),
    ).toEqual({ result: '3025.15', client_share: '0.00' });
    // cliente paga as despesas: + 5.000 × 5% = 250,00
    expect(
      saleResult({
        yearSale: '5000.00',
        clientPaysExpenses: true,
        mcUnits: 605030n,
        nonReimbursableUnits: 50000n,
      }),
    ).toEqual({ result: '3275.15', client_share: '250.00' });
  });

  it('receita irrisória: margem além de ±1.000% fica indefinida (não vira -2018529,41%)', () => {
    expect(netMargin('-10294.50', '0.51', '0.00', '13.33')).toBeNull();
    expect(netMargin('-100.00', '10.00', '0.00', '13.33')).toBe('-1000.00'); // no limite
    expect(
      contributionMargin({
        revenue: '0.60',
        incomeTaxPct: '13.33',
        fieldAgents: '12643.33',
        nonReimbursable: '0.00',
        commissions: '0.00',
        partnerPct: '10.00',
      }),
    ).toBeNull();
  });

  it('IR da MC só sobre o faturamento: revenda de placas (já líquida) e reembolsos não pagam IR de novo', () => {
    // receita 10.000 = 6.000 faturamento + 4.000 revenda de placas; IR 13,33% × 0,6 = 7,998%
    const m = contributionMargin({
      revenue: '10000.00',
      incomeTaxPct: '13.33',
      taxedRevenue: '6000.00',
      fieldAgents: '0.00',
      nonReimbursable: '0.00',
      commissions: '0.00',
      partnerPct: '0.00',
    })!;
    expect(m.income_tax_pct).toBe('8.00'); // 7,998%
    expect(m.mc).toBe('92.00');
    // sem a informação: IR cheio sobre toda a receita (venda simulada é faturamento)
    expect(
      contributionMargin({
        revenue: '10000.00',
        incomeTaxPct: '13.33',
        fieldAgents: '0.00',
        nonReimbursable: '0.00',
        commissions: '0.00',
        partnerPct: '0.00',
      })!.mc,
    ).toBe('86.67');
  });
});
