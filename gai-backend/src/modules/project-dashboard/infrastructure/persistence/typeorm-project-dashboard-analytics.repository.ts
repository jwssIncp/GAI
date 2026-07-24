import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { CompanyUnitEntity } from '../../../companies/infrastructure/persistence/company-unit.entity';
import { ProjectUnitEntity } from '../../../companies/infrastructure/persistence/project-unit.entity';
import { ProjectFieldAgentEntity } from '../../../field-agents/infrastructure/persistence/project-field-agent.entity';
import { InventoryItemStatus } from '../../../inventory-items/domain/enums/inventory-item-status.enum';
import { InventoryItemAuditLogEntity } from '../../../inventory-items/infrastructure/persistence/inventory-item-audit-log.entity';
import { InventoryItemEntity } from '../../../inventory-items/infrastructure/persistence/inventory-item.entity';
import { ProjectDashboardGrouping } from '../../application/dto/project-dashboard-query.dto';
import {
  ProjectDashboardAnalyticsRepository,
  ProjectDashboardRawAnalytics,
  ProjectDashboardResolvedFilters,
} from '../../domain/ports/project-dashboard-analytics.repository.port';

type RawRow = Record<string, unknown>;

const STATE_VARIANTS: Record<string, string[]> = {
  AC: ['ac', 'acre'],
  AL: ['al', 'alagoas'],
  AP: ['ap', 'amapa', 'amapá'],
  AM: ['am', 'amazonas'],
  BA: ['ba', 'bahia'],
  CE: ['ce', 'ceara', 'ceará'],
  DF: ['df', 'distrito federal'],
  ES: ['es', 'espirito santo', 'espírito santo'],
  GO: ['go', 'goias', 'goiás'],
  MA: ['ma', 'maranhao', 'maranhão'],
  MT: ['mt', 'mato grosso'],
  MS: ['ms', 'mato grosso do sul'],
  MG: ['mg', 'minas gerais'],
  PA: ['pa', 'para', 'pará'],
  PB: ['pb', 'paraiba', 'paraíba'],
  PR: ['pr', 'parana', 'paraná'],
  PE: ['pe', 'pernambuco'],
  PI: ['pi', 'piaui', 'piauí'],
  RJ: ['rj', 'rio de janeiro'],
  RN: ['rn', 'rio grande do norte'],
  RS: ['rs', 'rio grande do sul'],
  RO: ['ro', 'rondonia', 'rondônia'],
  RR: ['rr', 'roraima'],
  SC: ['sc', 'santa catarina'],
  SP: ['sp', 'sao paulo', 'são paulo'],
  SE: ['se', 'sergipe'],
  TO: ['to', 'tocantins'],
};

@Injectable()
export class TypeOrmProjectDashboardAnalyticsRepository implements ProjectDashboardAnalyticsRepository {
  constructor(
    @InjectRepository(InventoryItemEntity)
    private readonly items: Repository<InventoryItemEntity>,
    @InjectRepository(InventoryItemAuditLogEntity)
    private readonly itemAudit: Repository<InventoryItemAuditLogEntity>,
    @InjectRepository(ProjectFieldAgentEntity)
    private readonly fieldAgents: Repository<ProjectFieldAgentEntity>,
    @InjectRepository(ProjectUnitEntity)
    private readonly projectUnits: Repository<ProjectUnitEntity>,
  ) {}

  async getAnalytics(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): Promise<ProjectDashboardRawAnalytics> {
    const [
      summary,
      timelineRows,
      statusRows,
      unitRows,
      geographyUnits,
      quality,
      recentActivity,
      availableUnitRows,
      totalFieldAgents,
    ] = await Promise.all([
      this.getSummary(projectId, filters),
      this.getTimeline(projectId, filters),
      this.getStatuses(projectId, filters),
      this.getUnits(projectId, filters),
      this.getGeographyUnits(projectId),
      this.getQuality(projectId, filters),
      this.getRecentActivity(projectId, filters),
      this.getAvailableUnits(projectId),
      this.fieldAgents.count({ where: { projectId } }),
    ]);

    return {
      totalItems: this.number(summary, 'total_items'),
      inventoriedItems: this.number(summary, 'inventoried_items'),
      totalUnits: this.number(summary, 'total_units'),
      totalFieldAgents,
      activeDays: this.number(summary, 'active_days'),
      activeDaysLast7: this.number(summary, 'active_days_last_7'),
      inventoriedToday: this.number(summary, 'inventoried_today'),
      inventoriedLast7Days: this.number(summary, 'inventoried_last_7_days'),
      inventoriedLast30Days: this.number(summary, 'inventoried_last_30_days'),
      lastActivityAt: this.date(summary, 'last_activity_at'),
      timeline: timelineRows.map((row) => ({
        period: this.string(row, 'period'),
        total: this.number(row, 'total'),
      })),
      statuses: statusRows.map((row) => ({
        status: this.string(row, 'status'),
        total: this.number(row, 'total'),
      })),
      units: unitRows.map((row) => ({
        unit: this.string(row, 'unit') || null,
        total: this.number(row, 'total'),
        inventoried: this.number(row, 'inventoried'),
      })),
      geographyUnits: geographyUnits.map((unit) => ({
        name: unit.name,
        state: unit.state,
      })),
      quality: {
        withoutUnit: this.number(quality, 'without_unit'),
        withoutLocation: this.number(quality, 'without_location'),
        withoutDescription: this.number(quality, 'without_description'),
      },
      recentActivity: recentActivity.map((row) => ({
        id: Number(row.id),
        inventoryItemId: Number(row.inventoryItemId),
        operation: row.operation,
        resultingStatus: this.statusAfter(row.changes),
        occurredAt: row.createdAt,
      })),
      availableUnits: availableUnitRows.map((row) => this.string(row, 'unit')),
    };
  }

  private async getSummary(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): Promise<RawRow> {
    const qb = this.baseItemsQuery(projectId, filters);
    const day = this.dayExpression('item.updated_at');
    const today = this.startOfToday();
    const last7 = new Date(today);
    last7.setUTCDate(last7.getUTCDate() - 6);
    const last30 = new Date(today);
    last30.setUTCDate(last30.getUTCDate() - 29);

    return (
      (await qb
        .select([
          `SUM(CASE WHEN item.status NOT IN (:...nonOperational) THEN 1 ELSE 0 END) AS total_items`,
          `SUM(CASE WHEN item.status = :evaluated THEN 1 ELSE 0 END) AS inventoried_items`,
          `COUNT(DISTINCT NULLIF(TRIM(item.unit_text), '')) AS total_units`,
          `COUNT(DISTINCT CASE WHEN item.status = :evaluated THEN ${day} ELSE NULL END) AS active_days`,
          `COUNT(DISTINCT CASE WHEN item.status = :evaluated AND item.updated_at >= :last7 THEN ${day} ELSE NULL END) AS active_days_last_7`,
          `SUM(CASE WHEN item.status = :evaluated AND item.updated_at >= :today THEN 1 ELSE 0 END) AS inventoried_today`,
          `SUM(CASE WHEN item.status = :evaluated AND item.updated_at >= :last7 THEN 1 ELSE 0 END) AS inventoried_last_7_days`,
          `SUM(CASE WHEN item.status = :evaluated AND item.updated_at >= :last30 THEN 1 ELSE 0 END) AS inventoried_last_30_days`,
          `MAX(CASE WHEN item.status = :evaluated THEN item.updated_at ELSE NULL END) AS last_activity_at`,
        ])
        .setParameters({
          nonOperational: [
            InventoryItemStatus.REMOVED,
            InventoryItemStatus.INACTIVE,
          ],
          evaluated: InventoryItemStatus.EVALUATED,
          today,
          last7,
          last30,
        })
        .getRawOne<RawRow>()) ?? {}
    );
  }

  private async getTimeline(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): Promise<RawRow[]> {
    const period = this.periodExpression('item.updated_at', filters.grouping);
    const qb = this.baseItemsQuery(projectId, filters);
    qb.andWhere('item.status = :evaluated', {
      evaluated: InventoryItemStatus.EVALUATED,
    });
    return qb
      .select(`${period}`, 'period')
      .addSelect('COUNT(item.id)', 'total')
      .groupBy(period)
      .orderBy(period, 'ASC')
      .getRawMany<RawRow>();
  }

  private async getStatuses(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): Promise<RawRow[]> {
    return this.baseItemsQuery(projectId, filters)
      .select('item.status', 'status')
      .addSelect('COUNT(item.id)', 'total')
      .groupBy('item.status')
      .orderBy('COUNT(item.id)', 'DESC')
      .getRawMany<RawRow>();
  }

  private async getUnits(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): Promise<RawRow[]> {
    const unitExpression = `NULLIF(TRIM(item.unit_text), '')`;
    return this.baseItemsQuery(projectId, filters)
      .select(unitExpression, 'unit')
      .addSelect('COUNT(item.id)', 'total')
      .addSelect(
        'SUM(CASE WHEN item.status = :evaluated THEN 1 ELSE 0 END)',
        'inventoried',
      )
      .setParameter('evaluated', InventoryItemStatus.EVALUATED)
      .groupBy(unitExpression)
      .orderBy('COUNT(item.id)', 'DESC')
      .getRawMany<RawRow>();
  }

  private async getQuality(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): Promise<RawRow> {
    return (
      (await this.baseItemsQuery(projectId, filters)
        .select([
          `SUM(CASE WHEN item.unit_text IS NULL OR TRIM(item.unit_text) = '' THEN 1 ELSE 0 END) AS without_unit`,
          `SUM(CASE WHEN item.location_text IS NULL OR TRIM(item.location_text) = '' THEN 1 ELSE 0 END) AS without_location`,
          `SUM(CASE WHEN item.description IS NULL OR TRIM(item.description) = '' THEN 1 ELSE 0 END) AS without_description`,
        ])
        .getRawOne<RawRow>()) ?? {}
    );
  }

  private async getGeographyUnits(
    projectId: number,
  ): Promise<Array<{ name: string; state: string | null }>> {
    const rows = await this.projectUnits
      .createQueryBuilder('projectUnit')
      .innerJoin(
        CompanyUnitEntity,
        'unit',
        'unit.id = projectUnit.company_unit_id AND unit.deleted_at IS NULL',
      )
      .select('unit.name', 'name')
      .addSelect('unit.state', 'state')
      .where('projectUnit.project_id = :projectId', { projectId })
      .andWhere('projectUnit.deleted_at IS NULL')
      .getRawMany<{ name: string; state: string | null }>();
    return rows;
  }

  private async getRecentActivity(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): Promise<InventoryItemAuditLogEntity[]> {
    const qb = this.itemAudit
      .createQueryBuilder('audit')
      .where('audit.project_id = :projectId', { projectId });
    if (filters.dateFrom) {
      qb.andWhere('audit.created_at >= :activityFrom', {
        activityFrom: filters.dateFrom,
      });
    }
    if (filters.dateTo) {
      qb.andWhere('audit.created_at <= :activityTo', {
        activityTo: filters.dateTo,
      });
    }
    return qb.orderBy('audit.created_at', 'DESC').take(8).getMany();
  }

  private async getAvailableUnits(projectId: number): Promise<RawRow[]> {
    return this.items
      .createQueryBuilder('item')
      .select(`DISTINCT TRIM(item.unit_text)`, 'unit')
      .where('item.project_id = :projectId', { projectId })
      .andWhere('item.deleted_at IS NULL')
      .andWhere(`item.unit_text IS NOT NULL AND TRIM(item.unit_text) <> ''`)
      .orderBy('unit', 'ASC')
      .getRawMany<RawRow>();
  }

  private baseItemsQuery(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): SelectQueryBuilder<InventoryItemEntity> {
    const qb = this.items
      .createQueryBuilder('item')
      .where('item.project_id = :projectId', { projectId })
      .andWhere('item.deleted_at IS NULL');

    if (filters.dateFrom) {
      qb.andWhere('item.updated_at >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }
    if (filters.dateTo) {
      qb.andWhere('item.updated_at <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters.unit) {
      qb.andWhere('LOWER(TRIM(item.unit_text)) = :unit', {
        unit: filters.unit.trim().toLowerCase(),
      });
    }
    if (filters.status) {
      qb.andWhere('item.status = :filterStatus', {
        filterStatus: filters.status,
      });
    }
    if (filters.state) {
      const variants = STATE_VARIANTS[filters.state] ?? [
        filters.state.toLowerCase(),
      ];
      qb.andWhere(
        new Brackets((stateQb) => {
          stateQb.where(
            `EXISTS (
              SELECT 1
              FROM project_units pu
              INNER JOIN company_units cu ON cu.id = pu.company_unit_id
              WHERE pu.project_id = item.project_id
                AND pu.deleted_at IS NULL
                AND cu.deleted_at IS NULL
                AND LOWER(TRIM(cu.name)) = LOWER(TRIM(item.unit_text))
                AND LOWER(TRIM(cu.state)) IN (:...stateVariants)
            )`,
            { stateVariants: variants },
          );
        }),
      );
    }
    return qb;
  }

  private periodExpression(
    column: string,
    grouping: ProjectDashboardGrouping,
  ): string {
    const sqlite = this.items.manager.connection.options.type === 'sqlite';
    if (grouping === ProjectDashboardGrouping.MONTH) {
      return sqlite
        ? `strftime('%Y-%m', datetime(${column}, '-3 hours'))`
        : `DATE_FORMAT(CONVERT_TZ(${column}, '+00:00', '-03:00'), '%Y-%m')`;
    }
    if (grouping === ProjectDashboardGrouping.WEEK) {
      return sqlite
        ? `strftime('%Y-W%W', datetime(${column}, '-3 hours'))`
        : `DATE_FORMAT(CONVERT_TZ(${column}, '+00:00', '-03:00'), '%x-W%v')`;
    }
    return this.dayExpression(column);
  }

  private dayExpression(column: string): string {
    return this.items.manager.connection.options.type === 'sqlite'
      ? `date(datetime(${column}, '-3 hours'))`
      : `DATE(CONVERT_TZ(${column}, '+00:00', '-03:00'))`;
  }

  private startOfToday(): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return new Date(`${formatter.format(new Date())}T00:00:00-03:00`);
  }

  private statusAfter(
    changes: Record<string, { before: unknown; after: unknown }>,
  ): string | null {
    const status = changes.status?.after;
    return typeof status === 'string' ? status : null;
  }

  private number(row: RawRow, key: string): number {
    const value = row[key];
    return value === null || value === undefined ? 0 : Number(value);
  }

  private date(row: RawRow, key: string): Date | null {
    const value = row[key];
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (
      value instanceof Date ||
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return value instanceof Date ? value : new Date(value);
    }
    return null;
  }

  private string(row: RawRow, key: string): string {
    const value = row[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return `${value}`;
    }
    return '';
  }
}
