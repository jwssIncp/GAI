import type { UserStatus } from "@/types/api";
export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Desativado",
  BLOCKED: "Bloqueado pela administração",
  LOCKED: "Bloqueio temporário",
  PENDING_ACTIVATION: "Aguardando ativação",
};
export const userSelectClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
export const passwordHint =
  "Use de 15 a 128 caracteres. Uma frase é bem-vinda; não há exigência de símbolos ou letras maiúsculas.";
export const validatePassword = (value: string) =>
  ([...value].length >= 15 &&
    [...value].length <= 128 &&
    Boolean(value.trim())) ||
  "Informe uma senha com 15 a 128 caracteres.";
