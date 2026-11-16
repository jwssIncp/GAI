import { api } from "@/api/http";
import type { EntityOption, EntitySource } from "@/components/base/EntityCombobox";
import { named, pageOf, PAGE_SIZE, userSource } from "@/components/base/entitySources";

type User = { id: number; full_name?: string | null; login: string; email?: string | null };
const user = (u: User): EntityOption => ({
  id: u.id,
  label: named(u.full_name || u.login, u.full_name ? u.login : null),
  description: u.email ?? null,
});

/**
 * Usuários ATIVOS da organização (o responsável do orçamento precisa estar
 * ativo). Igual a `userSource`, com status=ACTIVE na busca (GET /users aceita
 * o filtro `status`).
 */
export const activeUserSource: EntitySource<{ organization_id?: number | null }> = {
  key: "users-active",
  search: async ({ search, page, context }) =>
    pageOf(
      (
        await api.get<{ data?: User[]; meta?: { total_pages?: number; totalPages?: number } }>("/users", {
          params: {
            page,
            page_size: PAGE_SIZE,
            search: search || undefined,
            organization_id: context.organization_id ?? undefined,
            status: "ACTIVE",
          },
        })
      ).data,
      page,
      user,
    ),
  one: userSource.one,
};
