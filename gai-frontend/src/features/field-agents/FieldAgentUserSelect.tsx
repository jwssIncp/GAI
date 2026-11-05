import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fieldAgentsApi } from "@/api/endpoints";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { userStatusLabels } from "@/features/users/userFields";
import { useDebouncedValue } from "./useDebouncedValue";

export function FieldAgentUserSelect({
  value,
  onChange,
  currentId,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  currentId?: number;
  id?: string;
}) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const term = useDebouncedValue(search);
  const query = useQuery({
    queryKey: ["field-agent-user-options", term, page, currentId],
    queryFn: () =>
      fieldAgentsApi.userOptions({
        page,
        page_size: 20,
        search: term || undefined,
        current_agent_id: currentId,
      }),
  });
  return (
    <div className="grid gap-2">
      <Input
        aria-label="Pesquisar conta por nome, login ou e-mail"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Nome, login ou e-mail"
      />
      <select
        id={id}
        aria-label="Usuário vinculado"
        className="h-11 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={query.isLoading || query.isError}
      >
        <option value="">
          {query.isLoading ? "Carregando contas..." : "Selecione uma conta"}
        </option>
        {value &&
        !query.data?.items.some((user) => String(user.id) === value) ? (
          <option value={value}>Conta atualmente associada</option>
        ) : null}
        {query.data?.items.map((user) => (
          <option key={user.id} value={user.id}>
            {user.full_name || user.login} · {user.email} ·{" "}
            {userStatusLabels[user.status]}
          </option>
        ))}
      </select>
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Falha ao consultar contas.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </p>
      ) : null}
      {query.data && !query.data.items.length ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma conta disponível nesta pesquisa.
        </p>
      ) : null}
      {query.data && query.data.total_pages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs">
            Página {page} de {query.data.total_pages}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= query.data.total_pages}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
