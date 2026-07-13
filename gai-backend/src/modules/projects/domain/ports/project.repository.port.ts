import { Project } from '../entities/project';
import { ProjectAuditOperation } from '../enums/project-audit-operation.enum';
import { ProjectStatus } from '../enums/project-status.enum';
import { ProjectStatusAction } from '../services/project-status-transition.policy';

export interface ListProjectsParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  companyId?: number;
  status?: ProjectStatus;
  search?: string;
}

export interface ProjectAuditEntry {
  projectId: number;
  organizationId: number;
  operation: ProjectAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export interface ProjectOpenOperation {
  type: string;
  count: number;
}

export type ProjectStatusTransitionResult =
  | { kind: 'success'; project: Project }
  | { kind: 'not_found' }
  | { kind: 'invalid_transition'; currentStatus: ProjectStatus }
  | { kind: 'concurrent_modification'; currentStatus: ProjectStatus | null }
  | {
      kind: 'open_operations';
      currentStatus: ProjectStatus;
      operations: ProjectOpenOperation[];
    };

export interface ProjectEditableFields {
  name?: string;
  description?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export type ProjectFieldsUpdateResult =
  | { kind: 'success'; project: Project }
  | { kind: 'not_found' }
  | {
      kind: 'concurrent_modification';
      currentStatus: ProjectStatus;
      currentUpdatedAt: Date;
    };

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectRepository {
  findById(id: number): Promise<Project | null>;
  list(
    params: ListProjectsParams,
  ): Promise<{ items: Project[]; total: number }>;
  saveWithAudit(project: Project, audit: ProjectAuditEntry): Promise<Project>;
  updateFieldsWithAudit(params: {
    id: number;
    expectedStatus: ProjectStatus;
    expectedUpdatedAt: Date;
    fields: ProjectEditableFields;
    actorId: number;
    now: Date;
    audit: ProjectAuditEntry;
  }): Promise<ProjectFieldsUpdateResult>;
  transitionStatusWithAudit(params: {
    id: number;
    action: ProjectStatusAction;
    actorId: number;
    now: Date;
  }): Promise<ProjectStatusTransitionResult>;
}
