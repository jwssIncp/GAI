import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AmendmentDto,
  ContractDataDto,
} from '../../../../src/modules/contracts/contract.dto';
import {
  normalizeContract,
  normalizePaymentPlan,
} from '../../../../src/modules/contracts/contract.policy';

const base = {
  number: 'CT-1',
  company_id: 1,
  currency: 'BRL',
  services: [],
  status: 'draft',
} as unknown as ContractDataDto;
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
  return 'NO_ERROR';
};

describe('Contrato: forma de pagamento (doc 06 §7.2)', () => {
  it('parcelas iguais não guardam percentuais (100/n é derivado)', () => {
    expect(
      normalizePaymentPlan({
        mode: 'equal',
        installments: 3,
        percentages: ['1'],
      }),
    ).toEqual({ mode: 'equal', installments: 3, percentages: null });
  });

  it('percentuais por parcela somando 100 (ex.: 30/30/40)', () => {
    expect(
      normalizePaymentPlan({
        mode: 'percentages',
        installments: 3,
        percentages: ['30', '30', '40'],
      }),
    ).toEqual({
      mode: 'percentages',
      installments: 3,
      percentages: ['30.00', '30.00', '40.00'],
    });
  });

  it('aceita centésimos que somam exatamente 100 (33,33 + 33,33 + 33,34)', () => {
    expect(
      normalizePaymentPlan({
        mode: 'percentages',
        installments: 3,
        percentages: ['33.33', '33.33', '33.34'],
      })?.percentages,
    ).toEqual(['33.33', '33.33', '33.34']);
  });

  it('recusa soma diferente de 100, parcela zerada ou quantidade divergente', () => {
    for (const plan of [
      { mode: 'percentages', installments: 2, percentages: ['50', '49.99'] },
      { mode: 'percentages', installments: 2, percentages: ['100', '0'] },
      { mode: 'percentages', installments: 3, percentages: ['50', '50'] },
    ] as const)
      expect(
        code(() =>
          normalizePaymentPlan({ ...plan, percentages: [...plan.percentages] }),
        ),
      ).toBe('CONTRACT_INVALID');
  });

  it('contratos antigos sem os campos novos continuam válidos', () => {
    const data = normalizeContract(base);
    expect(data.payment_plan).toBeNull();
    expect(data.expenses_paid_by).toBeNull();
    expect(data.tags_paid_by).toBeNull();
    expect(data.commercial_origin_code).toBeNull();
  });

  it('valida no DTO quem paga despesas e plaquetas e o código da origem', async () => {
    const ok = plainToInstance(ContractDataDto, {
      ...base,
      expenses_paid_by: 'client',
      tags_paid_by: 'company',
      commercial_origin_code: 'inbound',
      payment_plan: { mode: 'equal', installments: 2 },
    });
    expect(await validate(ok)).toHaveLength(0);
    const bad = plainToInstance(ContractDataDto, {
      ...base,
      expenses_paid_by: 'cliente',
      commercial_origin_code: 'Inbound!',
      payment_plan: { mode: 'equal', installments: 0 },
    });
    expect((await validate(bad)).map((e) => e.property).sort()).toEqual([
      'commercial_origin_code',
      'expenses_paid_by',
      'payment_plan',
    ]);
  });

  it('aditivo aceita de 1 a 60 parcelas', async () => {
    const dto = (installments: number) =>
      plainToInstance(AmendmentDto, {
        revision: 1,
        reason: 'Aditivo de valor',
        identifier: 'A1',
        dated_on: '2026-11-01',
        type: 'value',
        value_delta: '1000.00',
        installments,
      });
    expect(await validate(dto(3))).toHaveLength(0);
    expect((await validate(dto(61))).map((e) => e.property)).toEqual([
      'installments',
    ]);
  });
});
