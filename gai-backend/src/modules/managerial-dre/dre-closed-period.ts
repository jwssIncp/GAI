import { ConflictException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { DrePeriod } from './dre.entity';

/** "2026-10" → "10/2026". */
export const brMonth = (month: string) =>
  `${month.slice(5, 7)}/${month.slice(0, 4)}`;

type CivilDate = string | Date | null | undefined;

/** Mês civil (AAAA-MM) de uma data civil ou de um Date gravado em UTC. */
export function monthOf(value: CivilDate): string | null {
  if (!value) return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : null;
}

/** Junta "a" / "as" competências: "10/2026" ou "10/2026 e 11/2026". */
function list(months: string[]) {
  const labels = months.map(brMonth);
  return labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
    : labels[0];
}

/**
 * Recusa padrão por competência fechada: diz a ação recusada, o mês e o
 * caminho (reabrir a competência na DRE, com permissão e justificativa, e
 * lançar de novo). Mesma mensagem em recebíveis, fluxo, despesas, diárias,
 * comissões e placas.
 */
export function closedPeriodError(action: string, months: string[]) {
  const sorted = [...new Set(months)].sort();
  const many = sorted.length > 1;
  const which = list(sorted);
  return new ConflictException({
    code: 'DRE_PERIOD_CLOSED',
    details: { months: sorted },
    message:
      `${action}: ${many ? `as competências ${which} estão fechadas` : `a competência ${which} está fechada`} na DRE. ` +
      `Reabra ${many ? 'as competências' : 'a competência'} ${which} na DRE (exige permissão e justificativa) e lance novamente.`,
  });
}

/** Competências fechadas da DRE entre os meses das datas informadas. */
export async function closedDreMonths(
  m: EntityManager,
  organizationId: number,
  dates: CivilDate[],
): Promise<string[]> {
  const months = [
    ...new Set(dates.map(monthOf).filter((x): x is string => Boolean(x))),
  ];
  if (!months.length) return [];
  const closed = await m.find(DrePeriod, {
    where: { organizationId, month: In(months), closed: true },
  });
  return closed.map((p) => p.month).sort();
}

/**
 * Recusa a operação quando alguma das datas (original ou nova) cai em
 * competência fechada da DRE: o mês fechado está congelado e só muda depois
 * de reaberto. `extra` soma meses já conhecidos como fechados (ex.: meses da
 * classificação manual, regime anterior ao corte).
 */
export async function assertDreMonthsOpen(
  m: EntityManager,
  organizationId: number,
  dates: CivilDate[],
  action: string,
  extra: string[] = [],
) {
  const closed = [
    ...(await closedDreMonths(m, organizationId, dates)),
    ...extra,
  ];
  if (closed.length) throw closedPeriodError(action, closed);
}

/**
 * Mês fechado sem a coluna congelada é recalculado: mudar regras, layout ou
 * aplicar o modelo mudaria o valor de uma competência fechada. Recusa e diz o
 * caminho (congelar a coluna em Competências ou reabrir a competência).
 */
export async function assertNoLooseClosedMonth(
  m: EntityManager,
  organizationId: number,
  action: string,
) {
  const loose = (
    await m.find(DrePeriod, { where: { organizationId, closed: true } })
  )
    .filter((p) => !p.data?.grid)
    .map((p) => p.month)
    .sort();
  if (!loose.length) return;
  const many = loose.length > 1;
  const which = list(loose);
  throw new ConflictException({
    code: 'DRE_PERIOD_CLOSED',
    details: { months: loose },
    message:
      `${action}: ${many ? `as competências ${which} estão fechadas` : `a competência ${which} está fechada`} sem a coluna congelada e mudaria de valor. ` +
      `Congele a coluna em Competências ou reabra ${many ? 'as competências' : 'a competência'} ${which} na DRE (exige permissão e justificativa) e altere novamente.`,
  });
}
