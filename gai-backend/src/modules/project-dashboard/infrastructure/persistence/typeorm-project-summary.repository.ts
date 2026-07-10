import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectAccountingSummaryDto } from '../../application/dto/project-summary-response.dto';
import { ProjectExportsSummaryDto } from '../../application/dto/project-summary-response.dto';
import { ProjectFieldAgentsSummaryDto } from '../../application/dto/project-summary-response.dto';
import { ProjectFinancialSummaryDto } from '../../application/dto/project-summary-response.dto';
import { ProjectImagesSummaryDto } from '../../application/dto/project-summary-response.dto';
import { ProjectImportsSummaryDto } from '../../application/dto/project-summary-response.dto';
import { ProjectInventorySummaryDto } from '../../application/dto/project-summary-response.dto';
import { ProjectPendingIssuesSummaryDto } from '../../application/dto/project-summary-response.dto';
import { ProjectRecentActivitySummaryDto } from '../../application/dto/project-summary-response.dto';
import {
  calculateProgressPercentage,
  sumMoney,
} from '../../application/services/project-summary-calculations';
import { ProjectSummaryRepository } from '../../domain/ports/project-summary.repository.port';
import { ProjectFieldAgentStatus } from '../../../field-agents/domain/enums/project-field-agent-status.enum';
import { ProjectFieldAgentEntity } from '../../../field-agents/infrastructure/persistence/project-field-agent.entity';
import { ImportSessionStatus } from '../../../import-sessions/domain/enums/import-session-status.enum';
import { ImportSessionEntity } from '../../../import-sessions/infrastructure/persistence/import-session.entity';
import { InventoryAccountingItemStatus } from '../../../inventory-accounting-items/domain/enums/inventory-accounting-item-status.enum';
import { InventoryAccountingItemEntity } from '../../../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemImageStatus } from '../../../inventory-item-images/domain/enums/inventory-item-image-status.enum';
import { InventoryItemImageEntity } from '../../../inventory-item-images/infrastructure/persistence/inventory-item-image.entity';
import { InventoryItemStatus } from '../../../inventory-items/domain/enums/inventory-item-status.enum';
import { InventoryItemEntity } from '../../../inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryPendingIssueSeverity } from '../../../inventory-pending-issues/domain/enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../../../inventory-pending-issues/domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueEntity } from '../../../inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { ExpenseStatus } from '../../../payments-expenses/domain/enums/expense-status.enum';
import { PaymentStatus } from '../../../payments-expenses/domain/enums/payment-status.enum';
import { ExpenseEntity } from '../../../payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../../../payments-expenses/infrastructure/persistence/field-agent-payment.entity';

type RawRow = Record<string, unknown>;

@Injectable()
export class TypeOrmProjectSummaryRepository implements ProjectSummaryRepository {
  constructor(
    @InjectRepository(InventoryItemEntity)
    private readonly inventoryItems: Repository<InventoryItemEntity>,
    @InjectRepository(InventoryItemImageEntity)
    private readonly images: Repository<InventoryItemImageEntity>,
    @InjectRepository(InventoryAccountingItemEntity)
    private readonly accountingItems: Repository<InventoryAccountingItemEntity>,
    @InjectRepository(InventoryPendingIssueEntity)
    private readonly pendingIssues: Repository<InventoryPendingIssueEntity>,
    @InjectRepository(ProjectFieldAgentEntity)
    private readonly projectFieldAgents: Repository<ProjectFieldAgentEntity>,
    @InjectRepository(FieldAgentPaymentEntity)
    private readonly payments: Repository<FieldAgentPaymentEntity>,
    @InjectRepository(ExpenseEntity)
    private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(ImportSessionEntity)
    private readonly importSessions: Repository<ImportSessionEntity>,
  ) {}

  async getInventorySummary(
    projectId: number,
  ): Promise<ProjectInventorySummaryDto> {
    const row = await this.inventoryItems
      .createQueryBuilder('item')
      .withDeleted()
      .select([
        this.countCase(
          'total_items',
          `item.status NOT IN (:...nonOperationalStatuses) AND item.deleted_at IS NULL`,
        ),
        this.countStatus(
          'evaluated_items',
          'item.status',
          InventoryItemStatus.EVALUATED,
        ),
        this.countStatus(
          'pending_items',
          'item.status',
          InventoryItemStatus.PENDING,
        ),
        this.countStatus(
          'divergent_items',
          'item.status',
          InventoryItemStatus.DIVERGENT,
        ),
        this.countStatus(
          'not_found_items',
          'item.status',
          InventoryItemStatus.NOT_FOUND,
        ),
        this.countStatus(
          'duplicated_items',
          'item.status',
          InventoryItemStatus.DUPLICATED,
        ),
        this.countStatus(
          'removed_items',
          'item.status',
          InventoryItemStatus.REMOVED,
        ),
        this.countCase(
          'inactive_items',
          `(item.status = :inactiveStatus OR item.deleted_at IS NOT NULL)`,
        ),
      ])
      .where('item.project_id = :projectId', { projectId })
      .setParameters({
        nonOperationalStatuses: [
          InventoryItemStatus.REMOVED,
          InventoryItemStatus.INACTIVE,
        ],
        inactiveStatus: InventoryItemStatus.INACTIVE,
      })
      .getRawOne<RawRow>();

    const totalItems = this.number(row, 'total_items');
    const evaluatedItems = this.number(row, 'evaluated_items');

    return {
      total_items: totalItems,
      evaluated_items: evaluatedItems,
      pending_items: this.number(row, 'pending_items'),
      divergent_items: this.number(row, 'divergent_items'),
      not_found_items: this.number(row, 'not_found_items'),
      duplicated_items: this.number(row, 'duplicated_items'),
      removed_items: this.number(row, 'removed_items'),
      inactive_items: this.number(row, 'inactive_items'),
      progress_percentage: calculateProgressPercentage(
        evaluatedItems,
        totalItems,
      ),
    };
  }

  async getImagesSummary(projectId: number): Promise<ProjectImagesSummaryDto> {
    const row = await this.images
      .createQueryBuilder('image')
      .withDeleted()
      .innerJoin(
        InventoryItemEntity,
        'item',
        'item.id = image.inventory_item_id AND item.project_id = :projectId',
        { projectId },
      )
      .select([
        this.countCase('total_images', 'image.deleted_at IS NULL'),
        this.countStatus(
          'uploaded_images',
          'image.status',
          InventoryItemImageStatus.UPLOADED,
        ),
        this.countStatus(
          'pending_upload_images',
          'image.status',
          InventoryItemImageStatus.PENDING_UPLOAD,
        ),
        this.countCase(
          'removed_images',
          '(image.status = :removedImageStatus OR image.deleted_at IS NOT NULL)',
        ),
      ])
      .setParameter('removedImageStatus', InventoryItemImageStatus.REMOVED)
      .getRawOne<RawRow>();

    return {
      total_images: this.number(row, 'total_images'),
      uploaded_images: this.number(row, 'uploaded_images'),
      pending_upload_images: this.number(row, 'pending_upload_images'),
      removed_images: this.number(row, 'removed_images'),
    };
  }

  async getAccountingSummary(
    projectId: number,
  ): Promise<ProjectAccountingSummaryDto> {
    const row = await this.accountingItems
      .createQueryBuilder('accounting')
      .select([
        'COUNT(accounting.id) AS total_accounting_items',
        this.countStatus(
          'matched_accounting_items',
          'accounting.status',
          InventoryAccountingItemStatus.MATCHED,
        ),
        this.countStatus(
          'divergent_accounting_items',
          'accounting.status',
          InventoryAccountingItemStatus.DIVERGENT,
        ),
        this.countStatus(
          'not_found_accounting_items',
          'accounting.status',
          InventoryAccountingItemStatus.NOT_FOUND,
        ),
        this.countStatus(
          'ignored_accounting_items',
          'accounting.status',
          InventoryAccountingItemStatus.IGNORED,
        ),
      ])
      .where('accounting.project_id = :projectId', { projectId })
      .getRawOne<RawRow>();

    return {
      total_accounting_items: this.number(row, 'total_accounting_items'),
      matched_accounting_items: this.number(row, 'matched_accounting_items'),
      divergent_accounting_items: this.number(
        row,
        'divergent_accounting_items',
      ),
      not_found_accounting_items: this.number(
        row,
        'not_found_accounting_items',
      ),
      ignored_accounting_items: this.number(row, 'ignored_accounting_items'),
    };
  }

  async getPendingIssuesSummary(
    projectId: number,
  ): Promise<ProjectPendingIssuesSummaryDto> {
    const row = await this.pendingIssues
      .createQueryBuilder('issue')
      .select([
        'COUNT(issue.id) AS total_pending_issues',
        this.countStatus(
          'open_pending_issues',
          'issue.status',
          InventoryPendingIssueStatus.OPEN,
        ),
        this.countStatus(
          'in_review_pending_issues',
          'issue.status',
          InventoryPendingIssueStatus.IN_REVIEW,
        ),
        this.countStatus(
          'resolved_pending_issues',
          'issue.status',
          InventoryPendingIssueStatus.RESOLVED,
        ),
        this.countStatus(
          'ignored_pending_issues',
          'issue.status',
          InventoryPendingIssueStatus.IGNORED,
        ),
        this.countStatus(
          'cancelled_pending_issues',
          'issue.status',
          InventoryPendingIssueStatus.CANCELLED,
        ),
        this.countStatus(
          'critical_pending_issues',
          'issue.severity',
          InventoryPendingIssueSeverity.CRITICAL,
        ),
        this.countStatus(
          'high_pending_issues',
          'issue.severity',
          InventoryPendingIssueSeverity.HIGH,
        ),
        this.countStatus(
          'medium_pending_issues',
          'issue.severity',
          InventoryPendingIssueSeverity.MEDIUM,
        ),
        this.countStatus(
          'low_pending_issues',
          'issue.severity',
          InventoryPendingIssueSeverity.LOW,
        ),
      ])
      .where('issue.project_id = :projectId', { projectId })
      .getRawOne<RawRow>();

    return {
      total_pending_issues: this.number(row, 'total_pending_issues'),
      open_pending_issues: this.number(row, 'open_pending_issues'),
      in_review_pending_issues: this.number(row, 'in_review_pending_issues'),
      resolved_pending_issues: this.number(row, 'resolved_pending_issues'),
      ignored_pending_issues: this.number(row, 'ignored_pending_issues'),
      cancelled_pending_issues: this.number(row, 'cancelled_pending_issues'),
      critical_pending_issues: this.number(row, 'critical_pending_issues'),
      high_pending_issues: this.number(row, 'high_pending_issues'),
      medium_pending_issues: this.number(row, 'medium_pending_issues'),
      low_pending_issues: this.number(row, 'low_pending_issues'),
    };
  }

  async getFieldAgentsSummary(
    projectId: number,
  ): Promise<ProjectFieldAgentsSummaryDto> {
    const row = await this.projectFieldAgents
      .createQueryBuilder('assignment')
      .select([
        'COUNT(assignment.id) AS total_field_agents',
        this.countStatus(
          'active_field_agents',
          'assignment.status',
          ProjectFieldAgentStatus.ACTIVE,
        ),
        this.countStatus(
          'inactive_field_agents',
          'assignment.status',
          ProjectFieldAgentStatus.INACTIVE,
        ),
        this.countStatus(
          'finished_field_agents',
          'assignment.status',
          ProjectFieldAgentStatus.FINISHED,
        ),
      ])
      .where('assignment.project_id = :projectId', { projectId })
      .getRawOne<RawRow>();

    return {
      total_field_agents: this.number(row, 'total_field_agents'),
      active_field_agents: this.number(row, 'active_field_agents'),
      inactive_field_agents: this.number(row, 'inactive_field_agents'),
      finished_field_agents: this.number(row, 'finished_field_agents'),
    };
  }

  async getFinancialSummary(
    projectId: number,
  ): Promise<ProjectFinancialSummaryDto> {
    const [payments, expenses] = await Promise.all([
      this.getPaymentSummary(projectId),
      this.getExpenseSummary(projectId),
    ]);

    return {
      ...payments,
      ...expenses,
      financial_total_amount: sumMoney(
        payments.total_payment_amount,
        expenses.total_expense_amount,
      ),
    };
  }

  async getImportsSummary(
    projectId: number,
  ): Promise<ProjectImportsSummaryDto> {
    const row = await this.importSessions
      .createQueryBuilder('session')
      .select([
        'COUNT(session.id) AS total_import_sessions',
        this.countStatus(
          'open_import_sessions',
          'session.status',
          ImportSessionStatus.OPEN,
        ),
        this.countCase(
          'processing_import_sessions',
          'session.status IN (:...processingStatuses)',
        ),
        this.countStatus(
          'finished_import_sessions',
          'session.status',
          ImportSessionStatus.FINISHED,
        ),
        this.countStatus(
          'failed_import_sessions',
          'session.status',
          ImportSessionStatus.FAILED,
        ),
        this.countStatus(
          'cancelled_import_sessions',
          'session.status',
          ImportSessionStatus.CANCELLED,
        ),
        this.countStatus(
          'expired_import_sessions',
          'session.status',
          ImportSessionStatus.EXPIRED,
        ),
      ])
      .where('session.project_id = :projectId', { projectId })
      .setParameter('processingStatuses', [
        ImportSessionStatus.RECEIVING,
        ImportSessionStatus.PROCESSING,
      ])
      .getRawOne<RawRow>();

    return {
      total_import_sessions: this.number(row, 'total_import_sessions'),
      open_import_sessions: this.number(row, 'open_import_sessions'),
      processing_import_sessions: this.number(
        row,
        'processing_import_sessions',
      ),
      finished_import_sessions: this.number(row, 'finished_import_sessions'),
      failed_import_sessions: this.number(row, 'failed_import_sessions'),
      cancelled_import_sessions: this.number(row, 'cancelled_import_sessions'),
      expired_import_sessions: this.number(row, 'expired_import_sessions'),
    };
  }

  getExportsSummary(): Promise<ProjectExportsSummaryDto> {
    return Promise.resolve({
      total_export_jobs: 0,
      pending_export_jobs: 0,
      processing_export_jobs: 0,
      finished_export_jobs: 0,
      failed_export_jobs: 0,
      cancelled_export_jobs: 0,
      expired_export_jobs: 0,
    });
  }

  async getRecentActivitySummary(
    projectId: number,
  ): Promise<ProjectRecentActivitySummaryDto> {
    const [inventory, imports, issues, payments] = await Promise.all([
      this.inventoryItems
        .createQueryBuilder('item')
        .select([
          'MAX(item.created_at) AS last_inventory_item_created_at',
          'MAX(item.updated_at) AS last_inventory_item_updated_at',
        ])
        .where('item.project_id = :projectId', { projectId })
        .getRawOne<RawRow>(),
      this.importSessions
        .createQueryBuilder('session')
        .select('MAX(session.finished_at)', 'last_import_finished_at')
        .where('session.project_id = :projectId', { projectId })
        .getRawOne<RawRow>(),
      this.pendingIssues
        .createQueryBuilder('issue')
        .select('MAX(issue.created_at)', 'last_pending_issue_created_at')
        .where('issue.project_id = :projectId', { projectId })
        .getRawOne<RawRow>(),
      this.payments
        .createQueryBuilder('payment')
        .select('MAX(payment.updated_at)', 'last_payment_updated_at')
        .where('payment.project_id = :projectId', { projectId })
        .getRawOne<RawRow>(),
    ]);

    return {
      last_inventory_item_created_at: this.isoDate(
        inventory?.last_inventory_item_created_at,
      ),
      last_inventory_item_updated_at: this.isoDate(
        inventory?.last_inventory_item_updated_at,
      ),
      last_import_finished_at: this.isoDate(imports?.last_import_finished_at),
      last_export_finished_at: null,
      last_pending_issue_created_at: this.isoDate(
        issues?.last_pending_issue_created_at,
      ),
      last_payment_updated_at: this.isoDate(payments?.last_payment_updated_at),
    };
  }

  private async getPaymentSummary(
    projectId: number,
  ): Promise<
    Pick<
      ProjectFinancialSummaryDto,
      | 'total_payments'
      | 'pending_payments'
      | 'approved_payments'
      | 'paid_payments'
      | 'cancelled_payments'
      | 'total_payment_amount'
    >
  > {
    const row = await this.payments
      .createQueryBuilder('payment')
      .select([
        'COUNT(payment.id) AS total_payments',
        this.countStatus(
          'pending_payments',
          'payment.status',
          PaymentStatus.PENDING,
        ),
        this.countStatus(
          'approved_payments',
          'payment.status',
          PaymentStatus.APPROVED,
        ),
        this.countStatus('paid_payments', 'payment.status', PaymentStatus.PAID),
        this.countStatus(
          'cancelled_payments',
          'payment.status',
          PaymentStatus.CANCELLED,
        ),
        `COALESCE(SUM(CASE WHEN payment.status <> :cancelledPayment THEN payment.final_amount ELSE 0 END), 0) AS total_payment_amount`,
      ])
      .where('payment.project_id = :projectId', { projectId })
      .setParameter('cancelledPayment', PaymentStatus.CANCELLED)
      .getRawOne<RawRow>();

    return {
      total_payments: this.number(row, 'total_payments'),
      pending_payments: this.number(row, 'pending_payments'),
      approved_payments: this.number(row, 'approved_payments'),
      paid_payments: this.number(row, 'paid_payments'),
      cancelled_payments: this.number(row, 'cancelled_payments'),
      total_payment_amount: this.money(row?.total_payment_amount),
    };
  }

  private async getExpenseSummary(
    projectId: number,
  ): Promise<
    Pick<
      ProjectFinancialSummaryDto,
      | 'total_expenses'
      | 'pending_expenses'
      | 'approved_expenses'
      | 'paid_expenses'
      | 'rejected_expenses'
      | 'cancelled_expenses'
      | 'total_expense_amount'
    >
  > {
    const row = await this.expenses
      .createQueryBuilder('expense')
      .select([
        'COUNT(expense.id) AS total_expenses',
        this.countStatus(
          'pending_expenses',
          'expense.status',
          ExpenseStatus.PENDING,
        ),
        this.countStatus(
          'approved_expenses',
          'expense.status',
          ExpenseStatus.APPROVED,
        ),
        this.countStatus('paid_expenses', 'expense.status', ExpenseStatus.PAID),
        this.countStatus(
          'rejected_expenses',
          'expense.status',
          ExpenseStatus.REJECTED,
        ),
        this.countStatus(
          'cancelled_expenses',
          'expense.status',
          ExpenseStatus.CANCELLED,
        ),
        `COALESCE(SUM(CASE WHEN expense.status NOT IN (:...excludedExpenseStatuses) THEN expense.amount ELSE 0 END), 0) AS total_expense_amount`,
      ])
      .where('expense.project_id = :projectId', { projectId })
      .setParameter('excludedExpenseStatuses', [
        ExpenseStatus.REJECTED,
        ExpenseStatus.CANCELLED,
      ])
      .getRawOne<RawRow>();

    return {
      total_expenses: this.number(row, 'total_expenses'),
      pending_expenses: this.number(row, 'pending_expenses'),
      approved_expenses: this.number(row, 'approved_expenses'),
      paid_expenses: this.number(row, 'paid_expenses'),
      rejected_expenses: this.number(row, 'rejected_expenses'),
      cancelled_expenses: this.number(row, 'cancelled_expenses'),
      total_expense_amount: this.money(row?.total_expense_amount),
    };
  }

  private countStatus(alias: string, column: string, status: string): string {
    return this.countCase(alias, `${column} = '${status}'`);
  }

  private countCase(alias: string, condition: string): string {
    return `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END) AS ${alias}`;
  }

  private number(row: RawRow | null | undefined, key: string): number {
    return Number(row?.[key] ?? 0);
  }

  private money(value: unknown): string {
    return Number(value ?? 0).toFixed(2);
  }

  private isoDate(value: unknown): string | null {
    if (!value) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return null;
  }
}
