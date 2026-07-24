import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectDashboardAnalyticsService } from '../../../../src/modules/project-dashboard/application/services/project-dashboard-analytics.service';
import { ProjectDashboardPeriod } from '../../../../src/modules/project-dashboard/application/dto/project-dashboard-query.dto';
import { InventoryItemStatus } from '../../../../src/modules/inventory-items/domain/enums/inventory-item-status.enum';
import { ProjectStatus } from '../../../../src/modules/projects/domain/enums/project-status.enum';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';

const actor = {
  id: 1,
  systemRoles: [UserRole.ORG_ADMIN],
  organizationId: 1,
};

const project = {
  id: 10,
  organizationId: 1,
  companyId: 20,
  name: 'Projeto Dashboard',
  status: ProjectStatus.ACTIVE,
};

function makeService(projectResult: typeof project | null = project) {
  const projects = { findById: jest.fn().mockResolvedValue(projectResult) };
  const analytics = {
    getAnalytics: jest.fn().mockResolvedValue({
      totalItems: 10,
      inventoriedItems: 4,
      totalUnits: 1,
      totalFieldAgents: 2,
      activeDays: 2,
      activeDaysLast7: 2,
      inventoriedToday: 1,
      inventoriedLast7Days: 4,
      inventoriedLast30Days: 4,
      lastActivityAt: new Date('2026-07-24T12:00:00.000Z'),
      timeline: [
        { period: '2026-07-23', total: 1 },
        { period: '2026-07-24', total: 3 },
      ],
      statuses: [
        { status: InventoryItemStatus.EVALUATED, total: 4 },
        { status: InventoryItemStatus.PENDING, total: 6 },
      ],
      units: [{ unit: 'Matriz', total: 10, inventoried: 4 }],
      geographyUnits: [{ name: 'Matriz', state: 'São Paulo' }],
      quality: { withoutUnit: 0, withoutLocation: 2, withoutDescription: 1 },
      recentActivity: [],
      availableUnits: ['Matriz'],
    }),
  };
  const scope = { assertCanAccessProject: jest.fn() };
  const logger = { setContext: jest.fn(), info: jest.fn() };
  return {
    service: new ProjectDashboardAnalyticsService(
      projects as never,
      analytics,
      scope as never,
      logger as never,
    ),
    analytics,
    scope,
  };
}

describe('ProjectDashboardAnalyticsService', () => {
  it('calculates metrics and preserves unavailable domains as null', async () => {
    const { service, scope } = makeService();
    const result = await service.getDashboard(
      10,
      { period: ProjectDashboardPeriod.TOTAL },
      actor,
    );

    expect(result.summary.not_inventoried_items).toBe(6);
    expect(result.summary.average_items_per_active_day).toBe(2);
    expect(result.summary.completion_percentage).toBe(40);
    expect(result.summary.consolidated_items).toBeNull();
    expect(result.timeline[1].cumulative_inventoried_items).toBe(4);
    expect(result.geography[0]).toMatchObject({
      state: 'SP',
      total_items: 10,
      inventoried_items: 4,
    });
    expect(result.sectors.available).toBe(false);
    expect(scope.assertCanAccessProject).toHaveBeenCalledWith(actor, 1);
  });

  it('rejects invalid custom periods', async () => {
    const { service } = makeService();
    await expect(
      service.getDashboard(
        10,
        { period: ProjectDashboardPeriod.CUSTOM },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fills days without activity with zero in daily custom ranges', async () => {
    const { service } = makeService();
    const result = await service.getDashboard(
      10,
      {
        period: ProjectDashboardPeriod.CUSTOM,
        date_from: '2026-07-23',
        date_to: '2026-07-25',
      },
      actor,
    );

    expect(result.timeline).toHaveLength(3);
    expect(result.timeline[2]).toMatchObject({
      period: '2026-07-25',
      inventoried_items: 0,
      cumulative_inventoried_items: 4,
    });
  });

  it('returns not found without querying analytics', async () => {
    const { service, analytics } = makeService(null);
    await expect(
      service.getDashboard(
        999,
        { period: ProjectDashboardPeriod.TOTAL },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(analytics.getAnalytics).not.toHaveBeenCalled();
  });
});
