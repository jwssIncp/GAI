import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../../../projects/application/services/project-scope.service';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { InventoryItemStatus } from '../../../inventory-items/domain/enums/inventory-item-status.enum';
import {
  ProjectDashboardGrouping,
  ProjectDashboardPeriod,
  ProjectDashboardQueryDto,
} from '../dto/project-dashboard-query.dto';
import {
  DashboardGeographyPointDto,
  DashboardTimelinePointDto,
  DashboardUnitPointDto,
  ProjectDashboardAnalyticsResponseDto,
} from '../dto/project-dashboard-response.dto';
import {
  PROJECT_DASHBOARD_ANALYTICS_REPOSITORY,
  type ProjectDashboardAnalyticsRepository,
  ProjectDashboardRawAnalytics,
  ProjectDashboardResolvedFilters,
} from '../../domain/ports/project-dashboard-analytics.repository.port';
import { calculateProgressPercentage } from './project-summary-calculations';

const TIMEZONE = 'America/Sao_Paulo';
const UF_BY_NORMALIZED_NAME: Record<string, string> = {
  ac: 'AC',
  acre: 'AC',
  al: 'AL',
  alagoas: 'AL',
  ap: 'AP',
  amapa: 'AP',
  am: 'AM',
  amazonas: 'AM',
  ba: 'BA',
  bahia: 'BA',
  ce: 'CE',
  ceara: 'CE',
  df: 'DF',
  'distrito federal': 'DF',
  es: 'ES',
  'espirito santo': 'ES',
  go: 'GO',
  goias: 'GO',
  ma: 'MA',
  maranhao: 'MA',
  mt: 'MT',
  'mato grosso': 'MT',
  ms: 'MS',
  'mato grosso do sul': 'MS',
  mg: 'MG',
  'minas gerais': 'MG',
  pa: 'PA',
  para: 'PA',
  pb: 'PB',
  paraiba: 'PB',
  pr: 'PR',
  parana: 'PR',
  pe: 'PE',
  pernambuco: 'PE',
  pi: 'PI',
  piaui: 'PI',
  rj: 'RJ',
  'rio de janeiro': 'RJ',
  rn: 'RN',
  'rio grande do norte': 'RN',
  rs: 'RS',
  'rio grande do sul': 'RS',
  ro: 'RO',
  rondonia: 'RO',
  rr: 'RR',
  roraima: 'RR',
  sc: 'SC',
  'santa catarina': 'SC',
  sp: 'SP',
  'sao paulo': 'SP',
  se: 'SE',
  sergipe: 'SE',
  to: 'TO',
  tocantins: 'TO',
};

@Injectable()
export class ProjectDashboardAnalyticsService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    @Inject(PROJECT_DASHBOARD_ANALYTICS_REPOSITORY)
    private readonly analytics: ProjectDashboardAnalyticsRepository,
    private readonly scope: ProjectScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProjectDashboardAnalyticsService.name);
  }

  async getDashboard(
    projectId: number,
    query: ProjectDashboardQueryDto,
    actor: ProjectActorContext,
  ): Promise<ProjectDashboardAnalyticsResponseDto> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertCanAccessProject(actor, project.organizationId);
    const filters = this.resolveFilters(query);
    const raw = await this.analytics.getAnalytics(projectId, filters);
    const units = this.toUnits(raw);
    const geography = this.toGeography(raw, units, filters.state);
    const unlocatedItems = this.unlocatedItems(raw, units);
    const average =
      raw.activeDays === 0
        ? 0
        : Number((raw.inventoriedItems / raw.activeDays).toFixed(2));
    const remaining = Math.max(0, raw.totalItems - raw.inventoriedItems);
    const recentAverage =
      raw.activeDaysLast7 === 0
        ? 0
        : raw.inventoriedLast7Days / raw.activeDaysLast7;

    this.logger.info(
      { projectId, actorId: actor.id, filters: this.logFilters(filters) },
      'project_dashboard_analytics_requested',
    );

    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        organization_id: project.organizationId,
        company_id: project.companyId,
      },
      summary: {
        total_items: raw.totalItems,
        inventoried_items: raw.inventoriedItems,
        not_inventoried_items: remaining,
        consolidated_items: null,
        pending_consolidation_items: null,
        completion_percentage: calculateProgressPercentage(
          raw.inventoriedItems,
          raw.totalItems,
        ),
        consolidation_percentage: null,
        total_sectors: null,
        total_units: raw.totalUnits,
        total_field_agents: raw.totalFieldAgents,
        active_days: raw.activeDays,
        average_items_per_active_day: average,
        inventoried_today: raw.inventoriedToday,
        inventoried_last_7_days: raw.inventoriedLast7Days,
        inventoried_last_30_days: raw.inventoriedLast30Days,
        last_activity_at: raw.lastActivityAt?.toISOString() ?? null,
        estimated_completion_date: this.estimateCompletion(
          remaining,
          recentAverage,
        ),
      },
      timeline: this.toTimeline(raw, filters),
      status_distribution: this.toStatusDistribution(raw),
      units,
      geography,
      unlocated_items: unlocatedItems,
      data_quality: {
        items_without_unit: raw.quality.withoutUnit,
        items_without_location: raw.quality.withoutLocation,
        items_without_description: raw.quality.withoutDescription,
        items_without_state: unlocatedItems,
      },
      recent_activity: raw.recentActivity.map((activity) => ({
        id: activity.id,
        inventory_item_id: activity.inventoryItemId,
        operation: activity.operation,
        resulting_status: activity.resultingStatus,
        occurred_at: activity.occurredAt.toISOString(),
      })),
      attention_units: [...units]
        .filter((unit) => unit.total_items > 0)
        .sort(
          (left, right) =>
            left.completion_percentage - right.completion_percentage ||
            right.pending_items - left.pending_items,
        )
        .slice(0, 5),
      sectors: {
        available: false,
        reason: 'O modelo atual não possui entidade ou campo de setor.',
      },
      consolidation: {
        available: false,
        reason:
          'O modelo atual não registra consolidação por item nem data de consolidação.',
      },
      productivity: {
        available: false,
        reason:
          'O item não possui vínculo confiável com o inventariante que realizou a avaliação.',
      },
      filters: {
        period: query.period ?? ProjectDashboardPeriod.LAST_30_DAYS,
        date_from: filters.dateFrom
          ? this.dateInTimezone(filters.dateFrom)
          : null,
        date_to: filters.dateTo ? this.dateInTimezone(filters.dateTo) : null,
        grouping: filters.grouping,
        unit: filters.unit,
        state: filters.state,
        status: filters.status,
        available_units: raw.availableUnits,
        available_states: [
          ...new Set(geography.map((point) => point.state)),
        ].sort(),
        available_statuses: Object.values(InventoryItemStatus),
      },
      limitations: [
        'Itens inventariados correspondem ao status técnico evaluated.',
        'A série temporal usa inventory_items.updated_at, pois não existe inventoried_at; alterações posteriores podem deslocar a data.',
        'A unidade do item é texto livre e só é associada à unidade cadastrada por nome normalizado.',
        'Setores, consolidação e produtividade individual não possuem dados confiáveis no modelo atual.',
      ],
      timezone: TIMEZONE,
    };
  }

  private resolveFilters(
    query: ProjectDashboardQueryDto,
  ): ProjectDashboardResolvedFilters {
    const period = query.period ?? ProjectDashboardPeriod.LAST_30_DAYS;
    const now = new Date();
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (period === ProjectDashboardPeriod.CUSTOM) {
      if (!query.date_from || !query.date_to) {
        throw this.validation(
          'date_from and date_to are required for custom period',
        );
      }
      dateFrom = this.startOfDay(query.date_from);
      dateTo = this.endOfDay(query.date_to);
    } else if (period !== ProjectDashboardPeriod.TOTAL) {
      const today = this.dateInTimezone(now);
      dateTo = this.endOfDay(today);
      if (period === ProjectDashboardPeriod.CURRENT_MONTH) {
        dateFrom = this.startOfDay(`${today.slice(0, 7)}-01`);
      } else {
        const days = period === ProjectDashboardPeriod.LAST_7_DAYS ? 7 : 30;
        dateFrom = new Date(this.startOfDay(today));
        dateFrom.setUTCDate(dateFrom.getUTCDate() - (days - 1));
      }
    }

    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        throw this.validation('date_from must be before or equal to date_to');
      }
      const rangeDays =
        Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86400000) + 1;
      if (rangeDays > 366) {
        throw this.validation('Custom date range cannot exceed 366 days');
      }
    }

    return {
      dateFrom,
      dateTo,
      grouping: query.grouping ?? ProjectDashboardGrouping.DAY,
      unit: query.unit?.trim() || null,
      state: query.state ?? null,
      status: query.status ?? null,
    };
  }

  private toTimeline(
    raw: ProjectDashboardRawAnalytics,
    filters: ProjectDashboardResolvedFilters,
  ): DashboardTimelinePointDto[] {
    const timeline = this.fillDailyGaps(raw.timeline, filters);
    let cumulative = 0;
    return timeline.map((point, index, points) => {
      cumulative += point.total;
      const window = points.slice(Math.max(0, index - 6), index + 1);
      const movingAverage =
        window.reduce((total, item) => total + item.total, 0) / window.length;
      return {
        period: point.period,
        inventoried_items: point.total,
        moving_average: Number(movingAverage.toFixed(2)),
        cumulative_inventoried_items: cumulative,
        cumulative_consolidated_items: null,
        total_items_reference: raw.totalItems,
      };
    });
  }

  private toStatusDistribution(raw: ProjectDashboardRawAnalytics) {
    const statusTotal = raw.statuses.reduce(
      (total, status) => total + status.total,
      0,
    );
    return raw.statuses.map((status) => ({
      status: status.status,
      total_items: status.total,
      percentage: calculateProgressPercentage(status.total, statusTotal),
    }));
  }

  private fillDailyGaps(
    timeline: ProjectDashboardRawAnalytics['timeline'],
    filters: ProjectDashboardResolvedFilters,
  ): ProjectDashboardRawAnalytics['timeline'] {
    if (filters.grouping !== ProjectDashboardGrouping.DAY) return timeline;
    const first = filters.dateFrom
      ? this.dateInTimezone(filters.dateFrom)
      : timeline[0]?.period;
    const last = filters.dateTo
      ? this.dateInTimezone(filters.dateTo)
      : timeline.at(-1)?.period;
    if (!first || !last) return timeline;

    const totals = new Map(
      timeline.map((point) => [point.period, point.total]),
    );
    const cursor = this.startOfDay(first);
    const end = this.startOfDay(last);
    const result: ProjectDashboardRawAnalytics['timeline'] = [];
    while (cursor <= end && result.length <= 366) {
      const period = this.dateInTimezone(cursor);
      result.push({ period, total: totals.get(period) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result.length > 366 ? timeline : result;
  }

  private toUnits(raw: ProjectDashboardRawAnalytics): DashboardUnitPointDto[] {
    return raw.units.map((unit) => ({
      unit: unit.unit,
      total_items: unit.total,
      inventoried_items: unit.inventoried,
      pending_items: Math.max(0, unit.total - unit.inventoried),
      consolidated_items: null,
      completion_percentage: calculateProgressPercentage(
        unit.inventoried,
        unit.total,
      ),
    }));
  }

  private toGeography(
    raw: ProjectDashboardRawAnalytics,
    units: DashboardUnitPointDto[],
    selectedState: string | null,
  ): DashboardGeographyPointDto[] {
    const itemUnitMap = new Map(
      units
        .filter((unit) => unit.unit)
        .map((unit) => [this.normalize(unit.unit!), unit]),
    );
    const states = new Map<
      string,
      { total: number; inventoried: number; units: Set<string> }
    >();
    for (const unit of raw.geographyUnits) {
      const state = this.normalizeState(unit.state);
      if (!state || (selectedState && state !== selectedState)) continue;
      const bucket = states.get(state) ?? {
        total: 0,
        inventoried: 0,
        units: new Set<string>(),
      };
      const itemUnit = itemUnitMap.get(this.normalize(unit.name));
      bucket.total += itemUnit?.total_items ?? 0;
      bucket.inventoried += itemUnit?.inventoried_items ?? 0;
      bucket.units.add(this.normalize(unit.name));
      states.set(state, bucket);
    }
    return [...states.entries()]
      .map(([state, bucket]) => ({
        state,
        total_items: bucket.total,
        inventoried_items: bucket.inventoried,
        pending_items: Math.max(0, bucket.total - bucket.inventoried),
        consolidated_items: null,
        total_units: bucket.units.size,
        total_sectors: null,
        completion_percentage: calculateProgressPercentage(
          bucket.inventoried,
          bucket.total,
        ),
      }))
      .sort((left, right) => left.state.localeCompare(right.state));
  }

  private unlocatedItems(
    raw: ProjectDashboardRawAnalytics,
    units: DashboardUnitPointDto[],
  ): number {
    const locatedNames = new Set(
      raw.geographyUnits
        .filter((unit) => this.normalizeState(unit.state))
        .map((unit) => this.normalize(unit.name)),
    );
    return units.reduce(
      (total, unit) =>
        total +
        (!unit.unit || !locatedNames.has(this.normalize(unit.unit))
          ? unit.total_items
          : 0),
      0,
    );
  }

  private estimateCompletion(
    remainingItems: number,
    recentAverage: number,
  ): string | null {
    if (remainingItems === 0 || recentAverage <= 0) return null;
    const date = new Date();
    date.setUTCDate(
      date.getUTCDate() + Math.ceil(remainingItems / recentAverage),
    );
    return this.dateInTimezone(date);
  }

  private normalizeState(value: string | null): string | null {
    if (!value) return null;
    return UF_BY_NORMALIZED_NAME[this.normalize(value)] ?? null;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private dateInTimezone(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private startOfDay(date: string): Date {
    return new Date(`${date}T00:00:00-03:00`);
  }

  private endOfDay(date: string): Date {
    return new Date(`${date}T23:59:59.999-03:00`);
  }

  private validation(message: string): BadRequestException {
    return new BadRequestException({ code: 'VALIDATION_ERROR', message });
  }

  private logFilters(filters: ProjectDashboardResolvedFilters) {
    return {
      ...filters,
      dateFrom: filters.dateFrom?.toISOString() ?? null,
      dateTo: filters.dateTo?.toISOString() ?? null,
    };
  }
}
