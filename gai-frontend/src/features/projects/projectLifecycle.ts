import type { ProjectAvailableAction, ProjectLifecycleAction, ProjectStatus } from '@/types/api';

export const projectActionsByStatus: Record<ProjectStatus, ProjectLifecycleAction[]> = {
  draft: ['activate', 'cancel'],
  active: ['pause', 'finish', 'cancel'],
  paused: ['resume', 'cancel'],
  inactive: [],
  finished: ['archive'],
  cancelled: ['archive'],
  archived: [],
};

export function availableProjectActions(status: ProjectStatus, backendActions?: ProjectAvailableAction[]) {
  return backendActions ?? projectActionsByStatus[status].map((action) => ({ action, permission: `projects:${action}` }));
}

export function canMutateProjectOperations(status: ProjectStatus) {
  return status === 'draft' || status === 'active' || status === 'paused';
}
