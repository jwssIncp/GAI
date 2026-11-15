import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Zip, ZipPassThrough } from 'fflate';
import { DataSource, In, IsNull } from 'typeorm';
import * as XLSX from 'xlsx';
import {
  STORAGE_SIGNER,
  type StorageSigner,
} from '../../../../common/storage/storage-signer.port';
import { ProjectFieldAgentEntity } from '../../../field-agents/infrastructure/persistence/project-field-agent.entity';
import { FieldAgentEntity } from '../../../field-agents/infrastructure/persistence/field-agent.entity';
import { ExpenseAttachmentStatus } from '../../domain/enums/expense-attachment-status.enum';
import { BILLED_BATCH, COUNTED_EXPENSE } from '../../domain/expense.formulas';
import { ExpenseAttachmentEntity } from '../../infrastructure/persistence/expense-attachment.entity';
import { ExpenseInputDto } from '../dto/payments-expenses-inputs';
import { ExpenseRulesService } from './expense-rules.service';
import { PaymentsExpensesService } from './payments-expenses.service';
import type { PaymentsExpensesActorContext } from './payments-expenses-scope.service';
import { PaymentsExpensesScopeService } from './payments-expenses-scope.service';
import {
  type ExpenseBoardFilters,
  type ExpenseBoardItem,
  ProjectExpensesService,
} from './project-expenses.service';

const IMPORT_LIMIT = 1000;

/** Destino do ZIP: write resolve quando o destino aceita mais dados (contrapressão). */
export interface ZipSink {
  write(chunk: Uint8Array): Promise<void>;
  end(): Promise<void>;
}
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Texto de uma célula da planilha (texto, número, data ou vazia). */
const cellText = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : value instanceof Date
      ? value.toISOString()
      : typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ? String(value)
        : '';

const fold = (value: unknown) =>
  cellText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]/g, '');

/** Apelidos de cabeçalho aceitos na importação (doc 06 §3.2). */
const HEADER_ALIASES: Record<string, string[]> = {
  expense_date: ['data', 'datadadespesa', 'datadespesa', 'date', 'datacompra'],
  field_agent: ['tecnico', 'inventariante', 'colaborador', 'responsavel'],
  reason_code: ['motivo'],
  description: ['observacao', 'observacoes', 'obs', 'descricao'],
  expense_type: ['tipodedespesa', 'tipodespesa', 'tipo', 'reembolso'],
  amount: ['valor', 'total', 'valordadespesa', 'valordespesa'],
  deposited_amount: ['depositado', 'valordepositado', 'adiantamento'],
  payment_method: ['formadepagamento', 'formapagamento', 'forma', 'pagamento'],
  installment_count: [
    'parcelas',
    'nparcelas',
    'numerodeparcelas',
    'qtdparcelas',
  ],
  invoiced_payment_date: [
    'datadefaturamento',
    'datafaturamento',
    'datadepagamento',
    'datapagamento',
  ],
};
const TYPE_VALUES: Record<string, 'reimbursable' | 'non_reimbursable'> = {
  reembolsavel: 'reimbursable',
  reimbursable: 'reimbursable',
  naoreembolsavel: 'non_reimbursable',
  nonreimbursable: 'non_reimbursable',
};
const METHOD_VALUES: Record<string, 'cash' | 'installments' | 'invoiced'> = {
  avista: 'cash',
  cash: 'cash',
  aprazo: 'installments',
  parcelado: 'installments',
  installments: 'installments',
  faturado: 'invoiced',
  invoiced: 'invoiced',
};

export interface ImportRowValues {
  expense_date: string | null;
  field_agent_id: number | null;
  field_agent_name: string | null;
  reason_code: string | null;
  description: string | null;
  expense_type: 'reimbursable' | 'non_reimbursable' | null;
  amount: string | null;
  deposited_amount: string | null;
  payment_method: 'cash' | 'installments' | 'invoiced' | null;
  installment_count: number | null;
  invoiced_payment_date: string | null;
}

/** Dinheiro em texto brasileiro ou número da planilha → "1234.56" (sem ponto flutuante na saída). */
export function parseMoney(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return (Math.round(value * 100) / 100).toFixed(2);
  }
  let text = cellText(value).replace(/R\$|\s/g, '');
  if (!text) return null;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return `${Number(whole)}.${fraction.padEnd(2, '0')}`;
}

/** Data da planilha (data, número serial do Excel, dd/mm/aaaa ou aaaa-mm-dd) → AAAA-MM-DD. */
export function parseCivilDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  if (typeof value === 'number') {
    const ssf = XLSX.SSF as unknown as {
      parse_date_code(v: number): { y: number; m: number; d: number } | null;
    };
    const parsed = ssf.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = cellText(value).trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = br
    ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
    : /^(\d{4})-(\d{2})-(\d{2})$/.test(text)
      ? text
      : null;
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(iso)
    ? iso
    : null;
}

/** CSV para Excel em português: separador ";", BOM e todas as células entre aspas. */
export function toCsv(rows: Array<Array<string | number | null>>): string {
  const cell = (v: string | number | null) =>
    `"${cellText(v).replace(/"/g, '""')}"`;
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

const EXPORT_HEADER = [
  'Cód',
  'Data',
  'Técnico',
  'Motivo',
  'Observação',
  'Tipo de despesa',
  'Tipo do contrato',
  'Forma de pagamento',
  'Parcelas',
  'Data de faturamento',
  'Valor',
  'Valor depositado',
  'Saldo (depositado − valor)',
  'Status',
  'Lote de reembolso',
  'Data do lote',
  'Situação do lote',
  'Anexos',
];
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  paid: 'Paga',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
};
const br = (civil: string | null) =>
  civil ? civil.split('-').reverse().join('/') : '';

/**
 * Exportar (Excel/CSV), importar (Excel/CSV com apelidos de cabeçalho e
 * pré-visualização) e ZIP com comprovantes das despesas do projeto (doc 06 §3.2).
 */
@Injectable()
export class ExpenseTransferService {
  constructor(
    private readonly ds: DataSource,
    private readonly board: ProjectExpensesService,
    private readonly expenses: PaymentsExpensesService,
    private readonly rules: ExpenseRulesService,
    private readonly scope: PaymentsExpensesScopeService,
    @Inject(STORAGE_SIGNER) private readonly storage: StorageSigner,
  ) {}

  /** Linhas exportadas: o cabeçalho e cada linha têm sempre o mesmo número de colunas. */
  exportRows(items: ExpenseBoardItem[]): Array<Array<string | number | null>> {
    return [
      EXPORT_HEADER,
      ...items.map((i) => [
        i.sequence,
        br(i.expense_date),
        i.field_agent_name,
        i.reason_code ?? i.legacy_reason ?? '',
        i.description,
        i.expense_type_label,
        i.contract_type_label,
        i.payment_method_label,
        i.installments.length ? `${i.installments.length}x` : '',
        br(i.invoiced_payment_date),
        Number(i.amount),
        i.deposited_amount === null ? null : Number(i.deposited_amount),
        i.balance === null ? null : Number(i.balance),
        STATUS_LABEL[i.status] ?? i.status,
        i.batch ? `Lote ${i.batch.number}` : '',
        i.batch ? br(i.batch.batch_date) : '',
        i.batch ? (BILLED_BATCH(i.batch.status) ? 'Faturado' : 'Aberto') : '',
        i.attachments,
      ]),
    ];
  }

  async export(
    projectId: number,
    filters: ExpenseBoardFilters,
    format: 'xlsx' | 'csv',
    actor: PaymentsExpensesActorContext,
  ) {
    const data = await this.board.board(projectId, filters, actor);
    const rows = this.exportRows(data.items);
    const base = `despesas-${this.safe(data.project.name)}`;
    if (format === 'csv')
      return {
        fileName: `${base}.csv`,
        mimeType: 'text/csv; charset=utf-8',
        content: Buffer.from(toCsv(rows), 'utf8'),
      };
    return {
      fileName: `${base}.xlsx`,
      mimeType: XLSX_MIME,
      content: this.workbook(rows, data.items),
    };
  }

  private workbook(
    rows: Array<Array<string | number | null>>,
    items: ExpenseBoardItem[],
  ): Buffer {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const counted = items.filter((i) => COUNTED_EXPENSE(i.status));
    XLSX.utils.sheet_add_aoa(
      sheet,
      [
        [],
        [
          'Total',
          ...(Array(9).fill('') as string[]),
          counted.reduce((s, i) => s + Math.round(Number(i.amount) * 100), 0) /
            100,
        ],
      ],
      { origin: -1 },
    );
    XLSX.utils.book_append_sheet(book, sheet, 'Despesas');
    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ───────────── importação ─────────────

  async previewImport(
    projectId: number,
    file: { originalname: string; buffer: Buffer } | undefined,
    actor: PaymentsExpensesActorContext,
  ) {
    const project = await this.board.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    if (!file?.buffer?.length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Envie um arquivo Excel (.xlsx) ou CSV.',
      });
    let matrix: unknown[][];
    try {
      const book = XLSX.read(file.buffer, {
        type: 'buffer',
        cellDates: true,
        // CSV: sem inferência de tipo ("1.234,56" e "03/10/2026" ficam como texto e
        // são lidos no padrão brasileiro). Excel: células numéricas e datas reais.
        raw: true,
        codepage: 65001,
      });
      const sheet = book.Sheets[book.SheetNames[0]];
      matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      });
    } catch {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Não foi possível ler o arquivo. Use Excel (.xlsx) ou CSV.',
      });
    }
    if (matrix.length < 2)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A planilha precisa de um cabeçalho e ao menos uma linha.',
      });
    if (matrix.length - 1 > IMPORT_LIMIT)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Importe no máximo ${IMPORT_LIMIT} linhas por vez.`,
      });
    const header = matrix[0].map((h) => fold(h));
    const columns: Record<string, number> = {};
    const detected: Record<string, string> = {};
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      const index = header.findIndex((h) => aliases.includes(h));
      if (index >= 0) {
        columns[field] = index;
        detected[field] = cellText(matrix[0][index]);
      }
    }
    const missing = ['expense_date', 'amount'].filter((f) => !(f in columns));
    if (missing.length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Cabeçalho obrigatório não encontrado: ${missing
          .map((f) => (f === 'amount' ? 'Valor' : 'Data'))
          .join(', ')}.`,
      });
    const reasons = await this.rules.reasons(project.organizationId);
    const links = await this.ds.getRepository(ProjectFieldAgentEntity).find({
      where: { organizationId: project.organizationId, projectId },
    });
    const agents = links.length
      ? await this.ds.getRepository(FieldAgentEntity).find({
          where: {
            organizationId: project.organizationId,
            id: In(links.map((l) => Number(l.fieldAgentId))),
            deletedAt: IsNull(),
          },
        })
      : [];
    const agentByName = new Map(agents.map((a) => [fold(a.name), a]));
    const rows = matrix.slice(1).map((cells, index) => {
      const get = (field: string) =>
        field in columns ? cells[columns[field]] : null;
      const errors: string[] = [];
      const expenseDate = parseCivilDate(get('expense_date'));
      if (!expenseDate) errors.push('Data inválida.');
      const amount = parseMoney(get('amount'));
      if (!amount || Number(amount) <= 0) errors.push('Valor inválido.');
      const depositedRaw = get('deposited_amount');
      const deposited = parseMoney(depositedRaw);
      if (depositedRaw !== null && depositedRaw !== '' && deposited === null)
        errors.push('Valor depositado inválido.');
      const agentRaw = cellText(get('field_agent')).trim();
      const agent = agentRaw ? agentByName.get(fold(agentRaw)) : undefined;
      if (agentRaw && !agent && fold(agentRaw) !== 'despesasgerais')
        errors.push(`Técnico "${agentRaw}" não está vinculado ao projeto.`);
      const reasonRaw = cellText(get('reason_code')).trim();
      const reason = reasonRaw
        ? (reasons?.find((r) => fold(r) === fold(reasonRaw)) ??
          (reasons ? null : reasonRaw))
        : null;
      if (reasonRaw && !reason)
        errors.push(`Motivo "${reasonRaw}" fora da lista da organização.`);
      const typeRaw = fold(get('expense_type'));
      const type = typeRaw ? (TYPE_VALUES[typeRaw] ?? null) : null;
      if (typeRaw && !type)
        errors.push(
          'Tipo de despesa deve ser "Reembolsável" ou "Não reembolsável".',
        );
      const methodRaw = fold(get('payment_method'));
      const method = methodRaw ? (METHOD_VALUES[methodRaw] ?? null) : null;
      if (methodRaw && !method)
        errors.push(
          'Forma de pagamento deve ser À vista, A prazo ou Faturado.',
        );
      const countRaw = get('installment_count');
      const count =
        countRaw === null || countRaw === ''
          ? null
          : Number(cellText(countRaw).replace(/x$/i, ''));
      if (
        method === 'installments' &&
        (!count || !Number.isInteger(count) || count < 1)
      )
        errors.push('Informe o número de parcelas da despesa a prazo.');
      const invoiced = parseCivilDate(get('invoiced_payment_date'));
      if (method === 'invoiced' && !invoiced)
        errors.push('Informe a data de pagamento da despesa faturada.');
      const description = cellText(get('description')).trim() || null;
      const values: ImportRowValues = {
        expense_date: expenseDate,
        field_agent_id: agent ? Number(agent.id) : null,
        field_agent_name: agent?.name ?? null,
        reason_code: reason,
        description,
        expense_type: type,
        amount,
        deposited_amount: deposited,
        payment_method: method,
        installment_count: method === 'installments' ? count : null,
        invoiced_payment_date: method === 'invoiced' ? invoiced : null,
      };
      return { line: index + 2, values, errors };
    });
    return {
      file_name: file.originalname,
      columns: detected,
      ignored_columns: matrix[0]
        .map((h, i) => ({ h, i }))
        .filter(({ i }) => !Object.values(columns).includes(i))
        .map(({ h }) => cellText(h)),
      rows,
      valid: rows.filter((r) => !r.errors.length).length,
      invalid: rows.filter((r) => r.errors.length).length,
    };
  }

  /** Grava as linhas confirmadas, cada uma pelas mesmas regras do formulário. */
  async commitImport(
    projectId: number,
    rows: Array<{ line: number; values: ImportRowValues }>,
    actor: PaymentsExpensesActorContext,
  ) {
    await this.board.project(projectId, actor, true);
    await this.rules.assertFinanceOpen(projectId);
    if (!rows.length || rows.length > IMPORT_LIMIT)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Envie de 1 a ${IMPORT_LIMIT} linhas.`,
      });
    const results: Array<{
      line: number;
      ok: boolean;
      id?: number;
      message?: string;
    }> = [];
    for (const { line, values } of rows) {
      const dto = plainToInstance(ExpenseInputDto, {
        field_agent_id: values.field_agent_id,
        description:
          values.description || values.reason_code || 'Despesa importada',
        reason_code: values.reason_code,
        expense_date: values.expense_date,
        amount: values.amount,
        deposited_amount: values.deposited_amount,
        // Tipo vazio: vale o padrão do contrato (como no formulário).
        ...(values.expense_type ? { expense_type: values.expense_type } : {}),
        payment_method: values.payment_method,
        ...(values.installment_count
          ? { installment_count: values.installment_count }
          : {}),
        invoiced_payment_date: values.invoiced_payment_date,
        metadata: { imported: true, line },
      });
      const issues = await validate(dto);
      if (issues.length) {
        results.push({
          line,
          ok: false,
          message: issues
            .flatMap((i) => Object.values(i.constraints ?? {}))
            .join('; '),
        });
        continue;
      }
      try {
        const saved = await this.expenses.createExpense(projectId, dto, actor);
        results.push({ line, ok: true, id: saved.id });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        const body = error.getResponse() as { message?: string };
        results.push({
          line,
          ok: false,
          message: body.message ?? error.message,
        });
      }
    }
    return {
      done: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  // ───────────── ZIP com comprovantes ─────────────

  /**
   * ZIP do projeto (completo ou só reembolsáveis para o cliente), escolhendo o lote:
   * "all" (todas), "batched" (todas já em lote), "unbatched" (sem lote) ou o id do lote.
   * Só entram anexos com envio confirmado; pastas por técnico e "Despesas Gerais".
   */
  async prepareZip(
    projectId: number,
    options: { kind: 'full' | 'client'; batch: string },
    actor: PaymentsExpensesActorContext,
  ) {
    const data = await this.board.board(projectId, {}, actor);
    const batchId = /^\d+$/.test(options.batch) ? Number(options.batch) : null;
    if (!batchId && !['all', 'batched', 'unbatched'].includes(options.batch))
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Lote inválido.',
      });
    const items = data.items.filter(
      (i) =>
        COUNTED_EXPENSE(i.status) &&
        (options.kind === 'full' || i.expense_type === 'reimbursable') &&
        (options.batch === 'all' ||
          (options.batch === 'batched' && i.batch !== null) ||
          (options.batch === 'unbatched' && i.batch === null) ||
          (batchId !== null && i.batch?.id === batchId)),
    );
    if (!items.length)
      throw new ConflictException({
        code: 'EMPTY_EXPORT',
        message: 'Nenhuma despesa para exportar com essa escolha.',
      });
    const attachments = await this.ds
      .getRepository(ExpenseAttachmentEntity)
      .find({
        where: {
          expenseId: In(items.map((i) => i.id)),
          status: ExpenseAttachmentStatus.UPLOADED,
          deletedAt: IsNull(),
        },
        order: { id: 'ASC' },
      });
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      fileName: `despesas-${options.kind === 'client' ? 'cliente-reembolsavel' : 'completo'}-${this.safe(data.project.name)}.zip`,
      expenses: items.length,
      attachments: attachments.length,
      /** Escreve o ZIP no destino (a resposta HTTP) em streaming, um pedaço por vez. */
      write: (sink: ZipSink) =>
        this.writeZip(data.project.name, items, attachments, byId, sink),
    };
  }

  private async writeZip(
    projectName: string,
    items: ExpenseBoardItem[],
    attachments: ExpenseAttachmentEntity[],
    byId: Map<number, ExpenseBoardItem>,
    sink: ZipSink,
  ) {
    const used = new Set<string>();
    const unique = (path: string) => {
      let candidate = path;
      for (let n = 2; used.has(candidate.toLowerCase()); n++)
        candidate = path.replace(/(\.[^./]+)?$/, ` (${n})$1`);
      used.add(candidate.toLowerCase());
      return candidate;
    };
    // O fflate entrega os bytes de forma síncrona; a fila guarda só o pedaço
    // atual e é esvaziada (respeitando a contrapressão da resposta) antes de
    // ler o próximo pedaço do armazenamento. Nada de juntar comprovantes.
    const state: { failure: Error | null } = { failure: null };
    const queue: Uint8Array[] = [];
    const zip = new Zip((error, chunk) => {
      if (error) state.failure = error;
      else queue.push(chunk);
    });
    const flush = async () => {
      if (state.failure) throw state.failure;
      while (queue.length) await sink.write(queue.shift()!);
    };
    const add = async (
      path: string,
      parts: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
    ) => {
      const entry = new ZipPassThrough(unique(path));
      zip.add(entry);
      for await (const part of parts) {
        entry.push(part);
        await flush();
      }
      entry.push(new Uint8Array(0), true);
      await flush();
    };
    await add(`Lançamentos - ${this.safe(projectName)}.xlsx`, [
      this.workbook(this.exportRows(items), items),
    ]);
    for (const attachment of attachments) {
      const item = byId.get(Number(attachment.expenseId))!;
      const folder =
        item.field_agent_id === null
          ? 'Despesas Gerais'
          : `Comprovantes por técnico/${this.safe(item.field_agent_name)}`;
      const parts = await this.storage.openObject({
        bucket: attachment.bucket,
        path: attachment.path,
        mimeType: attachment.mimeType,
        sizeBytes: Number(attachment.sizeBytes),
        checksum: attachment.checksum,
        expiresInSeconds: this.scope.presignedUrlTtlSeconds(),
      });
      await add(
        `${folder}/${item.sequence ?? item.id}-${this.safe(attachment.originalName)}`,
        parts,
      );
    }
    zip.end();
    await flush();
    await sink.end();
  }

  private safe(name: string) {
    return (
      name
        .replace(/[\\/:*?"<>|]/g, '-')
        .split('')
        .filter((c) => c.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || 'sem-nome'
    );
  }
}
