/** Rótulo de quem fez uma ação quando o usuário não existe mais. */
export const REMOVED_USER = "Usuário removido";

/**
 * Nome do usuário vindo da API (`<campo>_name`); sem nome, "Usuário removido".
 * Nunca mostra o ID técnico ("#id") na tela.
 */
export function userLabel(name: string | null | undefined): string {
  return name?.trim() || REMOVED_USER;
}
