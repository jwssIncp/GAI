import { ConflictException } from '@nestjs/common';
import { ProjectStatus } from '../../../projects/domain/enums/project-status.enum';
import { ProjectStatusTransitionPolicy } from '../../../projects/domain/services/project-status-transition.policy';

export class ProjectStatusBlocksFieldAgentOperationError extends Error {
  constructor(readonly currentStatus: ProjectStatus | null) {
    super('Project status blocks this operation');
    this.name = ProjectStatusBlocksFieldAgentOperationError.name;
  }
}

export function assertProjectAllowsFieldAgentMutation(
  status: ProjectStatus,
): void {
  if (!ProjectStatusTransitionPolicy.allowsOperationalMutation(status)) {
    throw projectStatusBlocksFieldAgentOperation(status);
  }
}

export function projectStatusBlocksFieldAgentOperation(
  status: ProjectStatus | null,
): ConflictException {
  return new ConflictException({
    code: 'PROJECT_STATUS_BLOCKS_OPERATION',
    message: 'Project status blocks this operation',
    details: { current_status: status },
  });
}
