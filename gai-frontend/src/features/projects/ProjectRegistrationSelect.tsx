import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectSelectClass } from "./projectFields";

type Props = {
  organizationId?: number;
  resource: "companies" | "users";
  purpose: "create" | "edit" | "filter";
  label: string;
  value: string;
  initialLabel?: string | null;
  onChange: (value: string) => void;
  onLabelChange?: (label: string) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};
export function ProjectRegistrationSelect({
  organizationId,
  resource,
  purpose,
  label,
  value,
  initialLabel,
  onChange,
  onLabelChange,
  ...control
}: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const term = useDeferredValue(search);
  // Undefined organization means the server resolves the authenticated user's scope.
  const query = useQuery({
    queryKey: [
      "projects",
      "options",
      purpose,
      resource,
      organizationId,
      term,
      page,
    ],
    queryFn: () =>
      projectsApi.options(purpose, {
        organization_id: organizationId,
        resource,
        search: term || undefined,
        page,
        page_size: 20,
      }),
    enabled: !control.disabled,
  });
  const selected = useQuery({
    queryKey: [
      "projects",
      "selected-option",
      purpose,
      resource,
      organizationId,
      value,
    ],
    queryFn: () =>
      projectsApi.options(purpose, {
        organization_id: organizationId,
        resource,
        selected_id: Number(value),
      }),
    enabled: !control.disabled && Boolean(value) && !initialLabel,
  });
  const options = [...(query.data?.items ?? [])];
  const selectedOption =
    selected.data?.items[0] ??
    (value && initialLabel ? { id: Number(value), name: initialLabel } : null);
  if (
    selectedOption &&
    !options.some((option) => option.id === selectedOption.id)
  )
    options.unshift(selectedOption);
  return (
    <div className="grid min-w-0 gap-2">
      <Input
        aria-label={`Buscar ${label.toLowerCase()}`}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder={`Buscar ${label.toLowerCase()}`}
        disabled={control.disabled}
      />
      <select
        {...control}
        aria-label={label}
        className={projectSelectClass}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          onLabelChange?.(
            options.find((option) => String(option.id) === event.target.value)
              ?.name ?? "",
          );
        }}
        disabled={control.disabled || query.isLoading || query.isError}
      >
        <option value="">
          {query.isLoading
            ? "Carregando opções..."
            : control.required
              ? "Selecione"
              : "Não definido"}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {query.isError ? (
        <div role="alert" className="text-xs text-destructive">
          Não foi possível carregar as opções.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
      {!query.isLoading && !query.isError && options.length === 0 ? (
        <p className="text-xs font-normal text-muted-foreground">
          Nenhuma opção ativa encontrada.
        </p>
      ) : null}
      {(query.data?.total_pages ?? 0) > 1 ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span>
            Página {page} de {query.data?.total_pages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={
              page >= (query.data?.total_pages ?? 1) || query.isFetching
            }
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
