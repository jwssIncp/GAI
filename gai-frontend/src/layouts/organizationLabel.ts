import type { CurrentUser } from '@/types/api';

/** Nome da organização no topo; sem o nome (API antiga), o número; sem organização, "Plataforma". */
export function organizationLabel(user: CurrentUser | null | undefined): string {
  if (!user?.organization_id) return 'Plataforma';
  return user.organization_name?.trim() || `Organização #${user.organization_id}`;
}
