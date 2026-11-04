import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import { CreateProjectDto } from '../../../../src/modules/projects/application/dto/create-project.dto';
import { UpdateProjectDto } from '../../../../src/modules/projects/application/dto/update-project.dto';
import { isProjectJson } from '../../../../src/modules/projects/application/dto/project-json.validator';
import { ProjectScopeService } from '../../../../src/modules/projects/application/services/project-scope.service';

describe('Project registration security and validation', () => {
  const scope = new ProjectScopeService();
  const actor = {
    id: 15,
    organizationId: 7,
    systemRoles: [UserRole.ORG_ADMIN],
  };
  it('derives ORG_ADMIN organization without a client organization field', () => {
    expect(scope.resolveOrganizationForCreate(actor)).toBe(7);
    expect(scope.resolveOrganizationForCreate(actor, 7)).toBe(7);
    expect(() => scope.resolveOrganizationForCreate(actor, 8)).toThrow();
  });
  it('requires a valid organization for users and an explicit platform selection', () => {
    expect(() =>
      scope.resolveOrganizationForCreate({ ...actor, organizationId: null }),
    ).toThrow();
    const platform = {
      ...actor,
      systemRoles: [UserRole.PLATFORM_ADMIN],
      organizationId: null,
    };
    expect(() => scope.resolveOrganizationForCreate(platform)).toThrow();
    expect(scope.resolveOrganizationForCreate(platform, 8)).toBe(8);
    expect(scope.resolveOrganizationFilter(platform)).toBeUndefined();
    expect(() => scope.resolveOrganizationFilter(actor, 8)).toThrow();
  });
  it('normalizes code/text and permits omitted organization in a create DTO', () => {
    const dto = plainToInstance(CreateProjectDto, {
      company_id: 1,
      name: '  Inventário  ',
      code: ' inv-2026 ',
      planning_notes: '  Plano  ',
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({
      name: 'Inventário',
      code: 'INV-2026',
      planning_notes: 'Plano',
    });
  });
  it.each([
    { name: '' },
    { name: 'A' },
    { name: 'A'.repeat(256) },
    { description: 'X'.repeat(5001) },
    { company_id: 0 },
    { company_id: 'x' },
    { code: 'a b' },
    { code: 'A' },
    { code: 'A'.repeat(41) },
    { project_type: 'unknown' },
    { responsible_user_id: 0 },
    { planning_responsible_user_id: 1.5 },
    { planning_notes: 'X'.repeat(5001) },
    { start_date: '2026-02-30' },
    { settings: [] },
    { metadata: { organization_id: 2 } },
  ])('rejects invalid registration fields %#', (fields) => {
    expect(
      validateSync(
        plainToInstance(CreateProjectDto, {
          company_id: 1,
          name: 'Projeto válido',
          ...fields,
        }),
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects protected/unknown PATCH fields without loosening the whitelist', () => {
    for (const field of [
      'organization_id',
      'company_id',
      'status',
      'settings',
      'metadata',
      'participants',
    ]) {
      const errors = validateSync(
        plainToInstance(UpdateProjectDto, { [field]: 'value' }),
        { whitelist: true, forbidNonWhitelisted: true },
      );
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  });
  it('bounds integration JSON and rejects protected nested keys', () => {
    expect(
      isProjectJson({
        allow_images: true,
        source: 'integration',
        nested: [1, null, 'text'],
      }),
    ).toBe(true);
    expect(isProjectJson({ nested: { status: 'active' } })).toBe(false);
    expect(isProjectJson({ nested: { Authorization: 'secret' } })).toBe(false);
    expect(isProjectJson({ api_key: 'secret' })).toBe(false);
    expect(isProjectJson(JSON.parse('{"__proto__":{"polluted":true}}'))).toBe(
      false,
    );
    expect(isProjectJson({ content: 'X'.repeat(16385) })).toBe(false);
    expect(isProjectJson({ value: Number.POSITIVE_INFINITY })).toBe(false);
    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 10; i++) deep = { child: deep };
    expect(isProjectJson(deep)).toBe(false);
  });
});
