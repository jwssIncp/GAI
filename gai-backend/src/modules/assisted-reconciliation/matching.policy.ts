import { InventoryOperationPolicy } from '../inventory-operations/application/inventory-operation.policy';

export const ASSISTED_PERMISSIONS = [
  'assisted-reconciliation:read',
  'assisted-reconciliation:generate',
  'assisted-reconciliation:review',
];
export interface MatchConfig {
  version: 1;
  textThreshold: number;
  localTextThreshold: number;
  descriptionAlertThreshold: number;
}
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  version: 1,
  textThreshold: 0.92,
  localTextThreshold: 0.85,
  descriptionAlertThreshold: 0.25,
};
export interface MatchSource {
  id: number;
  plate: string | null;
  serial: string | null;
  description: string | null;
  location: string | null;
  unit: string | null;
  version: string;
  observationId?: number;
  roundId?: number;
  result?: string;
}
export const normalizeIdentifier = (value: string | null) =>
  InventoryOperationPolicy.normalizePlate(value);
export const normalizeText = (value: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const tokens = (value: string | null) =>
  new Set(
    normalizeText(value)
      .split(' ')
      .filter(
        (t) =>
          t.length > 1 &&
          !['de', 'da', 'do', 'das', 'dos', 'com', 'para'].includes(t),
      ),
  );
export function descriptionSimilarity(
  a: string | null,
  b: string | null,
): number | null {
  const left = tokens(a),
    right = tokens(b);
  if (!left.size || !right.size) return null;
  return (
    [...left].filter((t) => right.has(t)).length /
    new Set([...left, ...right]).size
  );
}
export function compareSources(
  physical: MatchSource,
  accounting: MatchSource,
  config: MatchConfig,
) {
  const coincident: string[] = [],
    divergent: string[] = [],
    missing: string[] = [];
  for (const key of ['plate', 'serial', 'location', 'unit'] as const) {
    const norm =
      key === 'plate' || key === 'serial' ? normalizeIdentifier : normalizeText;
    const a = norm(physical[key]),
      b = norm(accounting[key]);
    if (!a || !b) missing.push(key);
    else if (a === b) coincident.push(key);
    else divergent.push(key);
  }
  const similarity = descriptionSimilarity(
    physical.description,
    accounting.description,
  );
  if (similarity === null) missing.push('description');
  else if (
    normalizeText(physical.description) ===
    normalizeText(accounting.description)
  )
    coincident.push('description');
  else divergent.push('description');
  const hasText =
    tokens(physical.description).size >= 2 &&
    tokens(accounting.description).size >= 2;
  const rule = coincident.includes('plate')
    ? 'exact_plate'
    : coincident.includes('serial')
      ? 'exact_serial'
      : hasText &&
          similarity !== null &&
          coincident.includes('location') &&
          similarity >= config.localTextThreshold
        ? 'description_location'
        : hasText && similarity !== null && similarity >= config.textThreshold
          ? 'description'
          : null;
  if (!rule) return null;
  const alerts: string[] = [];
  if (
    similarity !== null &&
    similarity < config.descriptionAlertThreshold &&
    (rule === 'exact_plate' || rule === 'exact_serial')
  )
    alerts.push(
      'Descrição potencialmente incompatível: placa/série coincide, mas há baixa sobreposição de palavras nas descrições.',
    );
  if (rule === 'exact_serial' && divergent.includes('plate'))
    alerts.push('A série coincide, mas as placas divergem.');
  if (missing.length)
    alerts.push('Campos não comparáveis ou ausentes: ' + missing.join(', '));
  if (physical.result === 'not_found' || physical.result === 'duplicated')
    alerts.push(
      'Resultado da observação exige reinventário antes da aprovação.',
    );
  return {
    rule,
    coincident,
    divergent,
    missing,
    similarity,
    alerts,
    score:
      rule === 'exact_plate'
        ? 1
        : rule === 'exact_serial'
          ? 0.98
          : (similarity ?? 0),
  };
}
export type MatchEvidence = NonNullable<ReturnType<typeof compareSources>>;
