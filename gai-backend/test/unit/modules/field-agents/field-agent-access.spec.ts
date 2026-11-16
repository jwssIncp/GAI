import { UserStatus } from '../../../../src/modules/auth/domain/enums/user.enums';
import { Password } from '../../../../src/modules/auth/domain/value-objects/password';
import {
  fieldAgentAccess,
  generateTemporaryPassword,
} from '../../../../src/modules/field-agents/application/services/field-agent-access';

describe('generateTemporaryPassword', () => {
  it('gera o tamanho pedido, sem caracteres ambíguos, com maiúscula, minúscula e dígito', () => {
    for (let i = 0; i < 200; i++) {
      const value = generateTemporaryPassword(12);
      expect(value).toHaveLength(12);
      expect(value).not.toMatch(/[0O1lI]/);
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[a-z]/);
      expect(value).toMatch(/[2-9]/);
    }
  });

  it('não repete e respeita os limites da política de senha', () => {
    const values = new Set(
      Array.from({ length: 500 }, () => generateTemporaryPassword(12)),
    );
    expect(values.size).toBe(500);
    expect(generateTemporaryPassword(3)).toHaveLength(Password.MIN_LENGTH);
    expect(generateTemporaryPassword(Number.NaN)).toHaveLength(
      Password.MIN_LENGTH,
    );
    expect(generateTemporaryPassword(1000)).toHaveLength(Password.MAX_LENGTH);
  });
});

describe('fieldAgentAccess', () => {
  const issued = new Date('2026-11-16T12:00:00.000Z');
  const user = (status: UserStatus, mustChangePassword: boolean) => ({
    status,
    mustChangePassword,
    passwordChangedAt: issued,
  });

  it('mapeia cada situação sem expor dado sensível', () => {
    expect(fieldAgentAccess(null)).toEqual({
      status: 'NONE',
      temporary_password_issued_at: null,
    });
    expect(
      fieldAgentAccess(user(UserStatus.PENDING_ACTIVATION, false)).status,
    ).toBe('INVITATION_PENDING');
    expect(fieldAgentAccess(user(UserStatus.ACTIVE, true))).toEqual({
      status: 'AWAITING_FIRST_ACCESS',
      temporary_password_issued_at: issued.toISOString(),
    });
    expect(fieldAgentAccess(user(UserStatus.LOCKED, true)).status).toBe(
      'AWAITING_FIRST_ACCESS',
    );
    expect(fieldAgentAccess(user(UserStatus.ACTIVE, false))).toEqual({
      status: 'ACTIVE',
      temporary_password_issued_at: null,
    });
    expect(fieldAgentAccess(user(UserStatus.INACTIVE, false)).status).toBe(
      'REVOKED',
    );
    expect(fieldAgentAccess(user(UserStatus.BLOCKED, true)).status).toBe(
      'REVOKED',
    );
  });
});
