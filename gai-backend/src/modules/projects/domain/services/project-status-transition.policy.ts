import { ProjectAuditOperation } from '../enums/project-audit-operation.enum';
import { ProjectStatus } from '../enums/project-status.enum';

export type ProjectLifecycleAction =
  | 'activate'
  | 'pause'
  | 'resume'
  | 'finish'
  | 'cancel'
  | 'archive';

export type ProjectStatusAction =
  | ProjectLifecycleAction
  | 'deactivate'
  | 'reactivate';

export type ProjectReadinessProfile = 'none' | 'finish' | 'cancel' | 'archive';

export interface ProjectStatusTransitionRule {
  action: ProjectStatusAction;
  from: readonly ProjectStatus[];
  to: ProjectStatus;
  permission: string;
  auditOperation: ProjectAuditOperation;
  readiness: ProjectReadinessProfile;
  legacy?: boolean;
}

export class ProjectStatusTransitionError extends Error {
  constructor(
    readonly currentStatus: ProjectStatus,
    readonly action: ProjectStatusAction,
  ) {
    super('Project status transition is not allowed');
    this.name = ProjectStatusTransitionError.name;
  }
}

const RULES: Record<ProjectStatusAction, ProjectStatusTransitionRule> = {
  activate: {
    action: 'activate',
    from: [ProjectStatus.DRAFT],
    to: ProjectStatus.ACTIVE,
    permission: 'projects:activate',
    auditOperation: ProjectAuditOperation.ACTIVATE,
    readiness: 'none',
  },
  pause: {
    action: 'pause',
    from: [ProjectStatus.ACTIVE],
    to: ProjectStatus.PAUSED,
    permission: 'projects:pause',
    auditOperation: ProjectAuditOperation.PAUSE,
    readiness: 'none',
  },
  resume: {
    action: 'resume',
    from: [ProjectStatus.PAUSED],
    to: ProjectStatus.ACTIVE,
    permission: 'projects:resume',
    auditOperation: ProjectAuditOperation.RESUME,
    readiness: 'none',
  },
  finish: {
    action: 'finish',
    from: [ProjectStatus.ACTIVE],
    to: ProjectStatus.FINISHED,
    permission: 'projects:finish',
    auditOperation: ProjectAuditOperation.FINISH,
    readiness: 'finish',
  },
  cancel: {
    action: 'cancel',
    from: [ProjectStatus.DRAFT, ProjectStatus.ACTIVE, ProjectStatus.PAUSED],
    to: ProjectStatus.CANCELLED,
    permission: 'projects:cancel',
    auditOperation: ProjectAuditOperation.CANCEL,
    readiness: 'cancel',
  },
  archive: {
    action: 'archive',
    from: [ProjectStatus.FINISHED, ProjectStatus.CANCELLED],
    to: ProjectStatus.ARCHIVED,
    permission: 'projects:archive',
    auditOperation: ProjectAuditOperation.ARCHIVE,
    readiness: 'archive',
  },
  deactivate: {
    action: 'deactivate',
    from: [ProjectStatus.DRAFT, ProjectStatus.ACTIVE, ProjectStatus.PAUSED],
    to: ProjectStatus.INACTIVE,
    permission: 'projects:deactivate',
    auditOperation: ProjectAuditOperation.DEACTIVATE,
    readiness: 'cancel',
    legacy: true,
  },
  reactivate: {
    action: 'reactivate',
    from: [ProjectStatus.INACTIVE],
    to: ProjectStatus.ACTIVE,
    permission: 'projects:reactivate',
    auditOperation: ProjectAuditOperation.REACTIVATE,
    readiness: 'none',
    legacy: true,
  },
};

export class ProjectStatusTransitionPolicy {
  private static readonly OPERATIONALLY_MUTABLE_STATUSES = [
    ProjectStatus.DRAFT,
    ProjectStatus.ACTIVE,
    ProjectStatus.PAUSED,
  ] as const;

  static getRule(action: ProjectStatusAction): ProjectStatusTransitionRule {
    return RULES[action];
  }

  static resolve(
    currentStatus: ProjectStatus,
    action: ProjectStatusAction,
  ): ProjectStatusTransitionRule {
    const rule = this.getRule(action);
    if (!rule.from.includes(currentStatus)) {
      throw new ProjectStatusTransitionError(currentStatus, action);
    }
    return rule;
  }

  static allRules(): readonly ProjectStatusTransitionRule[] {
    return Object.values(RULES);
  }

  static availableActions(status: ProjectStatus): Array<{
    action: ProjectLifecycleAction;
    permission: string;
  }> {
    return this.allRules()
      .filter((rule) => !rule.legacy && rule.from.includes(status))
      .map((rule) => ({
        action: rule.action as ProjectLifecycleAction,
        permission: rule.permission,
      }));
  }

  static allowsOperationalMutation(status: ProjectStatus): boolean {
    return this.OPERATIONALLY_MUTABLE_STATUSES.some(
      (mutableStatus) => mutableStatus === status,
    );
  }
}
