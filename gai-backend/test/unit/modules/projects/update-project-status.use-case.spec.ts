import { ConflictException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UpdateProjectStatusUseCase } from '../../../../src/modules/projects/application/use-cases/update-project-status.use-case';
import { ProjectScopeService } from '../../../../src/modules/projects/application/services/project-scope.service';
import { Project } from '../../../../src/modules/projects/domain/entities/project';
import { ProjectStatus } from '../../../../src/modules/projects/domain/enums/project-status.enum';

const project = new Project({
  id: 1,
  organizationId: 1,
  companyId: 1,
  name: 'Projeto',
  description: null,
  status: ProjectStatus.DRAFT,
  startDate: null,
  endDate: null,
  finishedAt: null,
  settings: null,
  metadata: null,
  createdById: 1,
  updatedById: 1,
  createdAt: new Date('2026-07-13T12:00:00.000Z'),
  updatedAt: new Date('2026-07-13T12:00:00.000Z'),
  deletedAt: null,
});

describe('UpdateProjectStatusUseCase', () => {
  const scope = new ProjectScopeService();
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
  } as unknown as PinoLogger;
  const actor = { id: 1, organizationId: 1, systemRoles: [] };

  const captureConflict = async (
    operation: Promise<unknown>,
  ): Promise<string | object> => {
    try {
      await operation;
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        return error.getResponse();
      }
      throw error;
    }
    throw new Error('Expected operation to throw ConflictException');
  };

  it('returns the stable transition error for a concurrent status change', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(project),
      transitionStatusWithAudit: jest.fn().mockResolvedValue({
        kind: 'concurrent_modification',
        currentStatus: ProjectStatus.ACTIVE,
      }),
    };
    const useCase = new UpdateProjectStatusUseCase(
      repository as never,
      scope,
      logger,
    );

    const response = await captureConflict(
      useCase.execute(1, 'activate', actor),
    );
    expect(response).toMatchObject({
      code: 'PROJECT_STATUS_TRANSITION_NOT_ALLOWED',
      details: {
        current_status: ProjectStatus.ACTIVE,
        requested_action: 'activate',
      },
    });
  });

  it('returns operation names and counts when readiness fails', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(project),
      transitionStatusWithAudit: jest.fn().mockResolvedValue({
        kind: 'open_operations',
        currentStatus: ProjectStatus.ACTIVE,
        operations: [{ type: 'export_job', count: 2 }],
      }),
    };
    const useCase = new UpdateProjectStatusUseCase(
      repository as never,
      scope,
      logger,
    );

    const response = await captureConflict(useCase.execute(1, 'finish', actor));
    expect(response).toMatchObject({
      code: 'PROJECT_HAS_OPEN_OPERATIONS',
      details: {
        current_status: ProjectStatus.ACTIVE,
        requested_action: 'finish',
        operations: [{ type: 'export_job', count: 2 }],
      },
    });
  });
});
