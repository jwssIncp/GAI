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
      'InactiveOrganization',
      'InvalidDateRange',
      'ProjectMutationBlocked',
      'Fluxos paralelos',
    ]) {
      expect(content).toContain(item);
    }
  });
});
