import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import * as XLSX from 'xlsx';
import { InventoryAccountingItemEntity } from '../../../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemEntity } from '../../../inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryPendingIssueEntity } from '../../../inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import { ExpenseEntity } from '../../../payments-expenses/infrastructure/persistence/expense.entity';
import { FieldAgentPaymentEntity } from '../../../payments-expenses/infrastructure/persistence/field-agent-payment.entity';
import { ProjectEntity } from '../../../projects/infrastructure/persistence/project.entity';
import { ExportJobType } from '../../domain/enums/export-job-type.enum';
import { ExportJobEntity } from '../../infrastructure/persistence/export-job.entity';

type CellValue = string | number | boolean | null;

export class ExportRowLimitExceededError extends Error {
  constructor(limit: number) {
    super(`Export exceeds the configured row limit of ${limit}`);
    this.name = ExportRowLimitExceededError.name;
  }
}

@Injectable()
export class ExportWorkbookBuilderService {
  constructor(private readonly dataSource: DataSource) {}

  async build(job: ExportJobEntity): Promise<Buffer> {
    return this.dataSource.transaction(async (manager) => {
      const workbook = XLSX.utils.book_new();

      switch (job.type) {
        case ExportJobType.INVENTORY_ITEMS_XLSX:
          this.addInventorySheet(
            workbook,
            await this.loadInventoryItems(manager, job, false),
          );
          break;
        case ExportJobType.INVENTORY_ACCOUNTING_ITEMS_XLSX:
          this.addAccountingSheet(
            workbook,
            await this.loadAccountingItems(manager, job, false),
          );
          break;
        case ExportJobType.PENDING_ISSUES_XLSX:
          this.addPendingIssuesSheet(
            workbook,
            await this.loadPendingIssues(manager, job, false),
          );
          break;
        case ExportJobType.PAYMENTS_XLSX:
          this.addPaymentsSheet(
            workbook,
            await this.loadPayments(manager, job, false),
          );
          break;
        case ExportJobType.EXPENSES_XLSX:
          this.addExpensesSheet(
            workbook,
            await this.loadExpenses(manager, job, false),
          );
          break;
        case ExportJobType.PROJECT_BACKUP_XLSX:
          await this.addProjectBackup(manager, workbook, job);
          break;
        default:
          throw new Error(`Unsupported export job type: ${String(job.type)}`);
      }

      return Buffer.from(
        XLSX.write(workbook, {
          type: 'buffer',
          bookType: 'xlsx',
          compression: true,
        }) as Buffer,
      );
    });
  }

  private async addProjectBackup(
    manager: EntityManager,
    workbook: XLSX.WorkBook,
    job: ExportJobEntity,
  ): Promise<void> {
    // Queries are intentionally serialized on one transaction/connection so
    // the consolidated report observes one database snapshot and one shared
    // row budget.
    const project = await this.loadProject(manager, job);
    let remainingRows = this.maxRows();
    const inventory = await this.loadInventoryItems(
      manager,
      job,
      true,
      remainingRows,
    );
    remainingRows -= inventory.length;
    const accounting = await this.loadAccountingItems(
      manager,
      job,
      true,
      remainingRows,
    );
    remainingRows -= accounting.length;
    const issues = await this.loadPendingIssues(
      manager,
      job,
      true,
      remainingRows,
    );
    remainingRows -= issues.length;
    const payments = await this.loadPayments(manager, job, true, remainingRows);
    remainingRows -= payments.length;
    const expenses = await this.loadExpenses(manager, job, true, remainingRows);

    this.addSheet(
      workbook,
      'Projeto',
      [
        'ID',
        'Organizacao ID',
        'Empresa ID',
        'Nome',
        'Descricao',
        'Status',
        'Data inicial',
        'Data final',
        'Finalizado em',
        'Configuracoes',
        'Metadados',
        'Criado por ID',
        'Atualizado por ID',
        'Criado em',
        'Atualizado em',
        'Excluido em',
      ],
      [
        [
          project.id,
          project.organizationId,
          project.companyId,
          project.name,
          project.description,
          project.status,
          this.date(project.startDate),
          this.date(project.endDate),
          this.date(project.finishedAt),
          this.json(project.settings),
          this.json(project.metadata),
          project.createdById,
          project.updatedById,
          this.date(project.createdAt),
          this.date(project.updatedAt),
          this.date(project.deletedAt),
        ],
      ],
    );
    this.addInventorySheet(workbook, inventory);
    this.addAccountingSheet(workbook, accounting);
    this.addPendingIssuesSheet(workbook, issues);
    this.addPaymentsSheet(workbook, payments);
    this.addExpensesSheet(workbook, expenses);
  }

  private addInventorySheet(
    workbook: XLSX.WorkBook,
    items: InventoryItemEntity[],
  ): void {
    this.addSheet(
      workbook,
      'Itens inventariados',
      [
        'ID',
        'Organizacao ID',
        'Projeto ID',
        'Item externo ID',
        'Sequencia',
        'Placa antiga',
        'Placa nova',
        'Unidade',
        'Endereco',
        'Localizacao',
        'Descricao',
        'Marca',
        'Modelo',
        'Numero de serie',
        'Capacidade',
        'Ano',
        'Observacoes',
        'Origem',
        'Valor usado',
        'Valor novo',
        'Status',
        'Metadados',
        'Criado por ID',
        'Atualizado por ID',
        'Criado em',
        'Atualizado em',
        'Excluido em',
      ],
      items.map((item) => [
        item.id,
        item.organizationId,
        item.projectId,
        item.externalItemId,
        item.sequence,
        item.oldPlate,
        item.newPlate,
        item.unitText,
        item.addressText,
        item.locationText,
        item.description,
        item.brand,
        item.model,
        item.serialNumber,
        item.capacity,
        item.year,
        item.notes,
        item.source,
        this.number(item.usedValue),
        this.number(item.newValue),
        item.status,
        this.json(item.metadata),
        item.createdById,
        item.updatedById,
        this.date(item.createdAt),
        this.date(item.updatedAt),
        this.date(item.deletedAt),
      ]),
    );
  }

  private addAccountingSheet(
    workbook: XLSX.WorkBook,
    items: InventoryAccountingItemEntity[],
  ): void {
    this.addSheet(
      workbook,
      'Base contabil',
      [
        'ID',
        'Organizacao ID',
        'Projeto ID',
        'Placa',
        'Descricao',
        'Descricao conta contabil',
        'Localizacao',
        'Data de aquisicao',
        'Valor de aquisicao',
        'Codigo base',
        'Status',
        'Codigo investidor',
        'Nota 1',
        'Nota 2',
        'Nova placa inventario',
        'Descricao inventario',
        'Localizacao inventario',
        'Metadados',
        'Importado por ID',
        'Lote de importacao ID',
        'Criado em',
        'Atualizado em',
        'Excluido em',
      ],
      items.map((item) => [
        item.id,
        item.organizationId,
        item.projectId,
        item.plate,
        item.description,
        item.accountingAccountDescription,
        item.location,
        this.date(item.acquisitionDate),
        this.number(item.acquisitionValue),
        item.baseCode,
        item.status,
        item.investorCode,
        item.note1,
        item.note2,
        item.newInventoryPlate,
        item.inventoryDescription,
        item.inventoryLocation,
        this.json(item.metadata),
        item.importedById,
        item.importBatchId,
        this.date(item.createdAt),
        this.date(item.updatedAt),
        this.date(item.deletedAt),
      ]),
    );
  }

  private addPendingIssuesSheet(
    workbook: XLSX.WorkBook,
    issues: InventoryPendingIssueEntity[],
  ): void {
    this.addSheet(
      workbook,
      'Pendencias',
      [
        'ID',
        'Organizacao ID',
        'Projeto ID',
        'Item inventario ID',
        'Item contabil ID',
        'Tipo',
        'Status',
        'Severidade',
        'Titulo',
        'Descricao',
        'Valor anterior',
        'Valor novo',
        'Notas de resolucao',
        'Resolvido por ID',
        'Resolvido em',
        'Ignorado por ID',
        'Ignorado em',
        'Criado por ID',
        'Atualizado por ID',
        'Metadados',
        'Criado em',
        'Atualizado em',
        'Excluido em',
      ],
      issues.map((issue) => [
        issue.id,
        issue.organizationId,
        issue.projectId,
        issue.inventoryItemId,
        issue.accountingItemId,
        issue.type,
        issue.status,
        issue.severity,
        issue.title,
        issue.description,
        this.json(issue.oldValue),
        this.json(issue.newValue),
        issue.resolutionNotes,
        issue.resolvedById,
        this.date(issue.resolvedAt),
        issue.ignoredById,
        this.date(issue.ignoredAt),
        issue.createdById,
        issue.updatedById,
        this.json(issue.metadata),
        this.date(issue.createdAt),
        this.date(issue.updatedAt),
        this.date(issue.deletedAt),
      ]),
    );
  }

  private addPaymentsSheet(
    workbook: XLSX.WorkBook,
    payments: FieldAgentPaymentEntity[],
  ): void {
    this.addSheet(
      workbook,
      'Pagamentos',
      [
        'ID',
        'Organizacao ID',
        'Projeto ID',
        'Inventariante ID',
        'UF',
        'Data inicial',
        'Data final',
        'Data pagamento',
        'Dias',
        'Diaria',
        'Adicional',
        'Total diarias',
        'Desconto',
        'Valor final',
        'Status',
        'Observacoes',
        'Aprovado por ID',
        'Aprovado em',
        'Pago por ID',
        'Pago em',
        'Criado por ID',
        'Atualizado por ID',
        'Metadados',
        'Criado em',
        'Atualizado em',
        'Excluido em',
      ],
      payments.map((payment) => [
        payment.id,
        payment.organizationId,
        payment.projectId,
        payment.fieldAgentId,
        payment.state,
        this.date(payment.startDate),
        this.date(payment.endDate),
        this.date(payment.paymentDate),
        payment.days,
        this.number(payment.dailyRate),
        this.number(payment.additionalAmount),
        this.number(payment.dailyTotal),
        this.number(payment.discountAmount),
        this.number(payment.finalAmount),
        payment.status,
        payment.notes,
        payment.approvedById,
        this.date(payment.approvedAt),
        payment.paidById,
        this.date(payment.paidAt),
        payment.createdById,
        payment.updatedById,
        this.json(payment.metadata),
        this.date(payment.createdAt),
        this.date(payment.updatedAt),
        this.date(payment.deletedAt),
      ]),
    );
  }

  private addExpensesSheet(
    workbook: XLSX.WorkBook,
    expenses: ExpenseEntity[],
  ): void {
    this.addSheet(
      workbook,
      'Despesas',
      [
        'ID',
        'Organizacao ID',
        'Projeto ID',
        'Inventariante ID',
        'Descricao',
        'Motivo',
        'Data despesa',
        'Valor',
        'Status',
        'Aprovado por ID',
        'Aprovado em',
        'Rejeitado por ID',
        'Rejeitado em',
        'Pago por ID',
        'Pago em',
        'Criado por ID',
        'Atualizado por ID',
        'Metadados',
        'Criado em',
        'Atualizado em',
        'Excluido em',
      ],
      expenses.map((expense) => [
        expense.id,
        expense.organizationId,
        expense.projectId,
        expense.fieldAgentId,
        expense.description,
        expense.reason,
        this.date(expense.expenseDate),
        this.number(expense.amount),
        expense.status,
        expense.approvedById,
        this.date(expense.approvedAt),
        expense.rejectedById,
        this.date(expense.rejectedAt),
        expense.paidById,
        this.date(expense.paidAt),
        expense.createdById,
        expense.updatedById,
        this.json(expense.metadata),
        this.date(expense.createdAt),
        this.date(expense.updatedAt),
        this.date(expense.deletedAt),
      ]),
    );
  }

  private addSheet(
    workbook: XLSX.WorkBook,
    name: string,
    headers: string[],
    rows: CellValue[][],
  ): void {
    const sanitizedRows = rows.map((row) =>
      row.map((value) => this.cell(value)),
    );
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...sanitizedRows]);
    sheet['!cols'] = headers.map((header, index) => ({
      wch: Math.min(
        60,
        Math.max(
          header.length + 2,
          ...sanitizedRows
            .slice(0, 200)
            .map((row) => String(row[index] ?? '').length + 2),
        ),
      ),
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  private loadProject(
    manager: EntityManager,
    job: ExportJobEntity,
  ): Promise<ProjectEntity> {
    return manager
      .getRepository(ProjectEntity)
      .createQueryBuilder('project')
      .withDeleted()
      .where('project.id = :projectId', { projectId: job.projectId })
      .andWhere('project.organization_id = :organizationId', {
        organizationId: job.organizationId,
      })
      .getOneOrFail();
  }

  private loadInventoryItems(
    manager: EntityManager,
    job: ExportJobEntity,
    includeDeleted: boolean,
    rowLimit = this.maxRows(),
  ): Promise<InventoryItemEntity[]> {
    const query = manager
      .getRepository(InventoryItemEntity)
      .createQueryBuilder('item')
      .where('item.project_id = :projectId', { projectId: job.projectId })
      .andWhere('item.organization_id = :organizationId', {
        organizationId: job.organizationId,
      })
      .orderBy('item.id', 'ASC');
    return this.loadWithLimit(
      this.withDeleted(query, includeDeleted),
      rowLimit,
    );
  }

  private loadAccountingItems(
    manager: EntityManager,
    job: ExportJobEntity,
    includeDeleted: boolean,
    rowLimit = this.maxRows(),
  ): Promise<InventoryAccountingItemEntity[]> {
    const query = manager
      .getRepository(InventoryAccountingItemEntity)
      .createQueryBuilder('item')
      .where('item.project_id = :projectId', { projectId: job.projectId })
      .andWhere('item.organization_id = :organizationId', {
        organizationId: job.organizationId,
      })
      .orderBy('item.id', 'ASC');
    return this.loadWithLimit(
      this.withDeleted(query, includeDeleted),
      rowLimit,
    );
  }

  private loadPendingIssues(
    manager: EntityManager,
    job: ExportJobEntity,
    includeDeleted: boolean,
    rowLimit = this.maxRows(),
  ): Promise<InventoryPendingIssueEntity[]> {
    const query = manager
      .getRepository(InventoryPendingIssueEntity)
      .createQueryBuilder('issue')
      .where('issue.project_id = :projectId', { projectId: job.projectId })
      .andWhere('issue.organization_id = :organizationId', {
        organizationId: job.organizationId,
      })
      .orderBy('issue.id', 'ASC');
    return this.loadWithLimit(
      this.withDeleted(query, includeDeleted),
      rowLimit,
    );
  }

  private loadPayments(
    manager: EntityManager,
    job: ExportJobEntity,
    includeDeleted: boolean,
    rowLimit = this.maxRows(),
  ): Promise<FieldAgentPaymentEntity[]> {
    const query = manager
      .getRepository(FieldAgentPaymentEntity)
      .createQueryBuilder('payment')
      .where('payment.project_id = :projectId', { projectId: job.projectId })
      .andWhere('payment.organization_id = :organizationId', {
        organizationId: job.organizationId,
      })
      .orderBy('payment.id', 'ASC');
    return this.loadWithLimit(
      this.withDeleted(query, includeDeleted),
      rowLimit,
    );
  }

  private loadExpenses(
    manager: EntityManager,
    job: ExportJobEntity,
    includeDeleted: boolean,
    rowLimit = this.maxRows(),
  ): Promise<ExpenseEntity[]> {
    const query = manager
      .getRepository(ExpenseEntity)
      .createQueryBuilder('expense')
      .where('expense.project_id = :projectId', { projectId: job.projectId })
      .andWhere('expense.organization_id = :organizationId', {
        organizationId: job.organizationId,
      })
      .orderBy('expense.id', 'ASC');
    return this.loadWithLimit(
      this.withDeleted(query, includeDeleted),
      rowLimit,
    );
  }

  private async loadWithLimit<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    rowLimit: number,
  ): Promise<T[]> {
    const rows = await query.take(rowLimit + 1).getMany();
    if (rows.length > rowLimit) {
      throw new ExportRowLimitExceededError(this.maxRows());
    }
    return rows;
  }

  private withDeleted<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    includeDeleted: boolean,
  ): SelectQueryBuilder<T> {
    return includeDeleted ? query.withDeleted() : query;
  }

  private maxRows(): number {
    const parsed = Number(process.env.EXPORT_JOB_MAX_ROWS);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.max(1, Math.floor(parsed))
      : 100_000;
  }

  private cell(value: CellValue): CellValue {
    if (typeof value !== 'string') return value;
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }

  private number(value: string | number | null): number | null {
    if (value === null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private date(value: Date | string | null): string | null {
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private json(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return JSON.stringify(value);
  }
}
