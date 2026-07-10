import { Project } from '../../../../src/modules/projects/domain/entities/project';
import { ProjectStatus } from '../../../../src/modules/projects/domain/enums/project-status.enum';

function makeProject(status = ProjectStatus.DRAFT): Project {
  const now = new Date('2026-07-07T12:00:00.000Z');
  return new Project({
    id: 1,
    organizationId: 1,
    companyId: 1,
    name: 'Inventario 2026',
    description: null,
    status,
    startDate: null,
    endDate: null,
    finishedAt: null,
    settings: null,
    metadata: null,
    createdById: 1,
    updatedById: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('Project domain', () => {
  it('rejects end_date earlier than start_date', () => {
    expect(
      () =>
        new Project({
          ...makeProject().toProps(),
          startDate: new Date('2026-07-10T00:00:00.000Z'),
          endDate: new Date('2026-07-09T00:00:00.000Z'),
        }),
    ).toThrow('end_date cannot be earlier than start_date');
  });

  it('blocks operational updates for terminal or inactive statuses', () => {
    const project = makeProject(ProjectStatus.FINISHED);

    expect(() =>
      project.updateFields({ name: 'Novo nome', updatedById: 2 }),
    ).toThrow('Project status blocks this operation');
  });

  it('finishes project and records finished_at change', () => {
    const project = makeProject(ProjectStatus.ACTIVE);
    const finishedAt = new Date('2026-07-08T15:00:00.000Z');

    const changes = project.finish(2, finishedAt);

    expect(project.status).toBe(ProjectStatus.FINISHED);
    expect(project.finishedAt).toBe(finishedAt);
    expect(changes).toHaveProperty('status');
    expect(changes).toHaveProperty('finished_at');
  });
});
