import type { FieldAgentAccess, FieldAgentAccessStatus } from "@/types/api";
import { formatDateTime } from "@/utils/format";

export const fieldAgentAccessLabels: Record<FieldAgentAccessStatus, string> = {
  NONE: "Sem acesso",
  INVITATION_PENDING: "Convite pendente",
  AWAITING_FIRST_ACCESS: "Aguardando 1º acesso",
  ACTIVE: "Acesso ativo",
  REVOKED: "Acesso revogado",
};

/** Tons já existentes no StatusBadge. */
export const fieldAgentAccessTones: Record<FieldAgentAccessStatus, string> = {
  NONE: "inactive",
  INVITATION_PENDING: "pending",
  AWAITING_FIRST_ACCESS: "in_review",
  ACTIVE: "active",
  REVOKED: "blocked",
};

export function fieldAgentAccessHint(access?: FieldAgentAccess | null) {
  if (access?.status === "AWAITING_FIRST_ACCESS")
    return access.temporary_password_issued_at
      ? `Senha temporária emitida em ${formatDateTime(access.temporary_password_issued_at)}`
      : "Senha temporária emitida";
  return undefined;
}
