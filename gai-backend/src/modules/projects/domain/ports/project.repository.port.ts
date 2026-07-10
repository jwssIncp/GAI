import { Project } from '../entities/project';
import { ProjectAuditOperation } from '../enums/project-audit-operation.enum';
import { ProjectStatus } from '../enums/project-status.enum';

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

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectRepository {
  findById(id: number): Promise<Project | null>;
  list(
    params: ListProjectsParams,
  ): Promise<{ items: Project[]; total: number }>;
  saveWithAudit(project: Project, audit: ProjectAuditEntry): Promise<Project>;
}
