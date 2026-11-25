import type { FieldAgentDocumentCategory } from "@/types/api";

/** Tipos de documento do inventariante, na ordem do seletor. */
export const DOCUMENT_CATEGORIES: Array<{ value: FieldAgentDocumentCategory; label: string }> = [
  { value: "registration_form", label: "Ficha cadastral" },
  { value: "driver_license", label: "CNH" },
  { value: "medical_exam", label: "Exame" },
  { value: "certificate", label: "Certificado" },
  { value: "other", label: "Outro" },
];

export function documentCategoryLabel(value: FieldAgentDocumentCategory | null | undefined) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === value)?.label ?? "Outro";
}

export const ACCEPTED_DOCUMENTS = "image/jpeg,image/png,image/webp,application/pdf";

export function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
