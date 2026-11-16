import { StatusBadge } from "@/components/base/StatusBadge";
import type { FieldAgentAccess } from "@/types/api";
import {
  fieldAgentAccessHint,
  fieldAgentAccessLabels,
  fieldAgentAccessTones,
} from "./fieldAgentAccess";

export function FieldAgentAccessBadge({
  access,
}: {
  access?: FieldAgentAccess | null;
}) {
  const status = access?.status ?? "NONE";
  const label = fieldAgentAccessLabels[status];
  return (
    <StatusBadge
      value={fieldAgentAccessTones[status]}
      label={label}
      title={fieldAgentAccessHint(access) ?? label}
    />
  );
}
