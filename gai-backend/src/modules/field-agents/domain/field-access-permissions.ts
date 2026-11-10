/**
 * Least-privilege permission set of the organization field-agent profile
 * (`FIELD_AGENT_ORG_{organizationId}`). Collection only: no administrative,
 * financial, bulk-import or management permissions. Every key must exist in the
 * catalog with ORGANIZATION scope. Project confinement is enforced separately by
 * SessionAuthGuard for every account linked to a field agent.
 */
export const FIELD_ACCESS_PERMISSIONS: readonly string[] = [
  'projects:read',
  'inventory-items:read',
  'inventory-items:create',
  'inventory-items:update',
  'inventory-items:deactivate',
  'inventory-item-images:read',
  'inventory-item-images:create',
  'inventory-item-images:update',
  'inventory-item-images:download',
  'inventory-item-images:remove',
  'inventory-sessions:read',
  'inventory-observations:create',
  // Onda 3: mobile reconciliation (own sessions only, see ImportSessionsService
  // confinement). Never cancel/retry/reprocess, never financial.
  'import-sessions:create',
  'import-sessions:read',
  'import-sessions:finish',
  'import-files:create',
  'import-payloads:create',
  'import-errors:read',
];

/** Set granted before Onda 0; existing roles may still hold exactly this set. */
export const LEGACY_FIELD_ACCESS_PERMISSIONS: readonly string[] = [
  'projects:read',
  'inventory-items:read',
  'inventory-sessions:read',
  'inventory-observations:create',
];

export const FIELD_AGENT_ROLE_PREFIX = 'FIELD_AGENT_ORG_';
