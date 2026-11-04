import { BadRequestException } from '@nestjs/common';
import { Password } from '../../../../src/modules/auth/domain/value-objects/password';
describe('Central password policy', () => {
  it('accepts long lowercase passphrases without composition restrictions', () =>
    expect(Password.create('uma frase pessoal muito longa').getValue()).toBe(
      'uma frase pessoal muito longa',
    ));
  it.each(['short', ' '.repeat(16), 'x'.repeat(129), null, undefined])(
    'rejects invalid password %j',
    (value) =>
      expect(() => Password.create(value as string)).toThrow(
        BadRequestException,
      ),
  );
  it('counts unicode code points', () =>
    expect(Password.create('😀'.repeat(15)).getValue()).toHaveLength(30));
});
