import { readFileSync } from 'fs';
import { join } from 'path';

describe('field-agents-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/005-field-agents/contracts/field-agents-api.yaml',
    ),
    'utf8',
  );

  it('defines required field agent endpoints', () => {
    for (const path of [
      '/field-agents:',
      '/field-agents/{id}:',
      '/field-agents/{id}/deactivate:',
      '/field-agents/{id}/reactivate:',
      '/projects/{projectId}/field-agents:',
      '/projects/{projectId}/field-agents/{assignmentId}:',
      '/projects/{projectId}/field-agents/{assignmentId}/remove:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('defines schemas, statuses and snake_case fields', () => {
    for (const item of [
      'CreateFieldAgentRequest',
      'UpdateFieldAgentRequest',
      'FieldAgentResponse',
      'FieldAgentListResponse',
      'ProjectFieldAgentResponse',
      'active',
      'inactive',
      'blocked',
      'finished',
      'organization_id',
      'user_id',
      'field_agent_id',
      'project_id',
      'page_size',
      'total_items',
      'total_pages',
    ]) {
      expect(content).toContain(item);
    }
  });

  it('documents required permissions', () => {
    for (const item of [
      'field-agents:create',
      'field-agents:read',
      'field-agents:update',
      'field-agents:deactivate',
      'field-agents:reactivate',
      'project-field-agents:assign',
      'project-field-agents:read',
      'project-field-agents:update',
      'project-field-agents:remove',
    ]) {
      expect(content).toContain(item);
    }
  });
});
