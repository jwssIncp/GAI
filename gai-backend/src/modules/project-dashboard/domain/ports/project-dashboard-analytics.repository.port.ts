import { InventoryItemStatus } from '../../../inventory-items/domain/enums/inventory-item-status.enum';
import { ProjectDashboardGrouping } from '../../application/dto/project-dashboard-query.dto';

export const PROJECT_DASHBOARD_ANALYTICS_REPOSITORY = Symbol(
  'PROJECT_DASHBOARD_ANALYTICS_REPOSITORY',
);

export interface ProjectDashboardResolvedFilters {
  dateFrom: Date | null;
  dateTo: Date | null;
  grouping: ProjectDashboardGrouping;
  unit: string | null;
  state: string | null;
  status: InventoryItemStatus | null;
}

export interface ProjectDashboardRawAnalytics {
  totalItems: number;
  inventoriedItems: number;
  totalUnits: number;
  totalFieldAgents: number;
  activeDays: number;
  activeDaysLast7: number;
  inventoriedToday: number;
  inventoriedLast7Days: number;
  inventoriedLast30Days: number;
  lastActivityAt: Date | null;
  timeline: Array<{ period: string; total: number }>;
  statuses: Array<{ status: string; total: number }>;
  units: Array<{ unit: string | null; total: number; inventoried: number }>;
  geographyUnits: Array<{ name: string; state: string | null }>;
  quality: {
    withoutUnit: number;
    withoutLocation: number;
    withoutDescription: number;
  };
  recentActivity: Array<{
    id: number;
    inventoryItemId: number;
    operation: string;
    resultingStatus: string | null;
    occurredAt: Date;
  }>;
  availableUnits: string[];
}

export interface ProjectDashboardAnalyticsRepository {
  getAnalytics(
    projectId: number,
    filters: ProjectDashboardResolvedFilters,
  ): Promise<ProjectDashboardRawAnalytics>;
}
