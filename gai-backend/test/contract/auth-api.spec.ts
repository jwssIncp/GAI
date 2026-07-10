import { readFileSync } from 'fs';
import { join } from 'path';

describe('auth-api contract', () => {
  const content = readFileSync(
    join(process.cwd(), 'specs/001-user-auth/contracts/auth-api.yaml'),
    'utf8',
  );

  it('defines required auth endpoints', () => {
    expect(content).toContain('/auth/login:');
    expect(content).toContain('/auth/logout:');
    expect(content).toContain('/auth/me:');
    expect(content).toContain('/auth/password-reset/request:');
    expect(content).toContain('/auth/password-reset/confirm:');
  });

  it('defines required schemas', () => {
    expect(content).toContain('LoginRequest');
    expect(content).toContain('LoginResponse');
    expect(content).toContain('CurrentUserResponse');
    expect(content).toContain('PasswordResetRequest');
    expect(content).toContain('PasswordResetConfirmRequest');
    expect(content).toContain('ErrorResponse');
    expect(content).toContain('ErrorCode');
  });

  it('defines ErrorCode enum values including ACCOUNT_LOCKED', () => {
    for (const code of [
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'ACCOUNT_LOCKED',
      'INTERNAL_ERROR',
    ]) {
      expect(content).toContain(code);
    }
  });

  it('documents HTTP status codes per endpoint', () => {
    expect(content).toContain("'200':");
    expect(content).toContain("'204':");
    expect(content).toContain("'400':");
    expect(content).toContain("'401':");
    expect(content).toContain("'423':");
  });

  it('documents parallel flow tables', () => {
    expect(content).toContain('Fluxos paralelos');
    expect(content).toContain('InvalidCredentials');
    expect(content).toContain('AccountLocked');
    expect(content).toContain('InvalidResetToken');
  });

  it('uses snake_case field names aligned with backend DTOs', () => {
    for (const field of [
      'access_token',
      'expires_at',
      'organization_id',
      'new_password',
    ]) {
      expect(content).toContain(field);
    }
  });

  it('defines UserRole and UserStatus enums', () => {
    expect(content).toContain('PLATFORM_ADMIN');
    expect(content).toContain('ORG_USER');
    expect(content).toContain('ACTIVE');
    expect(content).toContain('LOCKED');
  });
});
