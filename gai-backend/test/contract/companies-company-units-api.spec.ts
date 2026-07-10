import { readFileSync } from 'fs';
import { join } from 'path';

describe('companies-company-units-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/014-companies-company-units/contracts/companies-company-units-api.yaml',
    ),
    'utf8',
  );

  it('defines companies, company units and project unit endpoints', () => {
    for (const path of [
      '/companies:',
      '/companies/{id}:',
      '/companies/{id}/deactivate:',
      '/companies/{id}/reactivate:',
      '/companies/{companyId}/units:',
      '/companies/{companyId}/units/{unitId}:',
      '/projects/{projectId}/units:',
      '/projects/{projectId}/units/{unitId}/remove:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('defines schemas, statuses and snake_case fields', () => {
    for (const item of [
      'CreateCompanyRequest',
      'CompanyUnitResponse',
      'ProjectUnitResponse',
      'active',
      'inactive',
      'blocked',
      'organization_id',
      'company_id',
      'company_unit_id',
      'page_size',
      'total_items',
      'total_pages',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('documents required permissions', () => {
    for (const item of [
      'companies:create',
      'company-units:create',
      'project-units:assign',
      'project-units:remove',
    ]) {
      expect(content).toContain(item);
    }
  });
});
