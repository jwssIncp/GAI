import { describe, expect, it } from 'vitest';
import { isValidDocument, isValidPhone, normalizeDocument, normalizePhone } from './brazilianContact';

describe('brazilianContact', () => {
  it.each(['529.982.247-25', '11.222.333/0001-81'])('aceita documento valido %s', (value) => {
    expect(isValidDocument(value)).toBe(true);
  });

  it.each(['111.111.111-11', '529.982.247-24', '11.222.333/0001-80', '123'])('rejeita documento invalido %s', (value) => {
    expect(isValidDocument(value)).toBe(false);
  });

  it('normaliza documento e telefone brasileiros', () => {
    expect(normalizeDocument('529.982.247-25')).toBe('52998224725');
    expect(normalizePhone('+55 (11) 99999-8888')).toBe('11999998888');
  });

  it.each(['(11) 3333-4444', '+55 11 99999-8888'])('aceita telefone valido %s', (value) => {
    expect(isValidPhone(value)).toBe(true);
  });

  it.each(['11 9999', '11 99999-8888 ramal 2', '0011999998888'])('rejeita telefone invalido %s', (value) => {
    expect(isValidPhone(value)).toBe(false);
  });
});
