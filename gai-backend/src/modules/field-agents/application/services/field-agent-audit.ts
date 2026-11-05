/** Metadata is arbitrary JSON; never copy it (or credentials) into audit output. */
export function fieldAgentAuditChanges(
  changes: Record<string, { before: unknown; after: unknown }>,
) {
  const allowed = new Set([
    'organization_id',
    'name',
    'email',
    'phone',
    'document',
    'user_id',
    'status',
    'deleted_at',
    'field_agent_id',
    'project_id',
    'role',
    'start_date',
    'end_date',
    'notes',
  ]);
  return Object.fromEntries(
    Object.entries(changes).filter(([key]) => allowed.has(key)),
  );
}
