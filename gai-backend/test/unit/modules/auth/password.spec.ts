import { BadRequestException } from '@nestjs/common';
import { Password } from '../../../../src/modules/auth/domain/value-objects/password';
describe('Central password policy', () => {
  it.each([8, 15, 128])('accepts %i characters', (length) =>
    expect(Password.create('x'.repeat(length)).getValue()).toHaveLength(length),
  );
  it('accepts long lowercase passphrases without composition restrictions', () =>
    expect(Password.create('uma frase pessoal muito longa').getValue()).toBe(
      'uma frase pessoal muito longa',
    ));
  it.each([
    'short',
    'x'.repeat(7),
    ' '.repeat(8),
    'x'.repeat(129),
    null,
    undefined,
  ])('rejects invalid password %j', (value) =>
    expect(() => Password.create(value as string)).toThrow(BadRequestException),
  );
  it('counts unicode code points', () =>
    expect(Password.create('😀'.repeat(8)).getValue()).toHaveLength(16));
  it('rejects seven unicode code points despite their larger UTF-16 size', () =>
    expect(() => Password.create('😀'.repeat(7))).toThrow(BadRequestException));
});
