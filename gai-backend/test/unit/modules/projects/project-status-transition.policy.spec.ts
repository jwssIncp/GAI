import { ProjectStatus } from '../../../../src/modules/projects/domain/enums/project-status.enum';
import {
  ProjectStatusTransitionError,
  ProjectStatusTransitionPolicy,
} from '../../../../src/modules/projects/domain/services/project-status-transition.policy';

describe('ProjectStatusTransitionPolicy', () => {
  it('models the canonical lifecycle and its permissions', () => {
    expect(
      ProjectStatusTransitionPolicy.resolve(ProjectStatus.DRAFT, 'activate'),
    ).toMatchObject({
      to: ProjectStatus.ACTIVE,
      permission: 'projects:activate',
    });
    expect(
      ProjectStatusTransitionPolicy.resolve(ProjectStatus.ACTIVE, 'pause').to,
    ).toBe(ProjectStatus.PAUSED);
    expect(
      ProjectStatusTransitionPolicy.resolve(ProjectStatus.PAUSED, 'resume').to,
    ).toBe(ProjectStatus.ACTIVE);
    expect(
      ProjectStatusTransitionPolicy.resolve(ProjectStatus.ACTIVE, 'finish').to,
    ).toBe(ProjectStatus.FINISHED);
    expect(
      ProjectStatusTransitionPolicy.resolve(ProjectStatus.CANCELLED, 'archive')
        .to,
    ).toBe(ProjectStatus.ARCHIVED);
  });

  it('rejects transitions outside the matrix', () => {
    expect(() =>
      ProjectStatusTransitionPolicy.resolve(ProjectStatus.DRAFT, 'finish'),
    ).toThrow(ProjectStatusTransitionError);
    expect(() =>
      ProjectStatusTransitionPolicy.resolve(ProjectStatus.INACTIVE, 'archive'),
    ).toThrow(ProjectStatusTransitionError);
  });

  it('returns only canonical available actions', () => {
    expect(
      ProjectStatusTransitionPolicy.availableActions(ProjectStatus.DRAFT),
    ).toEqual([
      { action: 'activate', permission: 'projects:activate' },
      { action: 'cancel', permission: 'projects:cancel' },
    ]);
    expect(
      ProjectStatusTransitionPolicy.availableActions(ProjectStatus.INACTIVE),
    ).toEqual([]);
  });

  it('centralizes statuses that accept operational mutations', () => {
    expect(
      ProjectStatusTransitionPolicy.allowsOperationalMutation(
        ProjectStatus.DRAFT,
      ),
    ).toBe(true);
    expect(
      ProjectStatusTransitionPolicy.allowsOperationalMutation(
        ProjectStatus.PAUSED,
      ),
    ).toBe(true);
    expect(
      ProjectStatusTransitionPolicy.allowsOperationalMutation(
        ProjectStatus.FINISHED,
      ),
    ).toBe(false);
    expect(
      ProjectStatusTransitionPolicy.allowsOperationalMutation(
        ProjectStatus.ARCHIVED,
      ),
    ).toBe(false);
  });
});
