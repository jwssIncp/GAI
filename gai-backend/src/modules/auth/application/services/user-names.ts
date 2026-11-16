import { EntityManager, In } from 'typeorm';
import { UserEntity } from '../../infrastructure/persistence/user.entity';

/**
 * Nomes de usuários para exibição (nome completo ou login), numa consulta só.
 * Não exige permissão de leitura de usuários: serve para mostrar quem fez cada
 * ação em históricos e cadastros que o perfil já pode ver. Usuário removido
 * fica fora do mapa (a tela mostra "Usuário removido").
 */
export async function loadUserNames(
  m: EntityManager,
  ids: Iterable<number | string | null | undefined>,
): Promise<Map<number, string>> {
  const unique = [
    ...new Set(
      [...ids]
        .filter((id) => id !== null && id !== undefined && id !== '')
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (!unique.length) return new Map();
  const users = await m.find(UserEntity, {
    where: { id: In(unique) },
    select: { id: true, fullName: true, login: true },
  });
  return new Map(
    users.map((u) => [Number(u.id), u.fullName?.trim() || u.login]),
  );
}

/** Nome do usuário no mapa, ou nulo (sem usuário ou usuário removido). */
export function userNameOf(
  names: Map<number, string>,
  id: number | string | null | undefined,
): string | null {
  if (id === null || id === undefined || id === '') return null;
  return names.get(Number(id)) ?? null;
}
