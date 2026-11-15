import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";

/** Usuário atual, ou nulo fora do provedor de autenticação. */
function useCurrentUser() {
  try {
    return useAuth().user;
  } catch {
    return null;
  }
}

/**
 * Preferência de exibição (ex.: bloco oculto ou recolhido) lembrada no
 * navegador, separada por usuário e organização. Sem servidor e sem migration:
 * vale para este navegador. Falha de armazenamento (aba privada, bloqueio)
 * nunca quebra a tela: fica o valor padrão.
 */
export function useViewPreference(name: string, initial: boolean): [boolean, (value: boolean) => void] {
  const user = useCurrentUser();
  const key = `gai.view.${user?.organization_id ?? "plataforma"}.${user?.id ?? "anonimo"}.${name}`;
  const read = () => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  };
  const [state, setState] = useState<{ key: string; value: boolean }>(() => ({ key, value: read() }));
  // Troca de usuário ou organização sem desmontar: relê a preferência da nova chave.
  const value = state.key === key ? state.value : read();
  const set = useCallback(
    (next: boolean) => {
      setState({ key, value: next });
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* sem armazenamento: só nesta visita */
      }
    },
    [key],
  );
  return [value, set];
}
