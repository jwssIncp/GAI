import {
  DRE_DEFAULT_MODEL,
  DRE_DEFAULT_RULES,
  planDefaultModel,
} from '../../../../src/modules/managerial-dre/dre-default-model';

describe('Modelo padrão de DRE', () => {
  it('tem 8 agrupadoras e 23 contas de lançamento, sem nomes de pessoas, e associa todos os tipos', () => {
    expect(DRE_DEFAULT_MODEL.filter((a) => a.synthetic)).toHaveLength(8);
    expect(DRE_DEFAULT_MODEL.filter((a) => !a.synthetic)).toHaveLength(23);
    expect(Object.keys(DRE_DEFAULT_RULES)).toHaveLength(13);
    for (const code of Object.values(DRE_DEFAULT_RULES))
      expect(DRE_DEFAULT_MODEL.find((a) => a.code === code)?.synthetic).toBe(
        false,
      );
    expect(
      DRE_DEFAULT_MODEL.filter((a) => a.post_operational).map((a) => a.code),
    ).toEqual(['5.01', '5.02', '5.03', '5.04']);
  });

  it('organização sem plano: cria tudo, associa os 13 tipos e marca os pós-operacionais', () => {
    const p = planDefaultModel([], {}, []);
    expect(p.totals).toEqual({ create: 31, exists: 0, conflict: 0, map: 13 });
    expect(p.post_operational.every((x) => x.action === 'mark')).toBe(true);
  });

  it('completa sem sobrescrever: conta igual é reaproveitada, associação existente é mantida, conflito não é tocado', () => {
    const p = planDefaultModel(
      [
        {
          id: 10,
          code: '1',
          name: 'Receitas',
          group: 'revenue',
          posting: false,
          active: true,
        },
        {
          id: 11,
          code: '1.01',
          name: 'Receita de serviços (faturamento)',
          group: 'revenue',
          posting: true,
          active: true,
        },
        {
          id: 14,
          code: '2.02',
          name: 'Descontos e abatimentos',
          group: 'deductions',
          posting: true,
          active: true,
        }, // mesmo código, outro nome
        {
          id: 12,
          code: '2.01',
          name: 'Imposto de renda sobre o faturamento',
          group: 'operating_expense',
          posting: true,
          active: true,
        }, // outro grupo
        {
          id: 13,
          code: '3',
          name: 'Custos variáveis',
          group: 'direct_cost',
          posting: false,
          active: false,
        }, // agrupadora excluída
      ],
      { income_tax: 99 },
      [],
    );
    const by = (code: string) => p.accounts.find((a) => a.code === code)!;
    expect(by('1.01')).toMatchObject({ action: 'exists', account_id: 11 });
    expect(by('2.01').action).toBe('conflict');
    expect(by('3').action).toBe('conflict');
    expect(by('3.01')).toMatchObject({
      action: 'conflict',
      note: expect.stringContaining('agrupadora'),
    });
    const rule = (k: string) => p.rules.find((r) => r.kind === k)!;
    expect(rule('income_tax').action).toBe('kept'); // já associado a outra conta
    expect(rule('billing_revenue').action).toBe('map');
    expect(rule('field_agents').action).toBe('skip'); // 3.01 indisponível
    expect(rule('additional_income_tax').action).toBe('skip'); // 2.02 é outra conta
    expect(by('2.02').note).toContain('outro nome');
  });
});
