import { applyFormats, type CellFormat } from './export-cell-format';
import { Injectable } from '@nestjs/common';
import {
  ValuationBatchRow,
  ValuationBatch,
} from '../../../inventory-operations/infrastructure/persistence/valuation-batch.entity';
import {
  DataSource,
  EntityManager,
  In,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { ReconciliationStatus } from '../../../inventory-operations/domain/inventory-operation.enums';
import {
  AssetValuationEntity,
  InventoryReconciliationEntity,
} from '../../../inventory-operations/infrastructure/persistence/inventory-operation.entity';
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

/** Rótulos e abas da exportação da conciliação, no vocabulário do sistema anterior. */
const RECONCILIATION_LABELS: Record<string, string> = {
  [ReconciliationStatus.MATCHED]: 'Conciliado',
  [ReconciliationStatus.PLATE_DIVERGENCE]: 'Divergência de placa',
  [ReconciliationStatus.PHYSICAL_SURPLUS]: 'Sobra física',
  [ReconciliationStatus.ACCOUNTING_SURPLUS]: 'Sobra contábil',
  [ReconciliationStatus.DUPLICATE]: 'Duplicidade',
};
const RECONCILIATION_SHEET_ORDER = [
  ReconciliationStatus.MATCHED,
  ReconciliationStatus.PLATE_DIVERGENCE,
  ReconciliationStatus.PHYSICAL_SURPLUS,
  ReconciliationStatus.ACCOUNTING_SURPLUS,
  ReconciliationStatus.DUPLICATE,
];
const RECONCILIATION_SHEETS: Record<ReconciliationStatus, string> = {
  [ReconciliationStatus.MATCHED]: 'Conciliados',
  [ReconciliationStatus.PLATE_DIVERGENCE]: 'Divergência de placa',
  [ReconciliationStatus.PHYSICAL_SURPLUS]: 'Sobra física',
  [ReconciliationStatus.ACCOUNTING_SURPLUS]: 'Só na contabilidade',
  [ReconciliationStatus.DUPLICATE]: 'Duplicidades',
};

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
        case ExportJobType.DRE_XLSX:
        case ExportJobType.FINANCE_XLSX: {
          const source = await manager
            .getRepository(ExportJobEntity)
            .createQueryBuilder('j')
            .addSelect('j.financePayload')
            .where('j.id=:id AND j.organizationId=:org', {
              id: job.id,
              org: job.organizationId,
            })
            .getOneOrFail();
          if (!source.financePayload)
            throw new Error('Missing validated finance snapshot');
          for (const sheet of source.financePayload.sheets) {
            if (sheet.rows.length > this.maxRows())
              throw new ExportRowLimitExceededError(this.maxRows());
            this.addSheet(
              workbook,
              sheet.name,
              sheet.headers,
              sheet.rows,
              sheet.formats,
            );
          }
          break;
        }
        case ExportJobType.VALUATION_BATCHES_XLSX: {
          const rows = await manager
            .getRepository(ValuationBatchRow)
            .createQueryBuilder('row')
            .innerJoin(
              ValuationBatch,
              'batch',
              'batch.id = row.batchId AND batch.projectId = row.projectId AND batch.organizationId = row.organizationId',
            )
            .where(
              'row.projectId = :projectId AND row.organizationId = :organizationId AND batch.status = :status',
              {
                projectId: job.projectId,
                organizationId: job.organizationId,
                status: 'applied',
              },
            )
            .orderBy('row.batchId', 'DESC')
            .addOrderBy('row.inventoryItemId', 'ASC')
            .take(this.maxRows() + 1)
            .getMany();
          if (rows.length > this.maxRows())
            throw new ExportRowLimitExceededError(this.maxRows());
          this.addSheet(
            workbook,
            'Avaliações em lote',
            [
              'Operação ID',
              'Item ID',
              'Placa antiga',
              'Placa nova',
              'Descrição',
              'Fonte',
              'Data',
              'Valor novo',
              'Valor usado',
              'Observações',
              'Avaliação ID',
              'Resultado',
            ],
            rows.map((row) => [
              row.batchId,
              row.inventoryItemId,
              row.snapshot.old_plate,
              row.snapshot.new_plate,
              row.snapshot.description,
              row.proposed.source,
              row.proposed.valuationDate,
              row.proposed.newValue,
              row.proposed.usedValue,
              row.proposed.notes,
              row.valuationId,
              'Aprovado',
            ]),
          );
          break;
        }
        case ExportJobType.INVENTORY_ITEMS_XLSX:
          this.addInventorySheet(
            workbook,
            await this.loadInventoryItems(manager, job, false),
          );
          break;
        case ExportJobType.INVENTORY_ITEMS_VALUATION_XLSX: {
          const items = await this.loadInventoryItems(manager, job, false);
          this.addInventorySheet(
            workbook,
            items,
            await this.loadLatestValuations(manager, job),
          );
          break;
        }
        case ExportJobType.RECONCILIATION_XLSX:
          await this.addReconciliation(manager, workbook, job);
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
        'Organização ID',
        'Empresa ID',
        'Nome',
        'Descrição',
        'Status',
        'Data inicial',
        'Data final',
        'Finalizado em',
        'Configurações',
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

  /** Avaliação mais recente de cada item (maior data; empate pelo maior ID), como no laudo. */
  private async loadLatestValuations(
    manager: EntityManager,
    job: ExportJobEntity,
  ): Promise<Map<number, AssetValuationEntity>> {
    const rows = await manager.getRepository(AssetValuationEntity).find({
      where: {
        projectId: job.projectId!,
        organizationId: job.organizationId,
      },
      order: { valuationDate: 'ASC', id: 'ASC' },
    });
    const latest = new Map<number, AssetValuationEntity>();
    for (const row of rows) latest.set(Number(row.inventoryItemId), row);
    return latest;
  }

  /**
   * Conciliação da última execução do projeto, no formato do sistema anterior: uma aba por
   * situação (Conciliados, Divergência de placa, Sobra física, Só na contabilidade,
   * Duplicidades) e um Resumo com quantidade e valor residual.
   */
  private async addReconciliation(
    manager: EntityManager,
    workbook: XLSX.WorkBook,
    job: ExportJobEntity,
  ): Promise<void> {
    const latest = await manager
      .getRepository(InventoryReconciliationEntity)
      .findOne({
        where: {
          projectId: job.projectId!,
          organizationId: job.organizationId,
        },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
    const rows = latest
      ? await manager.getRepository(InventoryReconciliationEntity).find({
          where: {
            projectId: job.projectId!,
            organizationId: job.organizationId,
            sessionId: latest.sessionId,
            runNumber: latest.runNumber,
          },
          order: { id: 'ASC' },
          take: this.maxRows() + 1,
        })
      : [];
    if (rows.length > this.maxRows())
      throw new ExportRowLimitExceededError(this.maxRows());
    const ids = (key: 'inventoryItemId' | 'accountingItemId') => [
      ...new Set(
        rows.flatMap((r) => (r[key] === null ? [] : [Number(r[key])])),
      ),
    ];
    const physical = new Map<number, InventoryItemEntity>();
    for (const chunk of this.chunks(ids('inventoryItemId')))
      for (const item of await manager
        .getRepository(InventoryItemEntity)
        .find({ where: { id: In(chunk) }, withDeleted: true }))
        physical.set(Number(item.id), item);
    const accounting = new Map<number, InventoryAccountingItemEntity>();
    for (const chunk of this.chunks(ids('accountingItemId')))
      for (const item of await manager
        .getRepository(InventoryAccountingItemEntity)
        .find({ where: { id: In(chunk) }, withDeleted: true }))
        accounting.set(Number(item.id), item);

    const headers = [
      'Situação',
      'Placa física',
      'Placa contábil',
      'Descrição física',
      'Localização física',
      'Valor usado (inventário)',
      'Descrição contábil',
      'Localização contábil',
      'Código base',
      'Código investor',
      'Valor de aquisição',
      'Valor residual',
      'Classificação da sobra',
      'Item físico ID',
      'Item contábil ID',
    ];
    const formats: Array<CellFormat | null> = headers.map((h) =>
      h.startsWith('Valor') ? 'money' : null,
    );
    const line = (r: InventoryReconciliationEntity): CellValue[] => {
      const p =
        r.inventoryItemId === null
          ? undefined
          : physical.get(Number(r.inventoryItemId));
      const a =
        r.accountingItemId === null
          ? undefined
          : accounting.get(Number(r.accountingItemId));
      return [
        RECONCILIATION_LABELS[r.status] ?? r.status,
        r.physicalPlate ?? p?.oldPlate ?? p?.newPlate ?? null,
        r.accountingPlate ?? a?.plate ?? null,
        p?.description ?? null,
        p?.locationText ?? null,
        this.number(p?.usedValue ?? null),
        a?.description ?? null,
        a?.location ?? null,
        a?.baseCode ?? null,
        a?.investorCode ?? null,
        this.number(a?.acquisitionValue ?? null),
        this.number(a?.residualValue ?? null),
        a?.surplusClassification ?? null,
        r.inventoryItemId === null ? null : Number(r.inventoryItemId),
        r.accountingItemId === null ? null : Number(r.accountingItemId),
      ];
    };
    const summary: CellValue[][] = [];
    for (const status of RECONCILIATION_SHEET_ORDER) {
      const group = rows.filter((r) => r.status === status);
      this.addSheet(
        workbook,
        RECONCILIATION_SHEETS[status],
        headers,
        group.map(line),
        formats,
      );
      const residual = group.reduce((sum, r) => {
        const value =
          r.accountingItemId === null
            ? null
            : accounting.get(Number(r.accountingItemId))?.residualValue;
        return value == null ? sum : sum + Math.round(Number(value) * 100);
      }, 0);
      summary.push([
        RECONCILIATION_LABELS[status],
        group.length,
        residual / 100,
      ]);
    }
    summary.push(['Total', rows.length, null]);
    this.addSheet(
      workbook,
      'Resumo',
      ['Situação', 'Quantidade', 'Valor residual (linhas contábeis)'],
      latest
        ? summary
        : [['Nenhuma conciliação executada neste projeto', 0, null]],
      [null, 'number', 'money'],
    );
  }

  private chunks(values: number[], size = 500): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < values.length; i += size)
      out.push(values.slice(i, i + size));
    return out;
  }

  private addInventorySheet(
    workbook: XLSX.WorkBook,
    items: InventoryItemEntity[],
    valuations?: Map<number, AssetValuationEntity>,
  ): void {
    this.addSheet(
      workbook,
      'Itens inventariados',
      [
        'ID',
        'Organização ID',
        'Projeto ID',
        'Item externo ID',
        'Sequencia',
        'Placa antiga',
        'Placa nova',
        'Unidade',
        'Endereço',
        'Localização',
        'Descrição',
        'Marca',
        'Modelo',
        'Número de série',
        'Capacidade',
        'Ano',
        'Observações',
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
        ...(valuations
          ? [
              'Avaliação: fonte de consulta',
              'Avaliação: data',
              'Avaliação: valor novo',
              'Avaliação: valor usado',
              'Avaliação ID',
            ]
          : []),
      ],
      items.map((item) => [
        ...this.inventoryCells(item),
        ...(valuations
          ? this.valuationCells(valuations.get(Number(item.id)))
          : []),
      ]),
    );
  }

  private valuationCells(v: AssetValuationEntity | undefined): CellValue[] {
    if (!v) return [null, null, null, null, null];
    return [
      v.source,
      this.date(v.valuationDate),
      this.number(v.newValue),
      this.number(v.usedValue),
      Number(v.id),
    ];
  }

  private inventoryCells(item: InventoryItemEntity): CellValue[] {
    return [
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
    ];
  }

  private addAccountingSheet(
    workbook: XLSX.WorkBook,
    items: InventoryAccountingItemEntity[],
  ): void {
    this.addSheet(
      workbook,
      'Base contábil',
      [
        'ID',
        'Organização ID',
        'Projeto ID',
        'Placa',
        'Descrição',
        'Descrição conta contábil',
        'Localização',
        'Data de aquisição',
        'Valor de aquisição',
        'Valor residual',
        'Código base',
        'Status',
        'Classificação da sobra',
        'Código investidor',
        'Nota 1',
        'Nota 2',
        'Nova placa inventário',
        'Descrição inventário',
        'Localização inventário',
        'Metadados',
        'Importado por ID',
        'Lote de importação ID',
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
        this.number(item.residualValue),
        item.baseCode,
        item.status,
        item.surplusClassification ?? null,
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
      'Pendências',
      [
        'ID',
        'Organização ID',
        'Projeto ID',
        'Item inventário ID',
        'Item contábil ID',
        'Tipo',
        'Status',
        'Severidade',
        'Titulo',
        'Descrição',
        'Valor anterior',
        'Valor novo',
        'Notas de resolução',
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
        'Organização ID',
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
        'Observações',
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
        'Organização ID',
        'Projeto ID',
        'Inventariante ID',
        'Descrição',
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
    formats?: Array<CellFormat | null>,
  ): void {
    const NUMERIC: Array<CellFormat | null | undefined> = [
      'money',
      'number',
      'percent',
    ];
    // Coluna numérica: texto numérico vira número (assim "-123.45" não ganha o
    // apóstrofo do saneador anti-fórmula e o Excel soma a coluna).
    const sanitizedRows = rows.map((row) =>
      row.map((value, index) =>
        NUMERIC.includes(formats?.[index]) &&
        typeof value === 'string' &&
        /^-?\d+(\.\d+)?$/.test(value)
          ? Number(value)
          : this.cell(value),
      ),
    );
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...sanitizedRows]);
    applyFormats(sheet, sanitizedRows.length, formats);
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
