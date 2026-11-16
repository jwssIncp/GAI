import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/utils/cn";

/** Uma opção do seletor: o rótulo nunca é o ID (nome e, quando houver, o código entre parênteses). */
export type EntityOption = { id: number; label: string; description?: string | null };

/**
 * Fonte de uma entidade: busca paginada no servidor (ou no cliente, quando o
 * endpoint não filtra por texto) e, opcionalmente, a leitura de um ID para
 * mostrar o rótulo de um valor inicial (vindo da URL ou de um registro).
 */
export type EntitySource<C = Record<string, unknown>> = {
  /** Base da chave do cache (ex.: "companies"). */
  key: string;
  search: (q: { search: string; page: number; context: C }) => Promise<{ items: EntityOption[]; hasMore: boolean }>;
  one?: (id: number, context: C) => Promise<EntityOption | null>;
};

type Props<C> = {
  /** Fonte da entidade (ver `entitySources`). */
  source: EntitySource<C>;
  /** Valor controlado (ID) ou, sem ele, valor inicial do modo não controlado. */
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (id: number | null, option?: EntityOption) => void;
  /** Filtro de contexto (ex.: { project_id }); entra na chave do cache e na busca. */
  context?: C;
  /** Sem contexto, fica desabilitado e explica (ex.: "Escolha o projeto primeiro"). */
  requiresContext?: string | false;
  /** Gera <input type="hidden" name=…> para formulários lidos com FormData. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Nome acessível quando não há <label> (ex.: filtros). */
  "aria-label"?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
};

/**
 * Seleção com busca pelo nome (combobox WAI-ARIA): digita, a lista filtra no
 * servidor (com espera de 300 ms) e mostra "nome (código)"; setas, Enter, Esc,
 * Home e End navegam. Um componente só para projeto, cliente, contrato,
 * aditivo, inventariante, item, sessão, usuário etc.
 */
export function EntityCombobox<C extends Record<string, unknown> = Record<string, unknown>>({
  source,
  value,
  defaultValue = null,
  onChange,
  context = {} as C,
  requiresContext = false,
  name,
  required,
  disabled,
  placeholder = "Digite para buscar…",
  className,
  ...aria
}: Props<C>) {
  const generated = useId();
  const inputId = aria.id ?? `${generated}-input`;
  const listId = `${generated}-list`;
  const controlled = value !== undefined;
  const [inner, setInner] = useState<number | null>(defaultValue);
  const selectedId = controlled ? (value ?? null) : inner;
  const [picked, setPicked] = useState<EntityOption | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [pages, setPages] = useState(1);
  const search = useDebouncedValue(text, 300);
  const contextKey = JSON.stringify(context);
  const missingContext = Boolean(requiresContext) && Object.values(context).some((v) => v === null || v === undefined || v === "");
  const off = disabled || missingContext;
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // Obrigatório: o navegador barra o envio sem uma escolha da lista (o ID vai
  // no campo oculto, que o navegador não valida).
  useEffect(() => {
    input.current?.setCustomValidity(required && !selectedId ? "Escolha um item da lista." : "");
  }, [required, selectedId]);

  useEffect(() => setPages(1), [search, contextKey]);

  const list = useQuery({
    queryKey: [source.key, "options", contextKey, search, pages],
    queryFn: async () => {
      const all: EntityOption[] = [];
      let more = false;
      for (let page = 1; page <= pages; page++) {
        const r = await source.search({ search, page, context });
        for (const o of r.items) if (!all.some((x) => x.id === o.id)) all.push(o);
        more = r.hasMore;
        if (!more) break;
      }
      return { items: all, hasMore: more };
    },
    enabled: open && !off,
    staleTime: 30_000,
  });
  // Rótulo do valor atual (inicial, da URL ou de um registro) quando não está na página carregada.
  const known = useMemo(
    () => (picked?.id === selectedId ? picked : (list.data?.items.find((o) => o.id === selectedId) ?? null)),
    [picked, selectedId, list.data],
  );
  const one = useQuery({
    queryKey: [source.key, "one", selectedId, contextKey],
    queryFn: () => source.one!(selectedId!, context),
    enabled: Boolean(selectedId && !known && source.one),
    staleTime: 60_000,
  });
  const current = known ?? one.data ?? null;
  const items = list.data?.items ?? [];

  const choose = (option: EntityOption | null) => {
    setPicked(option);
    if (!controlled) setInner(option?.id ?? null);
    onChange?.(option?.id ?? null, option ?? undefined);
    setText("");
    setOpen(false);
  };

  // A lista vai para o <body> (posição fixa sob o campo): painéis com overflow
  // escondido (filtros, diálogos) não a cortam.
  const listRef = useRef<HTMLUListElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});
  // Dentro de um diálogo modal (que prende foco e cliques), a lista fica junto
  // ao campo, como antes; fora dele, vai para o <body>.
  const [inDialog, setInDialog] = useState(false);
  useLayoutEffect(() => {
    setInDialog(Boolean(box.current?.closest('[role="dialog"]')));
  }, []);
  useLayoutEffect(() => {
    if (!open || inDialog) return;
    const update = () => {
      const r = input.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const up = below < 200 && r.top > below;
      setPlace({
        position: "fixed",
        left: r.left,
        width: Math.max(r.width, 220),
        ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
        maxHeight: Math.max(160, Math.min(288, (up ? r.top : below) - 12)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, inDialog]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (box.current && !box.current.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(Math.max(items.length - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (items[active]) choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setText("");
    }
  };

  // Valor sem rótulo resolvido (ex.: falta o contexto para ler o nome): nunca mostra o ID.
  const portal = (node: React.ReactNode) => (inDialog ? node : createPortal(node, document.body));
  const shown = open ? text : current ? current.label : selectedId ? (one.isFetching ? "Carregando…" : "Selecionado") : "";
  return (
    <div ref={box} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={selectedId ?? ""} /> : null}
      <div className="flex items-center gap-1">
        <input
          ref={input}
          id={inputId}
          required={required}
          role="combobox"
          aria-label={aria["aria-label"]}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${items[active].id}` : undefined}
          aria-required={required || undefined}
          autoComplete="off"
          disabled={off}
          placeholder={missingContext && typeof requiresContext === "string" ? requiresContext : placeholder}
          title={current?.label}
          className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          value={shown}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKey}
        />
        {selectedId && !required && !off ? (
          <button
            type="button"
            className="h-10 shrink-0 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
            aria-label={`Limpar ${aria["aria-label"] ?? "seleção"}`}
            onClick={() => choose(null)}
          >
            Limpar
          </button>
        ) : null}
      </div>
      {open && !off ? portal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={aria["aria-label"]}
          style={inDialog ? undefined : place}
          className={cn(
            "overflow-y-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg",
            inDialog ? "absolute z-50 mt-1 max-h-72 w-full" : "z-[1000]",
          )}
        >
          {items.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={o.id === selectedId}
              className={cn(
                "cursor-pointer rounded px-2 py-1.5",
                i === active ? "bg-accent text-accent-foreground" : "",
                o.id === selectedId ? "font-semibold" : "",
              )}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
            >
              <span className="block truncate" title={o.label}>
                {o.label}
              </span>
              {o.description ? <span className="block truncate text-xs text-muted-foreground">{o.description}</span> : null}
            </li>
          ))}
          <li role="presentation" aria-live="polite" className="px-2 py-1.5 text-xs text-muted-foreground">
            {list.isFetching
              ? "Buscando…"
              : list.isError
                ? "Não foi possível buscar. Tente de novo."
                : !items.length
                  ? "Nenhum resultado."
                  : null}
          </li>
          {list.data?.hasMore && !list.isFetching ? (
            <li role="presentation">
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left text-xs text-primary-text hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setPages((p) => p + 1);
                }}
              >
                Carregar mais
              </button>
            </li>
          ) : null}
        </ul>,
      ) : null}
    </div>
  );
}
