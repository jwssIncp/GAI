export const ORGANIZATION_GATE = Symbol('ORGANIZATION_GATE');

export interface OrganizationGate {
  isActive(organizationId: number): Promise<boolean>;
}
