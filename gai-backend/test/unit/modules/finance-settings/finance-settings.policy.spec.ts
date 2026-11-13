import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  FinanceSettingsValuesDto,
  PublishFinanceSettingsDto,
} from '../../../../src/modules/finance-settings/finance-settings.dto';
import { FinanceSettingsVersionEntity } from '../../../../src/modules/finance-settings/finance-settings.entity';
import {
  assertNewVersionStart,
  civilToday,
  defaultFinanceSettingsValues,
  normalizeFinanceSettingsValues,
  versionInForce,
} from '../../../../src/modules/finance-settings/finance-settings.policy';

const PLATFORM_MAX = 100 * 1024 * 1024;
const values = (patch: Partial<FinanceSettingsValuesDto> = {}) => ({
  ...defaultFinanceSettingsValues(),
  ...patch,
});
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
  return 'NO_ERROR';
};

describe('Parâmetros financeiros: valores padrão (doc 06 §8)', () => {
  it('oferece os valores do INVESTOR como versão inicial', () => {
    const v = defaultFinanceSettingsValues();
    expect(v.income_tax_pct).toBe('13.33');
    expect(v.tag_tax_pct).toBe('16.00');
    expect(v.default_daily_rate).toBe('185.00');
    expect(v.budget_productivity_items_per_day).toBe(80);
    expect(v.budgeted_non_reimbursable_expense_pct).toBe('20.00');
    expect(v.technician_expense_alert_pct).toBe('30.00');
    expect(
      v.commercial_origins.map((o) => [o.label, o.commission_pct]),
    ).toEqual([
      ['Recorrente', '4.00'],
      ['Inbound', '6.00'],
      ['Outbound Novo', '8.00'],
      ['Diretoria', '4.00'],
    ]);
    expect(v.partner_commission_pct).toBe('10.00');
    // Padrão do INVESTOR: os três itens em média de 3 meses, valores fixos zerados.
    expect(v.fixed_cost_item_modes).toEqual({
      additional_income_tax: 'average_3_months',
      equipment: 'average_3_months',
      back_office: 'average_3_months',
    });
    expect(v.fixed_cost_item_amounts).toEqual({
      additional_income_tax: '0.00',
      equipment: '0.00',
      back_office: '0.00',
    });
    expect([v.fixed_cost_operation, v.fixed_cost_branch]).toEqual([
      '10915.00',
      '3021.00',
    ]);
    expect(v.first_installment_days_after_contract).toBe(30);
    expect(v.dre_regime_cutoff_month).toBe('2026-09');
    expect(v.expense_reasons).toEqual([
      'Transporte',
      'Refeição',
      'Lanche',
      'Lavanderia',
      'Outros',
    ]);
    expect(v.tag_models).toEqual(['Alumínio', 'Aço', 'Policarbonato']);
    expect(v.default_tag_supplier).toBe('Planner');
    expect(v.field_agent_document_max_bytes).toBe(2 * 1024 * 1024);
    expect(v.expense_attachment_max_bytes).toBe(8 * 1024 * 1024);
    expect(v.expense_attachment_max_files).toBe(2);
    expect(v.require_approval).toBe(true);
  });

  it('cada chamada devolve uma cópia nova (nenhum cálculo pode alterar o padrão)', () => {
    const a = defaultFinanceSettingsValues();
    a.expense_reasons.push('X');
    expect(defaultFinanceSettingsValues().expense_reasons).toHaveLength(5);
  });

  it('os valores padrão passam na validação do DTO', async () => {
    const dto = plainToInstance(PublishFinanceSettingsDto, {
      valid_from: '2026-11-13',
      reason: 'Versão inicial',
      values: defaultFinanceSettingsValues(),
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('Parâmetros financeiros: normalização e validação', () => {
  it('normaliza decimais para duas casas', () => {
    const out = normalizeFinanceSettingsValues(
      values({ income_tax_pct: '13.3', default_daily_rate: '185' }),
      PLATFORM_MAX,
    );
    expect(out.income_tax_pct).toBe('13.30');
    expect(out.default_daily_rate).toBe('185.00');
  });

  it('recusa percentual acima de 100', () => {
    expect(
      code(() =>
        normalizeFinanceSettingsValues(
          values({ income_tax_pct: '100.01' }),
          PLATFORM_MAX,
        ),
      ),
    ).toBe('FINANCE_SETTINGS_INVALID');
  });

  it('recusa origens comerciais com código repetido', () => {
    const origins = defaultFinanceSettingsValues().commercial_origins;
    expect(
      code(() =>
        normalizeFinanceSettingsValues(
          values({
            commercial_origins: [
              origins[0],
              { ...origins[1], code: origins[0].code },
            ],
          }),
          PLATFORM_MAX,
        ),
      ),
    ).toBe('FINANCE_SETTINGS_INVALID');
  });

  it('recusa listas com itens vazios ou repetidos (sem diferenciar maiúsculas)', () => {
    for (const expense_reasons of [
      ['Transporte', ' '],
      ['Lanche', 'lanche'],
    ])
      expect(
        code(() =>
          normalizeFinanceSettingsValues(
            values({ expense_reasons }),
            PLATFORM_MAX,
          ),
        ),
      ).toBe('FINANCE_SETTINGS_INVALID');
  });

  it('não deixa o limite de anexo passar do teto da plataforma', () => {
    expect(
      code(() =>
        normalizeFinanceSettingsValues(
          values({ field_agent_document_max_bytes: 5 * 1024 * 1024 }),
          4 * 1024 * 1024,
        ),
      ),
    ).toBe('FINANCE_SETTINGS_INVALID');
  });

  it('modo fixo exige valor maior que zero (como no INVESTOR)', () => {
    const d = defaultFinanceSettingsValues();
    const fixed = (amount: string) =>
      values({
        fixed_cost_item_modes: {
          ...d.fixed_cost_item_modes,
          equipment: 'fixed',
        },
        fixed_cost_item_amounts: {
          ...d.fixed_cost_item_amounts,
          equipment: amount,
        },
      });
    expect(
      code(() => normalizeFinanceSettingsValues(fixed('0'), PLATFORM_MAX)),
    ).toBe('FINANCE_SETTINGS_INVALID');
    expect(
      normalizeFinanceSettingsValues(fixed('1500.5'), PLATFORM_MAX)
        .fixed_cost_item_amounts.equipment,
    ).toBe('1500.50');
  });

  it('recusa mês de corte da DRE fora do formato AAAA-MM', () => {
    expect(
      code(() =>
        normalizeFinanceSettingsValues(
          values({ dre_regime_cutoff_month: '2026-13' }),
          PLATFORM_MAX,
        ),
      ),
    ).toBe('FINANCE_SETTINGS_INVALID');
  });
});

describe('Parâmetros financeiros: vigência (só inclusão, sem retroativo)', () => {
  const versions = [
    { id: 1, validFrom: '2026-01-01' },
    { id: 2, validFrom: '2026-06-01' },
    { id: 3, validFrom: '2026-12-01' },
  ];

  it('usa a versão de maior início que não seja posterior à data do fato', () => {
    expect(versionInForce(versions, '2025-12-31')).toBeNull();
    expect(versionInForce(versions, '2026-01-01')?.id).toBe(1);
    expect(versionInForce(versions, '2026-05-31')?.id).toBe(1);
    expect(versionInForce(versions, '2026-06-01')?.id).toBe(2);
    expect(versionInForce(versions, '2026-11-30')?.id).toBe(2);
    expect(versionInForce(versions, '2027-01-01')?.id).toBe(3);
  });

  it('a primeira versão pode começar em qualquer data', () => {
    expect(
      code(() => assertNewVersionStart('2020-01-01', null, '2026-11-13')),
    ).toBe('NO_ERROR');
  });

  it('versões seguintes começam depois da última e nunca no passado', () => {
    expect(
      code(() =>
        assertNewVersionStart('2026-11-13', '2026-11-13', '2026-11-13'),
      ),
    ).toBe('FINANCE_SETTINGS_CONFLICT');
    expect(
      code(() =>
        assertNewVersionStart('2026-11-12', '2026-01-01', '2026-11-13'),
      ),
    ).toBe('FINANCE_SETTINGS_CONFLICT');
    expect(
      code(() =>
        assertNewVersionStart('2026-11-13', '2026-01-01', '2026-11-13'),
      ),
    ).toBe('NO_ERROR');
    expect(
      code(() =>
        assertNewVersionStart('2027-01-01', '2026-01-01', '2026-11-13'),
      ),
    ).toBe('NO_ERROR');
  });

  it('recusa data inválida', () => {
    expect(
      code(() => assertNewVersionStart('2026-02-30', null, '2026-11-13')),
    ).toBe('FINANCE_SETTINGS_INVALID');
  });

  it('“hoje” segue o fuso de São Paulo, não o UTC', () => {
    expect(civilToday(new Date('2026-11-14T02:30:00.000Z'))).toBe('2026-11-13');
    expect(civilToday(new Date('2026-11-14T03:30:00.000Z'))).toBe('2026-11-14');
  });

  it('converte os ids BIGINT (string) do MySQL em números', () => {
    const row = Object.assign(new FinanceSettingsVersionEntity(), {
      id: '7',
      organizationId: '3',
      actorId: null,
    });
    row.normalizeIds();
    expect([row.id, row.organizationId, row.actorId]).toEqual([7, 3, null]);
  });
});
