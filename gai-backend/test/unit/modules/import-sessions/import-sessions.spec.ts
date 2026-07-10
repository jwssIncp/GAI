import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import { Project } from '../../../../src/modules/projects/domain/entities/project';
import { ProjectStatus } from '../../../../src/modules/projects/domain/enums/project-status.enum';
import { ImportSessionScopeService } from '../../../../src/modules/import-sessions/application/services/import-session-scope.service';

describe('ImportSessionScopeService', () => {
  const service = new ImportSessionScopeService();

  it('enforces organization scope unless actor is platform admin', () => {
    expect(() =>
      service.assertCanAccessOrganization(
        { id: 1, organizationId: 10, systemRoles: [] },
        11,
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      service.assertCanAccessOrganization(
        {
          id: 1,
          organizationId: null,
          systemRoles: [UserRole.PLATFORM_ADMIN],
        },
        11,
      ),
    ).not.toThrow();
  });

  it('blocks mutations on non-operational projects', () => {
    const project = new Project({
      id: 1,
      organizationId: 10,
      companyId: 1,
      name: 'Projeto',
      description: null,
      status: ProjectStatus.FINISHED,
      startDate: null,
      endDate: null,
      finishedAt: new Date(),
      settings: null,
      metadata: null,
      createdById: 1,
      updatedById: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    expect(() => service.assertProjectAllowsMutation(project)).toThrow(
      ConflictException,
    );
  });

  it('normalizes plates and builds stable storage paths', () => {
    expect(service.normalizePlate(' ab-123.cd ')).toBe('AB123CD');
    expect(
      service.buildImportFilePath({
        organizationId: 7,
        sessionId: 9,
        storageKey: 'abc',
        originalName: 'backup bruto.json',
      }),
    ).toBe('organizations/7/imports/9/abc-backup_bruto.json');
  });
});
