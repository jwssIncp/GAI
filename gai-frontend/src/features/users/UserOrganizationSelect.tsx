import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { organizationsApi } from "@/api/endpoints";
import { normalizePage } from "@/api/pagination";
import { FormField } from "@/components/base/FormField";
import { SearchInput } from "@/components/base/SearchInput";
import { Pagination } from "@/components/base/Pagination";
import { ErrorState } from "@/components/base/States";
import { userSelectClass } from "./userFields";

export function UserOrganizationSelect({
  value,
  onChange,
  filter = false,
  currentName,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  filter?: boolean;
  currentName?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["organizations", "user-options", search, page, filter],
    queryFn: () =>
      organizationsApi.list({
        page,
        page_size: 30,
        search: search || undefined,
        ...(filter ? {} : { status: "ACTIVE" as const }),
      }),
  });
  const data = query.data ? normalizePage(query.data) : null;
  return (
    <div className="grid gap-2">
      <FormField label="Pesquisar organização" optional>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Pesquisar pelo nome"
        />
      </FormField>
      <FormField
        label="Organização"
        error={error}
        hint={
          filter
            ? undefined
            : "Somente organizações ativas podem receber novas contas."
        }
      >
        <select
          className={userSelectClass}
          required={!filter}
          value={value}
          disabled={disabled || query.isLoading}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {query.isLoading
              ? "Carregando organizações…"
              : filter
                ? "Todas as organizações"
                : "Selecione a organização"}
          </option>
          <option value="platform">Plataforma GAI</option>
          {value &&
            value !== "platform" &&
            !data?.items.some((o) => String(o.id) === value) && (
              <option value={value}>
                {currentName || `Organização #${value} (seleção atual)`}
              </option>
            )}
          {data?.items.map((org) => (
            <option key={org.id} value={org.id}>
              {org.trade_name || org.legal_name}
              {org.status === "INACTIVE" ? " — inativa" : ""}
            </option>
          ))}
        </select>
      </FormField>
      {query.isError && (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      )}
      {data && data.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
