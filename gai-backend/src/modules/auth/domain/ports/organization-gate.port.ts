export const ORGANIZATION_GATE = Symbol('ORGANIZATION_GATE');

export interface OrganizationGate {
  isActive(organizationId: number): Promise<boolean>;
  /** Nome de exibição (nome fantasia ou razão social); null se não existir. */
  displayName(organizationId: number): Promise<string | null>;
}
