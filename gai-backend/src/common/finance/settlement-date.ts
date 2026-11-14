import { BadRequestException } from '@nestjs/common';
import { civilToday } from '../../modules/finance-settings/finance-settings.policy';

const br = (civil: string) => civil.split('-').reverse().join('/');

/**
 * Baixas do Financeiro (pagamento ou recebimento) registram um fato que já
 * aconteceu: a data não pode ser posterior a hoje (fuso de São Paulo).
 * Datas previstas (vencimento, previsão) continuam podendo ser futuras.
 */
export function assertNotFuture(
  date: string | null | undefined,
  what: string,
  today: string = civilToday(),
): void {
  if (date && date > today)
    throw new BadRequestException({
      code: 'FUTURE_SETTLEMENT_DATE',
      message: `${what} não pode ser futura: ${br(date)} é depois de hoje (${br(today)}). Registre a baixa no dia em que ela acontecer.`,
    });
}
