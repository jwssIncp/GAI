import { DataSource, EntityManager } from 'typeorm';
import { FieldAgentEntity } from '../../infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../infrastructure/persistence/project-field-agent.entity';
import { FieldAgentStatus } from '../../domain/enums/field-agent-status.enum';
import { operationalDay } from './operational-eligibility';

export interface FieldAccessAssignment {
  assignmentId: number;
  projectId: number;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface FieldAccess {
  /** Agent bound to the account (live one preferred, deleted ones included). */
  agent: FieldAgentEntity | null;
  /** Agent exists, is not deleted and is ACTIVE. */
  eligible: boolean;
  /** Active, in-period assignments of an eligible agent to live projects. */
  assignments: FieldAccessAssignment[];
}

/**
 * Single source of truth for "which projects may this field account work on".
 * Used by SessionAuthGuard (confinement) and the mobile identity endpoint.
 */
export async function resolveFieldAccess(
  db: DataSource | EntityManager,
  userId: number,
  organizationId: number | null,
): Promise<FieldAccess> {
  if (!organizationId) return { agent: null, eligible: false, assignments: [] };
  const agent = await db.getRepository(FieldAgentEntity).findOne({
    where: { userId, organizationId },
    withDeleted: true,
    order: { deletedAt: 'ASC', id: 'DESC' },
  });
  const eligible =
    !!agent && !agent.deletedAt && agent.status === FieldAgentStatus.ACTIVE;
  if (!eligible) return { agent, eligible, assignments: [] };
  const rows = await db
    .getRepository(ProjectFieldAgentEntity)
    .createQueryBuilder('link')
    .innerJoin(
      'projects',
      'project',
      'project.id=link.project_id AND project.organization_id=link.organization_id AND project.deleted_at IS NULL',
    )
    .where(
      'link.fieldAgentId=:agentId AND link.organizationId=:org AND link.status=:active',
      { agentId: agent.id, org: organizationId, active: 'active' },
    )
    .andWhere(
      '(link.start_date IS NULL OR link.start_date<=:today) AND (link.end_date IS NULL OR link.end_date>=:today)',
      { today: operationalDay() },
    )
    .select([
      'link.id AS id',
      'link.project_id AS projectId',
      'link.role AS role',
      'link.start_date AS startDate',
      'link.end_date AS endDate',
    ])
    .getRawMany<{
      id: number;
      projectId: number;
      role: string | null;
      startDate: string | Date | null;
      endDate: string | Date | null;
    }>();
  const day = (value: string | Date | null) =>
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : (value?.slice(0, 10) ?? null);
  return {
    agent,
    eligible,
    assignments: rows.map((row) => ({
      assignmentId: Number(row.id),
      projectId: Number(row.projectId),
      role: row.role ?? null,
      startDate: day(row.startDate),
      endDate: day(row.endDate),
    })),
  };
}
