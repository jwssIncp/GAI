import type { WhereExpressionBuilder } from 'typeorm';
import type { OrganizationOverviewQueryDto } from '../project-dashboard/application/dto/organization-overview-query.dto';
import { invalid } from './contract.policy';
export const COMMERCIAL_FILTERS = [
  'contract_from',
  'contract_to',
  'contract_status',
  'segment',
  'contract_state',
  'recurring',
  'service',
  'assets_min',
  'assets_max',
] as const;
export function hasCommercialFilters(f: OrganizationOverviewQueryDto) {
  return COMMERCIAL_FILTERS.some((k) => f[k] != null);
}
export function applyCommercialFilters(
  q: WhereExpressionBuilder,
  alias: string,
  f: OrganizationOverviewQueryDto,
) {
  if (f.contract_from && f.contract_to && f.contract_from > f.contract_to)
    invalid('Período contratual invertido.');
  if (
    f.assets_min != null &&
    f.assets_max != null &&
    f.assets_min > f.assets_max
  )
    invalid('Faixa de bens invertida.');
  const field = (key: string) =>
    `JSON_UNQUOTE(JSON_EXTRACT(${alias}.data, '$.${key}'))`;
  for (const [filter, key] of [
    ['contract_status', 'status'],
    ['segment', 'segment'],
    ['contract_state', 'company_state'],
  ] as const) {
    if (f[filter] != null)
      q.andWhere(`${field(key)} = :cf_${filter}`, {
        ['cf_' + filter]: f[filter],
      });
  }
  if (f.contract_from)
    q.andWhere(
      `${field('contracted_on')} >= :cf_from AND ${field('contracted_on')} != 'null'`,
      { cf_from: f.contract_from },
    );
  if (f.contract_to)
    q.andWhere(`${field('contracted_on')} <= :cf_to`, { cf_to: f.contract_to });
  if (f.recurring)
    q.andWhere(`${field('recurring')} = :cf_recurring`, {
      cf_recurring: f.recurring,
    });
  if (f.service)
    q.andWhere(
      `JSON_CONTAINS(JSON_EXTRACT(${alias}.data, '$.services'), :cf_service)`,
      { cf_service: JSON.stringify(f.service) },
    );
  for (const [key, op] of [
    ['assets_min', '>='],
    ['assets_max', '<='],
  ] as const) {
    if (f[key] != null)
      q.andWhere(
        `${field('estimated_assets')} != 'null' AND CAST(${field('estimated_assets')} AS UNSIGNED) ${op} :cf_${key}`,
        { ['cf_' + key]: f[key] },
      );
  }
  return q;
}
