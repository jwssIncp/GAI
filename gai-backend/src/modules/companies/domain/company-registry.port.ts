/** Future adapters run only in the backend: keep credentials private, throttle
 * requests, set timeouts and return proposals for user confirmation before save.
 * Official registration status must never replace the internal company status.
 */
export interface CompanyRegistryProvider {
  lookup(
    normalizedCnpj: string,
    signal?: AbortSignal,
  ): Promise<{
    source: string;
    consultedAt: string;
    registrationStatus?: string;
    proposedFields: Partial<{
      corporate_name: string;
      name: string;
      email: string;
      phone: string;
      zipcode: string;
      address: string;
      number: string;
      complement: string;
      district: string;
      city: string;
      state: string;
      country: string;
    }>;
  } | null>;
}
