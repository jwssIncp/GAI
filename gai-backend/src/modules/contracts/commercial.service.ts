import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../auth/domain/ports/permission-resolver.port';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import type { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { OrganizationOverviewService } from '../project-dashboard/application/services/organization-overview.service';
import { OrganizationOverviewQueryDto } from '../project-dashboard/application/dto/organization-overview-query.dto';
import {
  CommercialReportEntity,
  ContractEntity,
  ContractVersionEntity,
} from './contract.entity';
import { applyCommercialFilters } from './commercial-filters';
import { cents, conflict, invalid, money } from './contract.policy';

export function commercialTotals(rows: ContractEntity[]) {
  const currencies = [...new Set(rows.map((r) => r.data.currency))].sort();
  return currencies.map((currency) => {
    const group = rows.filter((r) => r.data.currency === currency);
    const sum = (key: 'original_value' | 'current_value', values = group) => {
      const known = values.filter((r) => r.data[key] != null);
      return {
        value: known.length
          ? money(known.reduce((s, r) => s + cents(r.data[key]!), 0n))
          : null,
        known: known.length,
        missing: values.length - known.length,
      };
    };
    const original = sum('original_value'),
      current = sum('current_value');
    const dated = group.filter(
      (r) =>
        r.data.starts_on &&
        r.data.current_ends_on &&
        r.data.status === 'active',
    );
    const today = new Date().toISOString().slice(0, 10);
    const active = dated.filter(
      (r) => r.data.starts_on! <= today && r.data.current_ends_on! >= today,
    );
    const knownCurrentTotal = group.reduce(
      (s, r) =>
        s + (r.data.current_value == null ? 0n : cents(r.data.current_value)),
      0n,
    );
    const knownRecurrence = group.some((r) => r.data.recurring != null);
    return {
      currency,
      count: group.length,
      original,
      current,
      average: current.known
        ? money(
            (knownCurrentTotal + BigInt(Math.floor(current.known / 2))) /
              BigInt(current.known),
          )
        : null,
      active: sum('current_value', active),
      active_count: active.length,
      recurring: sum(
        'current_value',
        group.filter((r) => r.data.recurring === true),
      ),
      recurring_count: knownRecurrence
        ? group.filter((r) => r.data.recurring === true).length
        : null,
      non_recurring_count: group.filter((r) => r.data.recurring === false)
        .length,
      unknown_recurring_count: group.filter((r) => r.data.recurring == null)
        .length,
    };
  });
}
export type CommercialPayload = Awaited<
  ReturnType<CommercialService['overview']>
>;
@Injectable()
export class CommercialService {
  constructor(
    private readonly ds: DataSource,
    private readonly operational: OrganizationOverviewService,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions: PermissionResolver,
  ) {}
  async overview(
    filters: OrganizationOverviewQueryDto,
    actor: ProjectActorContext,
  ) {
    // All reads in this response share one repeatable-read snapshot, including
    // the project subquery, contract rows and immutable version history.
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const projects = this.operational.query(filters, actor).select('p.id');
      const q = m
        .getRepository(ContractEntity)
        .createQueryBuilder('c')
        .where('c.organization_id = :organization', {
          organization: actor.organizationId,
        })
        .andWhere(
          `c.project_id IN (${projects.getQuery()})`,
          projects.getParameters(),
        );
      applyCommercialFilters(q, 'c', filters);
      const rows = await q.orderBy('c.id', 'ASC').take(10001).getMany();
      if (rows.length > 10000)
        invalid('Refine os filtros: limite de 10.000 contratos por relatório.');
      const totals = commercialTotals(rows);
      const groupBy = (key: 'segment' | 'company_name' | 'company_state') =>
        [
          ...new Set(
            rows.map((r) =>
              key === 'company_name'
                ? String(r.companyId)
                : (r.data[key] ?? 'Não informado'),
            ),
          ),
        ]
          .sort()
          .map((value) => {
            const group = rows.filter(
              (r) =>
                (key === 'company_name'
                  ? String(r.companyId)
                  : (r.data[key] ?? 'Não informado')) === value,
            );
            return {
              label:
                key === 'company_name' ? group[0].data.company_name : value,
              count: group.length,
              totals: commercialTotals(group),
            };
          });
      const years = [
        ...new Set(
          rows.flatMap((r) =>
            r.data.contracted_on ? [r.data.contracted_on.slice(0, 4)] : [],
          ),
        ),
      ]
        .sort()
        .map((year) => {
          const group = rows.filter((r) =>
            r.data.contracted_on?.startsWith(year),
          );
          return { year, count: group.length, totals: commercialTotals(group) };
        });
      const versions = rows.length
        ? await m
            .getRepository(ContractVersionEntity)
            .createQueryBuilder('v')
            .where('v.organization_id = :org', { org: actor.organizationId })
            .andWhere('v.contract_id IN (:...ids)', {
              ids: rows.map((r) => r.id),
            })
            .orderBy('v.recorded_at', 'ASC')
            .addOrderBy('v.id', 'ASC')
            .take(100001)
            .getMany()
        : [];
      if (versions.length > 100000)
        invalid('Refine os filtros: histórico excede 100.000 versões.');
      const months = [
        ...new Set(versions.map((v) => v.recordedAt.toISOString().slice(0, 7))),
      ];
      const statusEvolution = months.map((month) => {
        const latest = new Map<number, string>();
        for (const v of versions)
          if (v.recordedAt.toISOString().slice(0, 7) <= month)
            latest.set(v.contractId, v.data.status);
        return {
          month,
          statuses: [...new Set(latest.values())].sort().map((status) => ({
            status,
            count: [...latest.values()].filter((s) => s === status).length,
          })),
        };
      });
      const estimated = rows.filter((r) => r.data.estimated_assets != null);
      const stages: {
        stage: string;
        source: string;
        total: number | null;
        completed: number | null;
        percentage: number | null;
      }[] = [];
      for (const [stage, table, doneStatus, permission] of [
        [
          'Preparação aprovada',
          'project_preparations',
          'approved',
          'project-preparation:read',
        ],
        [
          'Coordenação de campo concluída',
          'field_checklists',
          'completed',
          'field-coordination:read',
        ],
        [
          'Sessões de inventário finalizadas',
          'inventory_sessions',
          'finished',
          'inventory-sessions:read',
        ],
      ]) {
        if (!(await hasAllPermissions(actor, [permission], this.permissions)))
          continue;
        const counts = await m
          .createQueryBuilder()
          .from(table, 'stage')
          .select('COUNT(*)', 'total')
          .addSelect(
            'SUM(CASE WHEN stage.status = :doneStatus THEN 1 ELSE 0 END)',
            'completed',
          )
          .where('stage.organization_id = :stageOrg', {
            stageOrg: actor.organizationId,
          })
          .andWhere(
            `stage.project_id IN (${projects.getQuery()})`,
            projects.getParameters(),
          )
          .setParameter('doneStatus', doneStatus)
          .getRawOne<{ total: string; completed: string | null }>();
        const total = Number(counts?.total ?? 0),
          completed = Number(counts?.completed ?? 0);
        stages.push({
          stage,
          source: table,
          total: total || null,
          completed: total ? completed : null,
          percentage: total
            ? Math.round((completed / total) * 10000) / 100
            : null,
        });
      }
      const payload = {
        filters: Object.fromEntries(
          Object.entries(filters)
            .filter(
              ([k, v]) =>
                v != null &&
                ![
                  'expected_hash',
                  'page',
                  'page_size',
                  'sort',
                  'direction',
                ].includes(k),
            )
            .sort(([a], [b]) => a.localeCompare(b)),
        ),
        count: rows.length,
        totals,
        annual: years,
        undated_contracts: rows.filter((r) => !r.data.contracted_on).length,
        estimated_assets: estimated.length
          ? estimated.reduce((s, r) => s + r.data.estimated_assets!, 0)
          : null,
        missing_estimated_assets: rows.length - estimated.length,
        segments: groupBy('segment'),
        companies: groupBy('company_name'),
        states: groupBy('company_state'),
        status_evolution: statusEvolution,
        operational_stages: stages,
        statuses: [...new Set(rows.map((r) => r.data.status))]
          .sort()
          .map((status) => ({
            status,
            count: rows.filter((r) => r.data.status === status).length,
          })),
        rows: rows.map((r) => ({
          id: r.id,
          project_id: r.projectId,
          revision: r.revision,
          ...r.data,
        })),
      };
      return {
        ...payload,
        hash: createHash('sha256')
          .update(JSON.stringify(payload))
          .digest('hex'),
      };
    });
  }
  async saveReport(
    filters: OrganizationOverviewQueryDto,
    actor: ProjectActorContext,
  ) {
    const payload = await this.overview(filters, actor);
    if (!filters.expected_hash || payload.hash !== filters.expected_hash)
      conflict('Os dados mudaram. Atualize os indicadores antes de exportar.');
    return this.ds.getRepository(CommercialReportEntity).save({
      organizationId: actor.organizationId!,
      actorId: actor.id,
      recordedAt: new Date(),
      payload,
    });
  }
  async report(id: number, actor: ProjectActorContext) {
    // Reuse role/organization enforcement even for a historical snapshot.
    this.operational.query({}, actor);
    const report = await this.ds
      .getRepository(CommercialReportEntity)
      .findOneBy({ id, organizationId: actor.organizationId! });
    if (!report)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Relatório não encontrado.',
      });
    const payload = report.payload as Partial<CommercialPayload>;
    const sourcePermissions: Record<string, string> = {
      project_preparations: 'project-preparation:read',
      field_checklists: 'field-coordination:read',
      inventory_sessions: 'inventory-sessions:read',
    };
    for (const stage of payload.operational_stages ?? []) {
      const permission = sourcePermissions[stage.source];
      if (
        !permission ||
        !(await hasAllPermissions(actor, [permission], this.permissions))
      ) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message:
            'A fonte operacional deste relatório não está mais autorizada.',
        });
      }
    }
    return report;
  }
}
