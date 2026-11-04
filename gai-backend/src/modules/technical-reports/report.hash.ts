import { createHash } from 'node:crypto';
export const REPORT_HASH_ALGORITHM = 'sha256-canonical-json-v1';
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function documentHash(value: unknown) {
  return createHash('sha256')
    .update(
      JSON.stringify(canonical(JSON.parse(JSON.stringify(value)) as unknown)),
    )
    .digest('hex');
}
