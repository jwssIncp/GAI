import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { rbacApi, usersApi } from "@/api/endpoints";
import { normalizePage } from "@/api/pagination";
import { DataTable } from "@/components/base/DataTable";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { Pagination } from "@/components/base/Pagination";
import { SearchInput } from "@/components/base/SearchInput";
import { FormField } from "@/components/base/FormField";
import { ErrorState, LoadingState } from "@/components/base/States";
import { usePermissions } from "@/features/auth/usePermissions";
import { useListState } from "@/hooks/useListState";
import { UserActions } from "./UserActions";
import { UserOrganizationSelect } from "./UserOrganizationSelect";
import { userSelectClass, userStatusLabels } from "./userFields";
import { useAuth } from "@/features/auth/AuthContext";
import type { User } from "@/types/api";
export function UsersPage() {
  const { hasPermission, isPlatformAdmin } = usePermissions();
  const { user } = useAuth();
  const state = useListState();
  const [params, setParams] = useSearchParams();
  const organization = params.get("organization") || "";
  const status = params.get("status") || "";
  const role = params.get("role_id") || "";
  const sort = params.get("sort_by") || "created_at";
  const [showOrganizations, setShowOrganizations] = useState(
    Boolean(organization),
  );
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    if (key === "organization") next.delete("role_id");
    setParams(next, { replace: true });
  };
  const organizationId = isPlatformAdmin
    ? organization && organization !== "platform"
      ? Number(organization)
      : undefined
    : user?.organization_id || undefined;
  const profiles = useQuery({
    queryKey: ["access-profiles", "user-filter", organizationId, organization],
    queryFn: () => rbacApi.profiles(organizationId),
    enabled: !isPlatformAdmin || Boolean(organization),
  });
  const query = useQuery({
    queryKey: ["users", "list", state.params, organization, status, role, sort],
    queryFn: () =>
      usersApi.list({
        ...state.params,
        organization_id: organizationId,
        ...(organization === "platform" ? { scope: "PLATFORM" as const } : {}),
        status: status || undefined,
        role_id: role ? Number(role) : undefined,
        sort_by: sort,
        sort_order: sort === "name" || sort === "login" ? "ASC" : "DESC",
      }),
  });
  const page = query.data ? normalizePage<User>(query.data) : null;
  return (
    <PageContainer>
      <PageHeader
        title="Usuários"
        description="Pessoas, organizações e acessos do GAI."
        action={
          hasPermission("users:write") ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
              to="/app/users/new"
            >
              <Plus size={17} /> Cadastrar usuário
            </Link>
          ) : null
        }
      />
      <section
        className="premium-panel mb-6 grid gap-4 p-4 sm:p-5"
        aria-label="Filtros de usuários"
      >
        <SearchInput
          value={state.search}
          onChange={state.setSearch}
          placeholder="Pesquisar por nome, login ou e-mail"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Status">
            <select
              className={userSelectClass}
              value={status}
              onChange={(e) => setFilter("status", e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(userStatusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Perfil de acesso"
            hint={
              isPlatformAdmin && !organization
                ? "Selecione uma organização para filtrar perfis."
                : undefined
            }
          >
            <select
              className={userSelectClass}
              disabled={isPlatformAdmin && !organization}
              value={role}
              onChange={(e) => setFilter("role_id", e.target.value)}
            >
              <option value="">Todos os perfis</option>
              {profiles.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Ordenar por">
            <select
              className={userSelectClass}
              value={sort}
              onChange={(e) => setFilter("sort_by", e.target.value)}
            >
              <option value="created_at">Mais recentes</option>
              <option value="name">Nome</option>
              <option value="login">Login</option>
              <option value="last_login_at">Último acesso</option>
            </select>
          </FormField>
        </div>
        {isPlatformAdmin && (
          <>
            <button
              type="button"
              className="min-h-11 justify-self-start text-sm font-semibold text-primary hover:underline"
              onClick={() => setShowOrganizations((value) => !value)}
              aria-expanded={showOrganizations}
            >
              Filtrar por organização
            </button>
            {showOrganizations && (
              <UserOrganizationSelect
                filter
                value={organization}
                onChange={(value) => setFilter("organization", value)}
              />
            )}
          </>
        )}
        {profiles.isError && (
          <p role="alert" className="text-sm text-destructive">
            {profiles.error.message}
          </p>
        )}
      </section>
      {query.isLoading ? (
        <LoadingState label="Carregando usuários" />
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : page ? (
        <>
          <DataTable<User>
            caption="Usuários cadastrados"
            items={page.items}
            getKey={(item) => item.id}
            columns={[
              {
                header: "Usuário",
                cell: (item) => (
                  <div className="max-w-64 break-words">
                    <Link
                      to={"/app/users/" + item.id}
                      className="font-semibold text-primary-text hover:underline"
                    >
                      {item.full_name || item.login}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.login}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.email}
                    </div>
                  </div>
                ),
              },
              {
                header: "Organização",
                cell: (item) =>
                  item.organization_name ||
                  (item.organization_id
                    ? "#" + item.organization_id
                    : "Plataforma"),
              },
              {
                header: "Perfis",
                cell: (item) => (
                  <span className="text-xs">
                    {item.role_assignments.map((r) => r.role_name).join(", ") ||
                      "Sem perfil"}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (item) => (
                  <div className="max-w-40 text-xs">
                    <span className="rounded-full bg-muted px-2 py-1 font-medium">
                      {item.status === "LOCKED" &&
                      item.locked_until &&
                      new Date(item.locked_until) <= new Date()
                        ? "Liberado para nova tentativa"
                        : userStatusLabels[item.status]}
                    </span>
                    {item.must_change_password && (
                      <p className="mt-2 text-muted-foreground">
                        Troca de senha obrigatória
                      </p>
                    )}
                  </div>
                ),
              },
              {
                header: "Último acesso",
                cell: (item) => (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {item.last_login_at
                      ? new Date(item.last_login_at).toLocaleString("pt-BR")
                      : "Ainda não registrado"}
                  </span>
                ),
              },
              { header: "Ações", cell: (item) => <UserActions user={item} /> },
            ]}
          />
          <Pagination
            page={page.page}
            totalPages={page.totalPages}
            onPageChange={state.setPage}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
