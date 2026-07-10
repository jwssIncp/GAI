import { readFileSync } from 'fs';
import { join } from 'path';

describe('users-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/003-users-roles-permissions/contracts/users-api.yaml',
    ),
    'utf8',
  );

  it('defines required user endpoints', () => {
    expect(content).toContain('/users:');
    expect(content).toContain('/users/{id}:');
    expect(content).toContain('/users/{id}/deactivate:');
    expect(content).toContain('/users/{id}/activate:');
    expect(content).toContain('/users/{userId}/role-assignments:');
    expect(content).toContain(
      '/users/{userId}/role-assignments/{assignmentId}:',
    );
  });

  it('defines required schemas', () => {
    expect(content).toContain('CreateUserRequest');
    expect(content).toContain('UpdateUserRequest');
    expect(content).toContain('UserResponse');
    expect(content).toContain('UserListResponse');
    expect(content).toContain('RoleAssignmentResponse');
    expect(content).toContain('AssignUserRoleRequest');
    expect(content).toContain('ErrorResponse');
  });

  it('uses profile-only create request without embedded role', () => {
    const createBlock = content.slice(
      content.indexOf('CreateUserRequest:'),
      content.indexOf('UpdateUserRequest:'),
    );
    expect(createBlock).toContain('required: [login, email, password]');
    expect(createBlock).not.toContain('org_role_id');
    expect(createBlock).not.toMatch(/\brole:\s/);
  });

  it('documents role_assignments in user response', () => {
    for (const field of [
      'role_assignments',
      'assignment_id',
      'role_id',
      'role_key',
      'role_type',
      'assigned_at',
    ]) {
      expect(content).toContain(field);
    }
  });

  it('uses snake_case field names aligned with backend DTOs', () => {
    for (const field of [
      'organization_id',
      'page_size',
      'created_at',
      'updated_at',
    ]) {
      expect(content).toContain(field);
    }
  });

  it('defines UserStatus and RoleType enums', () => {
    expect(content).toContain('ACTIVE');
    expect(content).toContain('INACTIVE');
    expect(content).toContain('SYSTEM');
    expect(content).toContain('ORGANIZATION');
  });

  it('documents HTTP status codes for role assignment endpoints', () => {
    expect(content).toContain("'201':");
    expect(content).toContain("'204':");
    expect(content).toContain("'403':");
    expect(content).toContain("'409':");
  });
});
