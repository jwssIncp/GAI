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
 * Estado de exibição (bloco oculto, filtros de um bloco, painel recolhido)
 * lembrado no navegador, separado por usuário e organização. Sem servidor e
 * sem migration: vale para este navegador. Falha de armazenamento (aba
 * privada, bloqueio) ou valor inválido nunca quebra a tela: fica o padrão.
 */
export function useViewState<T>(name: string, initial: T, valid: (v: unknown) => v is T): [T, (value: T) => void] {
  const user = useCurrentUser();
  const key = `gai.view.${user?.organization_id ?? "plataforma"}.${user?.id ?? "anonimo"}.${name}`;
  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return valid(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  };
  const [state, setState] = useState<{ key: string; value: T }>(() => ({ key, value: read() }));
  // Troca de usuário ou organização sem desmontar: relê a preferência da nova chave.
  const value = state.key === key ? state.value : read();
  const set = useCallback(
    (next: T) => {
      setState({ key, value: next });
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* sem armazenamento: só nesta visita */
      }
    },
    [key],
  );
  return [value, set];
}

const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";

/** Preferência booleana (ex.: bloco oculto, painel recolhido). */
export function useViewPreference(name: string, initial: boolean): [boolean, (value: boolean) => void] {
  return useViewState(name, initial, isBoolean);
}
