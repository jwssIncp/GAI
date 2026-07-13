import { FieldAgent } from '../entities/field-agent';
import { ProjectFieldAgent } from '../entities/project-field-agent';
import { FieldAgentAuditOperation } from '../enums/field-agent-audit-operation.enum';
import { FieldAgentStatus } from '../enums/field-agent-status.enum';
import { ProjectFieldAgentStatus } from '../enums/project-field-agent-status.enum';

export interface ListFieldAgentsParams {
  page: number;
  pageSize: number;
  organizationId?: number;
  status?: FieldAgentStatus;
  search?: string;
}

export interface ListProjectFieldAgentsParams {
  page: number;
  pageSize: number;
  projectId: number;
  status?: ProjectFieldAgentStatus;
}

export interface FieldAgentAuditEntry {
  organizationId: number;
  fieldAgentId: number | null;
  projectFieldAgentId?: number | null;
  projectId?: number | null;
  operation: FieldAgentAuditOperation;
  performedBy: number | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

export const FIELD_AGENT_REPOSITORY = Symbol('FIELD_AGENT_REPOSITORY');

export interface FieldAgentRepository {
  findById(id: number): Promise<FieldAgent | null>;
  findAssignmentById(id: number): Promise<ProjectFieldAgent | null>;
  findUserOrganizationId(userId: number): Promise<number | null | undefined>;
  hasActiveAssignment(
    organizationId: number,
    projectId: number,
    fieldAgentId: number,
    excludeAssignmentId?: number,
  ): Promise<boolean>;
  findConflict(
    organizationId: number,
    values: { email?: string | null; document?: string | null },
    excludeFieldAgentId?: number,
  ): Promise<'email' | 'document' | null>;
  list(
    params: ListFieldAgentsParams,
  ): Promise<{ items: FieldAgent[]; total: number }>;
  listAssignments(
    params: ListProjectFieldAgentsParams,
  ): Promise<{ items: ProjectFieldAgent[]; total: number }>;
  saveFieldAgentWithAudit(
    fieldAgent: FieldAgent,
    audit: FieldAgentAuditEntry,
  ): Promise<FieldAgent>;
  saveAssignmentWithAudit(
    assignment: ProjectFieldAgent,
    audit: FieldAgentAuditEntry,
  ): Promise<ProjectFieldAgent>;
  saveAssignmentEnsuringUniqueActive(
    assignment: ProjectFieldAgent,
    audit: FieldAgentAuditEntry,
  ): Promise<ProjectFieldAgent>;
}
