import { ConflictException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UpdateProjectUseCase } from '../../../../src/modules/projects/application/use-cases/update-project.use-case';
import { ProjectScopeService } from '../../../../src/modules/projects/application/services/project-scope.service';
import { Project } from '../../../../src/modules/projects/domain/entities/project';
import { ProjectStatus } from '../../../../src/modules/projects/domain/enums/project-status.enum';

const makeProject = (): Project =>
  new Project({
    id: 1,
    organizationId: 1,
    companyId: 1,
    name: 'Projeto original',
    description: null,
    status: ProjectStatus.ACTIVE,
    startDate: null,
    endDate: null,
    finishedAt: null,
    settings: { legacy: true },
    metadata: { source: 'seed' },
    createdById: 1,
    updatedById: 1,
    createdAt: new Date('2026-07-13T12:00:00.000Z'),
    updatedAt: new Date('2026-07-13T12:00:00.000Z'),
    deletedAt: null,
  });

describe('UpdateProjectUseCase', () => {
  const scope = new ProjectScopeService();
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
  } as unknown as PinoLogger;
  const actor = { id: 2, organizationId: 1, systemRoles: [] };

  it('returns a stable conflict when the compare-and-set detects a concurrent change', async () => {
    const project = makeProject();
    const repository = {
      findById: jest.fn().mockResolvedValue(project),
      updateFieldsWithAudit: jest.fn().mockResolvedValue({
        kind: 'concurrent_modification',
        currentStatus: ProjectStatus.FINISHED,
        currentUpdatedAt: new Date('2026-07-13T12:01:00.000Z'),
      }),
    };
    const useCase = new UpdateProjectUseCase(
      repository as never,
      scope,
      logger,
    );

    await expect(
      useCase.execute(1, { name: 'Projeto alterado' }, actor),
    ).rejects.toMatchObject<Partial<ConflictException>>({
      response: {
        code: 'PROJECT_CONCURRENT_MODIFICATION',
        message:
          'Project was modified by another operation. Reload it and try again.',
        details: {
          current_status: ProjectStatus.FINISHED,
          current_updated_at: '2026-07-13T12:01:00.000Z',
        },
      },
    });

    expect(repository.updateFieldsWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        expectedStatus: ProjectStatus.ACTIVE,
        expectedUpdatedAt: new Date('2026-07-13T12:00:00.000Z'),
        fields: { name: 'Projeto alterado' },
      }),
    );
  });

  it('persists only editable fields through the transactional partial-update port', async () => {
    const project = makeProject();
    const repository = {
      findById: jest.fn().mockResolvedValue(project),
      updateFieldsWithAudit: jest
        .fn()
        .mockResolvedValue({ kind: 'success', project }),
      saveWithAudit: jest.fn(),
    };
    const useCase = new UpdateProjectUseCase(
      repository as never,
      scope,
      logger,
    );

    const response = await useCase.execute(
      1,
      {
        name: ' Projeto alterado ',
        description: ' Descricao ',
        start_date: '2026-07-01',
      },
      actor,
    );

    expect(response.name).toBe('Projeto alterado');
    expect(repository.updateFieldsWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: {
          name: 'Projeto alterado',
          description: 'Descricao',
          startDate: new Date('2026-07-01T00:00:00.000Z'),
        },
      }),
    );
    expect(repository.saveWithAudit).not.toHaveBeenCalled();
    expect(project.settings).toEqual({ legacy: true });
    expect(project.metadata).toEqual({ source: 'seed' });
  });
});
