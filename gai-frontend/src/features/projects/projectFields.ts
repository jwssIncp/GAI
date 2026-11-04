import type { ProjectType } from "@/types/api";
import { formatDate } from "@/utils/format";

// A planned DATE is a civil date, not an instant in UTC.
export function formatProjectDate(value?: string | null) {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  return formatDate(value);
}

export const projectTypeLabels: Record<ProjectType, string> = {
  inventory: "Inventário patrimonial",
  valuation: "Avaliação patrimonial",
  inventory_valuation: "Inventário e avaliação",
  reconciliation: "Conciliação patrimonial",
  regularization: "Regularização patrimonial",
  other: "Outro",
};
export const projectSelectClass =
  "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";
