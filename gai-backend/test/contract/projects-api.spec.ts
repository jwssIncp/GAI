import { readFileSync } from 'fs';
import { join } from 'path';

describe('projects-api contract', () => {
  const content = readFileSync(
    join(process.cwd(), 'specs/004-projects/contracts/projects-api.yaml'),
    'utf8',
  );

  it('defines required project endpoints', () => {
    const paths = [
      '/projects:',
      '/projects/{id}:',
      '/projects/{id}/activate:',
      '/projects/{id}/pause:',
      '/projects/{id}/resume:',
      '/projects/{id}/deactivate:',
      '/projects/{id}/reactivate:',
      '/projects/{id}/finish:',
      '/projects/{id}/cancel:',
      '/projects/{id}/archive:',
    ];
    for (const path of paths) {
      expect(content).toContain(path);
    }
  });

  it('defines schemas and status enum', () => {
    for (const item of [
      'CreateProjectRequest',
      'UpdateProjectRequest',
      'ProjectResponse',
      'ProjectListResponse',
      'ProjectAvailableAction',
      'ProjectLifecycleAction',
      'ProjectStatus',
      'draft',
      'active',
      'paused',
      'inactive',
      'finished',
      'cancelled',
      'archived',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('uses snake_case fields aligned with DTOs', () => {
    for (const field of [
      'organization_id',
      'company_id',
      'start_date',
      'end_date',
      'finished_at',
      'created_by_id',
      'updated_by_id',
      'created_at',
      'updated_at',
      'deleted_at',
      'page_size',
      'total_items',
      'total_pages',
    ]) {
      expect(content).toContain(field);
    }
  });

  it('documents permissions and error flow names', () => {
    for (const item of [
      'projects:create',
      'projects:read',
      'projects:activate',
      'projects:pause',
      'projects:resume',
      'PROJECT_STATUS_TRANSITION_NOT_ALLOWED',
      'PROJECT_HAS_OPEN_OPERATIONS',
      'PROJECT_CONCURRENT_MODIFICATION',
      'InactiveOrganization',
      'InvalidDateRange',
      'ProjectMutationBlocked',
      'Fluxos paralelos',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('keeps status out of PATCH and exposes available actions', () => {
    const updateSchema = content
      .split('UpdateProjectRequest:')[1]
      .split('ProjectResponse:')[0];
    expect(updateSchema).not.toContain('status:');
    expect(updateSchema).not.toContain('settings:');
    expect(updateSchema).not.toContain('metadata:');
    expect(content).toContain('available_actions:');
    expect(content).toContain('maxLength: 5000');
    expect(content).toContain(
      'todas as pendencias tecnicas e operacionais bloqueiam',
    );
  });
});
