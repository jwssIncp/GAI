import { BadRequestException } from '@nestjs/common';
import { Cnpj } from '../../../../src/modules/organizations/domain/value-objects/cnpj';

describe('Cnpj value object', () => {
  it('accepts valid CNPJ 11222333000181', () => {
    const cnpj = Cnpj.create('11222333000181');
    expect(cnpj.getValue()).toBe('11222333000181');
  });

  it('strips non-digit characters', () => {
    const cnpj = Cnpj.create('11.222.333/0001-81');
    expect(cnpj.getValue()).toBe('11222333000181');
  });

  it('rejects invalid check digits', () => {
    expect(() => Cnpj.create('11222333000199')).toThrow(BadRequestException);
  });

  it('rejects wrong length', () => {
    expect(() => Cnpj.create('123')).toThrow(BadRequestException);
  });

  it('rejects repeated digits', () => {
    expect(() => Cnpj.create('11111111111111')).toThrow(BadRequestException);
  });

  it('validates via isValid helper', () => {
    expect(Cnpj.isValid('11222333000181')).toBe(true);
    expect(Cnpj.isValid('00000000000000')).toBe(false);
  });
});
