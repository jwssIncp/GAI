import { readFileSync } from 'fs';
import { join } from 'path';

describe('organizations-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/002-organizations-crud/contracts/organizations-api.yaml',
    ),
    'utf8',
  );

  it('defines required organization endpoints', () => {
    expect(content).toContain('/organizations:');
    expect(content).toContain('/organizations/{id}:');
    expect(content).toContain('/organizations/{id}/deactivate:');
    expect(content).toContain('/organizations/{id}/activate:');
  });

  it('defines required schemas', () => {
    expect(content).toContain('CreateOrganizationRequest');
    expect(content).toContain('UpdateOrganizationRequest');
    expect(content).toContain('OrganizationResponse');
    expect(content).toContain('OrganizationListResponse');
    expect(content).toContain('ErrorResponse');
    expect(content).toContain('ErrorCode');
    expect(content).toContain('FieldError');
  });

  it('defines ErrorCode enum values', () => {
    const codes = [
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'INTERNAL_ERROR',
    ];
    for (const code of codes) {
      expect(content).toContain(code);
    }
  });

  it('documents HTTP status codes per endpoint', () => {
    expect(content).toContain("'201':");
    expect(content).toContain("'400':");
    expect(content).toContain("'401':");
    expect(content).toContain("'403':");
    expect(content).toContain("'404':");
    expect(content).toContain("'409':");
  });

  it('documents parallel flow tables in operation descriptions', () => {
    expect(content).toContain('Fluxos paralelos');
    expect(content).toContain('CnpjConflict');
    expect(content).toContain('AlreadyInactive');
    expect(content).toContain('AlreadyActive');
  });

  it('uses snake_case field names aligned with backend DTOs', () => {
    const fields = [
      'legal_name',
      'trade_name',
      'contact_email',
      'contact_phone',
      'page_size',
      'total_items',
      'total_pages',
      'created_at',
      'updated_at',
    ];
    for (const field of fields) {
      expect(content).toContain(field);
    }
  });

  it('defines OrganizationStatus enum', () => {
    expect(content).toContain('ACTIVE');
    expect(content).toContain('INACTIVE');
  });
});
