import { FieldAgent } from '../../../../src/modules/field-agents/domain/entities/field-agent';
import { ProjectFieldAgent } from '../../../../src/modules/field-agents/domain/entities/project-field-agent';
import { FieldAgentStatus } from '../../../../src/modules/field-agents/domain/enums/field-agent-status.enum';
import { ProjectFieldAgentStatus } from '../../../../src/modules/field-agents/domain/enums/project-field-agent-status.enum';

function makeFieldAgent(status = FieldAgentStatus.ACTIVE): FieldAgent {
  const now = new Date('2026-07-07T12:00:00.000Z');
  return new FieldAgent({
    id: 1,
    organizationId: 1,
    userId: null,
    name: 'Maria Inventariante',
    email: null,
    phone: null,
    document: null,
    status,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

function makeAssignment(
  status = ProjectFieldAgentStatus.ACTIVE,
): ProjectFieldAgent {
  const now = new Date('2026-07-07T12:00:00.000Z');
  return new ProjectFieldAgent({
    id: 1,
    organizationId: 1,
    projectId: 1,
    fieldAgentId: 1,
    role: 'leader',
    status,
    startDate: null,
    endDate: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });
}

describe('FieldAgent domain', () => {
  it('rejects short names', () => {
    expect(
      () => new FieldAgent({ ...makeFieldAgent().toProps(), name: 'A' }),
    ).toThrow('name must have at least 2 characters');
  });

  it('deactivates without deleting project history', () => {
    const fieldAgent = makeFieldAgent();

    const changes = fieldAgent.deactivate();

    expect(fieldAgent.status).toBe(FieldAgentStatus.INACTIVE);
    expect(changes).toHaveProperty('status');
  });

  it('reactivates only inactive field agents', () => {
    const fieldAgent = makeFieldAgent(FieldAgentStatus.INACTIVE);

    fieldAgent.reactivate();

    expect(fieldAgent.status).toBe(FieldAgentStatus.ACTIVE);
  });
});

describe('ProjectFieldAgent domain', () => {
  it('rejects end_date earlier than start_date', () => {
    expect(
      () =>
        new ProjectFieldAgent({
          ...makeAssignment().toProps(),
          startDate: new Date('2026-07-10T00:00:00.000Z'),
          endDate: new Date('2026-07-09T00:00:00.000Z'),
        }),
    ).toThrow('end_date cannot be earlier than start_date');
  });

  it('removes assignment by finishing it', () => {
    const assignment = makeAssignment();

    const changes = assignment.remove();

    expect(assignment.status).toBe(ProjectFieldAgentStatus.FINISHED);
    expect(changes.status.after).toBe(ProjectFieldAgentStatus.FINISHED);
  });
});
