import { FileUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { FileUpload } from "@/components/base/Inputs";
import { Button } from "@/components/ui/button";
import { ALLOWED_TYPES, MAX_SIZE_BYTES, formatBytes } from "@/features/finance/ExpenseAttachmentsPanel";
import { reduceImage } from "@/features/finance/reduceImage";

export type PendingReceipt = { key: number; file: File };

/**
 * Despesa nova: os comprovantes escolhidos ficam aqui e são enviados logo depois de lançar a
 * despesa (o arquivo precisa da despesa para ter onde ficar). Mesmas regras do envio pela
 * linha: PDF ou imagem, imagens reduzidas, limite de tamanho e de quantidade dos parâmetros.
 */
export function PendingReceipts({
  value,
  onChange,
  maxBytes,
  maxFiles,
  disabled,
}: {
  value: PendingReceipt[];
  onChange: (value: PendingReceipt[]) => void;
  maxBytes?: number | null;
  maxFiles?: number | null;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const limit = Math.min(maxBytes ?? MAX_SIZE_BYTES, MAX_SIZE_BYTES);
  const full = maxFiles != null && value.length >= maxFiles;

  async function add(original: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(original.type as (typeof ALLOWED_TYPES)[number])) {
      setError("Formato não permitido. Envie PDF, JPEG, PNG ou WEBP.");
      return;
    }
    if (full) {
      setError(`Limite de ${maxFiles} comprovante(s) por despesa (parâmetros financeiros).`);
      return;
    }
    const file = await reduceImage(original);
    if (file.size < 1 || file.size > limit) {
      setError(`O arquivo deve ter até ${formatBytes(limit)}.`);
      return;
    }
    onChange([...value, { key: Date.now() + Math.random(), file }]);
  }

  return (
    <fieldset className="grid gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">Comprovantes</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          PDF ou imagem, até {formatBytes(limit)} por arquivo
          {maxFiles != null ? `, no máximo ${maxFiles}` : ""}. O envio acontece ao lançar a despesa.
        </p>
        <label
          className={`inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium ${disabled || full ? "opacity-60" : "cursor-pointer hover:bg-muted"}`}
        >
          <FileUp size={16} /> Anexar comprovante
          <FileUpload
            aria-label="Anexar comprovante"
            accept={ALLOWED_TYPES.join(",")}
            className="sr-only"
            disabled={disabled || full}
            onFile={(file) => void add(file)}
          />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
      {value.length ? (
        <ul className="grid gap-2">
          {value.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                {item.file.name} <span className="text-xs text-muted-foreground">· {formatBytes(item.file.size)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                className="size-8"
                disabled={disabled}
                aria-label={`Tirar ${item.file.name}`}
                onClick={() => onChange(value.filter((other) => other.key !== item.key))}
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
