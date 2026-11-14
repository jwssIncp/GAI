import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ModalForm } from "@/components/ui/dialog";

export type InlineKind = "text" | "number" | "date" | "select" | "money";

/**
 * Célula editável em linha (doc 06 §5.1 e §6.1): clique para editar; ao
 * confirmar a edição, a tela pede "De/Para" antes de gravar. Esc cancela.
 */
export function InlineEdit({
  label,
  value,
  display,
  kind = "text",
  options,
  disabled,
  format,
  parse,
  onSave,
}: {
  /** Nome do campo, usado na confirmação e no rótulo acessível. */
  label: string;
  /** Valor bruto atual ("" = vazio). */
  value: string;
  /** Como o valor aparece na célula (padrão: o próprio valor). */
  display?: ReactNode;
  kind?: InlineKind;
  options?: Array<{ value: string; label: string }>;
  disabled?: boolean;
  /** Texto do valor na confirmação (ex.: data dd/mm/aaaa, R$). */
  format?: (raw: string) => string;
  /** Converte o texto digitado no valor bruto; retorne null se inválido. */
  parse?: (typed: string) => string | null;
  onSave: (raw: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const show = (raw: string) => (raw === "" ? "(vazio)" : format ? format(raw) : options?.find((o) => o.value === raw)?.label ?? raw);
  /** Na célula, vazio aparece como "—"; "(vazio)" fica só na confirmação De/Para. */
  const cellText = (raw: string) => (raw === "" ? (options?.find((o) => o.value === "")?.label ?? "—") : show(raw));

  const commit = (typed: string) => {
    setEditing(false);
    const raw = parse ? parse(typed) : typed;
    if (raw === null) {
      setError(`${label}: valor inválido.`);
      return;
    }
    if (raw === value) return;
    setError(null);
    // Abre a confirmação depois que o editor fecha e o foco assenta; senão o
    // diálogo recebe o "foco fora" da troca de elemento e fecha sozinho.
    window.setTimeout(() => setPending(raw), 0);
  };

  if (disabled) return <span>{display ?? cellText(value)}</span>;
  return (
    <>
      {editing ? (
        kind === "select" ? (
          <select
            autoFocus
            aria-label={label}
            className="h-8 rounded border bg-background px-1 text-sm"
            value={draft}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          >
            {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            autoFocus
            aria-label={label}
            type={kind === "date" ? "date" : "text"}
            inputMode={kind === "number" || kind === "money" ? "decimal" : undefined}
            className="h-8 w-full min-w-[6rem] rounded border bg-background px-1 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(draft);
              if (e.key === "Escape") setEditing(false);
            }}
          />
        )
      ) : (
        <button
          type="button"
          className="w-full rounded px-1 text-left hover:bg-primary/[0.08] focus:outline-none focus:ring-2 focus:ring-ring"
          title={`Editar ${label.toLowerCase()}`}
          aria-label={`Editar ${label}`}
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
        >
          {display ?? cellText(value)}
        </button>
      )}
      {error ? <span role="alert" className="block text-xs text-destructive">{error}</span> : null}
      {pending !== null ? (
        <ModalForm open onOpenChange={(o) => !o && setPending(null)} title={`Alterar ${label.toLowerCase()}`}>
          <div className="grid gap-4">
            <p className="text-sm">
              De <strong>{show(value)}</strong> para <strong>{show(pending)}</strong>?
            </p>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setPending(null)}>Cancelar</Button>
              <Button
                type="button"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSave(pending);
                    setPending(null);
                    setError(null);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </ModalForm>
      ) : null}
    </>
  );
}
