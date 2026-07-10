import {
  ProjectAccountingSummaryDto,
  ProjectExportsSummaryDto,
  ProjectFieldAgentsSummaryDto,
  ProjectFinancialSummaryDto,
  ProjectImagesSummaryDto,
  ProjectImportsSummaryDto,
  ProjectInventorySummaryDto,
  ProjectPendingIssuesSummaryDto,
  ProjectRecentActivitySummaryDto,
} from '../../application/dto/project-summary-response.dto';

export const PROJECT_SUMMARY_REPOSITORY = Symbol('PROJECT_SUMMARY_REPOSITORY');

export interface ProjectSummaryRepository {
  getInventorySummary(projectId: number): Promise<ProjectInventorySummaryDto>;
  getImagesSummary(projectId: number): Promise<ProjectImagesSummaryDto>;
  getAccountingSummary(projectId: number): Promise<ProjectAccountingSummaryDto>;
  getPendingIssuesSummary(
    projectId: number,
  ): Promise<ProjectPendingIssuesSummaryDto>;
  getFieldAgentsSummary(
    projectId: number,
  ): Promise<ProjectFieldAgentsSummaryDto>;
  getFinancialSummary(projectId: number): Promise<ProjectFinancialSummaryDto>;
  getImportsSummary(projectId: number): Promise<ProjectImportsSummaryDto>;
  getExportsSummary(projectId: number): Promise<ProjectExportsSummaryDto>;
  getRecentActivitySummary(
    projectId: number,
  ): Promise<ProjectRecentActivitySummaryDto>;
}
