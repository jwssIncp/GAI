import { ConflictException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { DrePeriod } from '../managerial-dre/dre.entity';

const brMonth = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;

/**
 * Recusa mudar a data de um recebimento ou pagamento quando a data original
 * ou a nova cai em competência fechada da DRE: o mês fechado está congelado e
 * só muda depois de reaberto (permissão de competências + justificativa).
 */
export async function assertDreMonthsOpen(
  m: EntityManager,
  organizationId: number,
  dates: Array<string | null | undefined>,
  action: string,
) {
  const months = [
    ...new Set(
      dates.filter((d): d is string => Boolean(d)).map((d) => d.slice(0, 7)),
    ),
  ];
  if (!months.length) return;
  const closed = await m.find(DrePeriod, {
    where: { organizationId, month: In(months), closed: true },
  });
  if (!closed.length) return;
  const list = closed
    .map((p) => p.month)
    .sort()
    .map(brMonth);
  throw new ConflictException({
    code: 'DRE_PERIOD_CLOSED',
    months: closed.map((p) => p.month).sort(),
    message: `${action}: ${list.length > 1 ? `as competências ${list.join(' e ')} estão fechadas` : `a competência ${list[0]} está fechada`} na DRE. Para alterar, reabra a competência na DRE (exige a permissão de fechar e reabrir competências e uma justificativa).`,
  });
}
