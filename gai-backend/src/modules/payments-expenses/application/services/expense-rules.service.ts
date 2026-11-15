import { assertDreMonthsOpen } from '../../../managerial-dre/dre-closed-period';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DataSource, In, IsNull, Like } from 'typeorm';
import { ExpenseEntity } from '../../infrastructure/persistence/expense.entity';
import { CashOutflowSettlementEntity } from '../../../receivables/cash-flow-parity.entities';
import { ContractEntity } from '../../../contracts/contract.entity';
import { ExpenseInstallmentEntity } from '../../../expense-accountabilities/expense-accountability.entity';
import { FinanceSettingsService } from '../../../finance-settings/finance-settings.service';
import { DreEntry, DrePeriod } from '../../../managerial-dre/dre.entity';
import type { ExpenseProps } from '../../domain/entities/expense';
import {
  BILLED_BATCH,
  defaultExpenseType,
  ExpenseRuleError,
  installmentPlan,
  type InstallmentLine,
  validateInstallments,
} from '../../domain/expense.formulas';
import { RemunerationRuleError } from '../../domain/remuneration.formulas';
import {
  ExpenseReimbursementBatchEntity,
  ProjectFinancialClosureEntity,
} from '../../infrastructure/persistence/expense-parity.entities';
import type { ExpenseInputDto } from '../dto/payments-expenses-inputs';

/** Campos da etapa 4 resolvidos para gravar na despesa. */
export interface ExpenseClassification {
  fields: Partial<
    Pick<
      ExpenseProps,
      | 'expenseType'
      | 'reasonCode'
      | 'paymentMethod'
      | 'invoicedPaymentDate'
      | 'depositedAmount'
    >
  >;
  /** lista = grava estas parcelas; null = remove; undefined = mantém as atuais. */
  installments: InstallmentLine[] | null | undefined;
}

const civil = (value: Date | string | null | undefined) =>
  value == null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);

/**
 * Regras compartilhadas das despesas (etapa 4): tipo padrão pelo contrato,
 * motivo da lista da organização, forma de pagamento e parcelas (D-E),
 * financeiro do projeto concluído e competências fechadas da DRE.
 */
@Injectable()
export class ExpenseRulesService {
  constructor(
    private readonly ds: DataSource,
    private readonly settings: FinanceSettingsService,
  ) {}

  /** Conclusão vigente do financeiro do projeto (a mais recente sem reabertura). */
  async closure(projectId: number) {
    return this.ds.getRepository(ProjectFinancialClosureEntity).findOne({
      where: { projectId, reopenedAt: IsNull() },
      order: { id: 'DESC' },
    });
  }

  async assertFinanceOpen(projectId: number): Promise<void> {
    if (await this.closure(projectId))
      throw new ConflictException({
        code: 'PROJECT_FINANCE_CLOSED',
        message:
          'O financeiro deste projeto está concluído. Reabra-o para alterar despesas, adiantamentos ou lotes.',
      });
  }

  /** Tipo padrão das despesas novas: "despesas por conta de" dos contratos vigentes. */
  async defaultType(organizationId: number, projectId: number) {
    const contracts = await this.ds
      .getRepository(ContractEntity)
      .find({ where: { organizationId, projectId } });
    return defaultExpenseType(
      contracts
        .filter((c) => !['cancelled', 'archived'].includes(c.data.status))
        .map((c) => c.data.expenses_paid_by),
    );
  }

  /** Motivos da lista vigente; sem parâmetros, a lista não restringe (despesas antigas). */
  async reasons(organizationId: number): Promise<string[] | null> {
    try {
      return (await this.settings.valuesAt(organizationId)).expense_reasons;
    } catch {
      return null;
    }
  }

  /** Competências fechadas da DRE em que a despesa foi classificada. */
  async closedDreMonths(organizationId: number, expenseId: number) {
    const entry = await this.ds.getRepository(DreEntry).findOne({
      where: { organizationId, sourceKey: `expense:${expenseId}` },
    });
    const months = [
      ...new Set((entry?.data.allocations ?? []).map((a) => a.month)),
    ];
    if (!months.length) return [];
    return (
      await this.ds.getRepository(DrePeriod).find({
        where: { organizationId, month: In(months), closed: true },
      })
    )
      .map((p) => p.month)
      .sort();
  }

  /** Datas pelas quais a despesa entra no fluxo: lançamento, faturada, paga, parcelas e baixas do fluxo. */
  async expenseDates(organizationId: number, expenseId: number) {
    const e = await this.ds
      .getRepository(ExpenseEntity)
      .findOne({ where: { id: expenseId, organizationId } });
    const installments = await this.ds
      .getRepository(ExpenseInstallmentEntity)
      .find({ where: { organizationId, expenseId } });
    const settled = await this.ds
      .getRepository(CashOutflowSettlementEntity)
      .find({
        where: [
          { organizationId, sourceKey: `expense:${expenseId}` },
          { organizationId, sourceKey: Like(`expense:${expenseId}:%`) },
        ],
      });
    return [
      civil(e?.expenseDate),
      civil(e?.invoicedPaymentDate),
      civil(e?.paidAt),
      ...installments.map((i) => civil(i.dueDate)),
      ...settled.map((s) => civil(s.paidOn)),
    ];
  }

  /**
   * Competência fechada da DRE não muda: recusa se a despesa estiver
   * classificada em mês fechado (regime anterior ao corte) ou se alguma data
   * atual ou nova (`dates`) cair em mês fechado. `expenseId` nulo = despesa nova.
   */
  async assertDreOpen(
    organizationId: number,
    expenseId: number | null,
    action = 'Não é possível alterar a despesa',
    dates: Array<Date | string | null | undefined> = [],
  ) {
    await assertDreMonthsOpen(
      this.ds.manager,
      organizationId,
      [
        ...(expenseId
          ? await this.expenseDates(organizationId, expenseId)
          : []),
        ...dates,
      ],
      action,
      expenseId ? await this.closedDreMonths(organizationId, expenseId) : [],
    );
  }

  /** Despesa num lote já faturado ao cliente não muda de tipo, valor nem lote. */
  async assertNotBilled(batchId: number | null | undefined) {
    if (!batchId) return;
    const batch = await this.ds
      .getRepository(ExpenseReimbursementBatchEntity)
      .findOneBy({ id: batchId });
    if (batch && BILLED_BATCH(batch.status))
      throw new ConflictException({
        code: 'REIMBURSEMENT_BATCH_BILLED',
        message: `A despesa está no lote ${batch.number}, já faturado ao cliente. Reabra o lote antes.`,
      });
  }

  /**
   * Resolve os campos da etapa 4 a partir do formulário. Na edição, campo
   * ausente mantém o valor atual; parcelas só são refeitas quando a grade é
   * enviada ou quando valor, data, forma ou quantidade mudam (nunca à toa).
   */
  async classify(
    organizationId: number,
    projectId: number,
    dto: ExpenseInputDto,
    current?: ExpenseProps,
  ): Promise<ExpenseClassification> {
    const fields: ExpenseClassification['fields'] = {};
    const has = (key: keyof ExpenseInputDto) => dto[key] !== undefined;
    if (has('expense_type')) fields.expenseType = dto.expense_type ?? null;
    else if (!current)
      fields.expenseType = await this.defaultType(organizationId, projectId);
    if (has('reason_code')) {
      const code = dto.reason_code?.trim() || null;
      if (code) {
        const list = await this.reasons(organizationId);
        if (list && !list.includes(code))
          this.invalid(
            'reason_code',
            `Motivo fora da lista da organização: ${list.join(', ')}.`,
          );
      }
      fields.reasonCode = code;
    }
    if (has('deposited_amount'))
      fields.depositedAmount = dto.deposited_amount ?? null;

    const method = has('payment_method')
      ? (dto.payment_method ?? null)
      : (current?.paymentMethod ?? null);
    if (has('payment_method')) fields.paymentMethod = method;
    let installments: InstallmentLine[] | null | undefined;
    if (method === 'invoiced') {
      const date = dto.invoiced_payment_date ?? current?.invoicedPaymentDate;
      if (!date)
        this.invalid(
          'invoiced_payment_date',
          'Informe a data de pagamento da despesa faturada.',
        );
      fields.invoicedPaymentDate = date;
    } else if (has('payment_method')) fields.invoicedPaymentDate = null;

    if (method === 'installments') {
      const date = dto.expense_date;
      try {
        if (dto.installments?.length)
          installments = validateInstallments(dto.amount, dto.installments);
        else {
          const existing = current
            ? await this.ds
                .getRepository(ExpenseInstallmentEntity)
                .find({ where: { expenseId: current.id } })
            : [];
          const unchanged =
            current &&
            current.paymentMethod === 'installments' &&
            current.amount === dto.amount &&
            civil(current.expenseDate) === date &&
            existing.length > 0 &&
            (!dto.installment_count ||
              dto.installment_count === existing.length);
          if (!unchanged) {
            const count = dto.installment_count ?? existing.length;
            if (!count)
              this.invalid(
                'installment_count',
                'Informe o número de parcelas.',
              );
            installments = installmentPlan(dto.amount, count, date);
          }
        }
      } catch (error) {
        if (
          error instanceof ExpenseRuleError ||
          error instanceof RemunerationRuleError
        )
          this.invalid('installments', error.message);
        throw error;
      }
    } else if (has('payment_method') && current) installments = null;
    return { fields, installments };
  }

  private invalid(field: string, message: string): never {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message,
      details: [{ field, message }],
    });
  }
}
