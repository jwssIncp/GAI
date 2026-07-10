import { BadRequestException } from '@nestjs/common';
import { Password } from '../../../../src/modules/auth/domain/value-objects/password';

describe('Password value object', () => {
  it('accepts strong password', () => {
    const password = Password.create('Admin@123456');
    expect(password.getValue()).toBe('Admin@123456');
  });

  it('rejects short password', () => {
    expect(() => Password.create('Ab1!')).toThrow(BadRequestException);
  });

  it('rejects password without special character', () => {
    expect(() => Password.create('Admin123456')).toThrow(BadRequestException);
  });

  it('rejects password without uppercase', () => {
    expect(() => Password.create('admin@123456')).toThrow(BadRequestException);
  });
});
