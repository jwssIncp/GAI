import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserRole } from '../../../auth/domain/enums/user.enums';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { ProjectStatusTransitionPolicy } from '../../../projects/domain/services/project-status-transition.policy';
import { FieldAgentEntity } from '../../infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../infrastructure/persistence/project-field-agent.entity';
import { FieldAgentStatus } from '../../domain/enums/field-agent-status.enum';
import { ProjectFieldAgentStatus } from '../../domain/enums/project-field-agent-status.enum';

export function operationalDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join('-');
}

export function assertOperationalActor(actor: {
  systemRoles: UserRole[];
  organizationId: number | null;
}): number {
  if (
    actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
    !actor.organizationId
  ) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message:
        'A gestão operacional de inventariantes é exclusiva da organização.',
    });
  }
  return actor.organizationId;
}

export function assertAssignmentPeriod(
  start: Date | string | null,
  end: Date | string | null,
  today = operationalDay(),
): void {
  const day = (date: Date | string | null) =>
    date instanceof Date ? date.toISOString().slice(0, 10) : date?.slice(0, 10);
  if ((day(start) && day(start)! > today) || (day(end) && day(end)! < today)) {
    throw new ConflictException({
      code: 'FIELD_AGENT_OUTSIDE_PERIOD',
      message: 'O vínculo do inventariante está fora do período de atuação.',
    });
  }
}

/** Lock order: project -> agent -> assignment. State changes lock the same agent.
 * The caller must keep this transaction open until its operation is persisted. */
export async function requireOperationalAgent(
  manager: EntityManager,
  organizationId: number,
  agentId: number,
): Promise<FieldAgentEntity> {
  const agent = await manager.getRepository(FieldAgentEntity).findOne({
    where: { id: agentId, organizationId },
    ...(manager.connection.options.type === 'mysql'
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {}),
  });
  if (!agent || agent.status !== FieldAgentStatus.ACTIVE) {
    throw new ConflictException({
      code: 'FIELD_AGENT_INELIGIBLE',
      message:
        'O inventariante precisa estar ativo e não excluído nesta organização.',
    });
  }
  return agent;
}

export async function requireOperationalAssignment(
  manager: EntityManager,
  organizationId: number,
  projectId: number,
  agentId: number,
  actor?: { id: number; systemRoles: UserRole[] },
): Promise<ProjectFieldAgentEntity> {
  const project = await manager.getRepository(ProjectEntity).findOne({
    where: { id: projectId, organizationId },
    ...(manager.connection.options.type === 'mysql'
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {}),
  });
  if (
    !project ||
    !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
  ) {
    throw new ConflictException({
      code: 'PROJECT_STATUS_BLOCKS_OPERATION',
      message: 'O projeto não permite novas operações.',
    });
  }
  await requireOperationalAgent(manager, organizationId, agentId);
  if (actor && !actor.systemRoles.includes(UserRole.ORG_ADMIN)) {
    const own = await manager.getRepository(FieldAgentEntity).findOne({
      where: { userId: actor.id, organizationId },
      withDeleted: true,
      order: { deletedAt: 'ASC', id: 'DESC' },
    });
    if (own && own.id !== agentId)
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Sua conta vinculada só pode registrar a própria atuação operacional.',
      });
  }
  const link = await manager.getRepository(ProjectFieldAgentEntity).findOne({
    where: {
      organizationId,
      projectId,
      fieldAgentId: agentId,
      status: ProjectFieldAgentStatus.ACTIVE,
    },
    ...(manager.connection.options.type === 'mysql'
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {}),
  });
  if (!link)
    throw new ConflictException({
      code: 'FIELD_AGENT_NOT_ASSIGNED',
      message: 'O inventariante precisa ter vínculo ativo com este projeto.',
    });
  assertAssignmentPeriod(link.startDate, link.endDate);
  return link;
}
