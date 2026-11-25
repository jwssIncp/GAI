import { Download, FileUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { fieldAgentsApi } from "@/api/endpoints";
import { FileUpload } from "@/components/base/Inputs";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PermissionGate } from "@/features/auth/PermissionGate";
import { formatDateTime } from "@/utils/format";
import type { FieldAgentDocument, FieldAgentDocumentCategory } from "@/types/api";
import {
  ACCEPTED_DOCUMENTS,
  DOCUMENT_CATEGORIES,
  documentCategoryLabel,
  formatBytes,
} from "./fieldAgentDocuments";
import {
  useFieldAgentDocuments,
  useRemoveFieldAgentDocument,
  useUploadFieldAgentDocument,
} from "./fieldAgentsQueries";

function CategorySelect({
  value,
  onChange,
  label,
  disabled,
}: {
  value: FieldAgentDocumentCategory;
  onChange: (value: FieldAgentDocumentCategory) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      disabled={disabled}
      className="h-9 rounded-md border bg-background px-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as FieldAgentDocumentCategory)}
    >
      {DOCUMENT_CATEGORIES.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

export type PendingDocument = { key: number; file: File; category: FieldAgentDocumentCategory };

/**
 * Cadastro novo: os documentos escolhidos ficam aqui até o inventariante ser salvo e então
 * são enviados (o arquivo precisa do cadastro para ter onde ficar).
 */
export function PendingDocumentsPicker({
  value,
  onChange,
  disabled,
}: {
  value: PendingDocument[];
  onChange: (value: PendingDocument[]) => void;
  disabled?: boolean;
}) {
  const [category, setCategory] = useState<FieldAgentDocumentCategory>("registration_form");
  return (
    <section className="grid gap-3" aria-labelledby="field-agent-pending-documents-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="field-agent-pending-documents-title" className="font-semibold">
            Documentos anexados
          </h3>
          <p className="text-sm text-muted-foreground">
            Ficha cadastral, CNH, exames, certificados etc. PDF ou imagem; o envio acontece ao salvar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CategorySelect label="Tipo do documento" value={category} onChange={setCategory} disabled={disabled} />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            <FileUp size={16} /> Anexar documento
            <FileUpload
              aria-label="Anexar documento"
              accept={ACCEPTED_DOCUMENTS}
              className="sr-only"
              disabled={disabled}
              onFile={(file) => onChange([...value, { key: Date.now() + Math.random(), file, category }])}
            />
          </label>
        </div>
      </div>
      {value.length ? (
        <ul className="grid gap-2">
          {value.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)} · a enviar</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <CategorySelect
                  label={`Tipo de ${item.file.name}`}
                  value={item.category}
                  disabled={disabled}
                  onChange={(next) =>
                    onChange(value.map((other) => (other.key === item.key ? { ...other, category: next } : other)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Tirar ${item.file.name}`}
                  onClick={() => onChange(value.filter((other) => other.key !== item.key))}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum documento escolhido.</p>
      )}
    </section>
  );
}

/** Documentos anexados ao cadastro do inventariante (vários arquivos; baixar e remover). */
export function FieldAgentDocumentsPanel({ fieldAgentId }: { fieldAgentId: number }) {
  const [feedback, setFeedback] = useState<{ error?: boolean; message: string } | null>(null);
  const [removing, setRemoving] = useState<FieldAgentDocument | null>(null);
  const [category, setCategory] = useState<FieldAgentDocumentCategory>("registration_form");
  const documents = useFieldAgentDocuments(fieldAgentId);
  const upload = useUploadFieldAgentDocument(fieldAgentId);
  const remove = useRemoveFieldAgentDocument(fieldAgentId);

  async function handleFile(file: File) {
    setFeedback(null);
    try {
      await upload.mutateAsync({ file, category });
      setFeedback({ message: `${file.name} anexado.` });
    } catch (error) {
      setFeedback({
        error: true,
        message: error instanceof Error ? error.message : "Não foi possível anexar o documento.",
      });
    }
  }

  async function download(document: FieldAgentDocument) {
    setFeedback(null);
    try {
      const { download_url } = await fieldAgentsApi.documentDownloadUrl(fieldAgentId, document.id);
      window.open(download_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setFeedback({
        error: true,
        message: error instanceof Error ? error.message : "Não foi possível baixar o documento.",
      });
    }
  }

  return (
    <section className="grid gap-3" aria-labelledby="field-agent-documents-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="field-agent-documents-title" className="font-semibold">
            Documentos anexados
          </h3>
          <p className="text-sm text-muted-foreground">
            Ficha cadastral, CNH, exames, certificados etc. PDF ou imagem; o limite por arquivo
            vem dos parâmetros financeiros.
          </p>
        </div>
        <PermissionGate permissions={["field-agent-documents:upload"]}>
          <div className="flex flex-wrap items-center gap-2">
          <CategorySelect
            label="Tipo do documento"
            value={category}
            onChange={setCategory}
            disabled={upload.isPending}
          />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            <FileUp size={16} /> {upload.isPending ? "Enviando..." : "Anexar documento"}
            <FileUpload
              aria-label="Anexar documento"
              accept={ACCEPTED_DOCUMENTS}
              className="sr-only"
              onFile={handleFile}
              disabled={upload.isPending}
            />
          </label>
          </div>
        </PermissionGate>
      </div>
      {feedback ? (
        <p
          role={feedback.error ? "alert" : "status"}
          className={`rounded-md px-3 py-2 text-sm ${feedback.error ? "border text-destructive" : "bg-muted text-muted-foreground"}`}
        >
          {feedback.message}
        </p>
      ) : null}
      {documents.isLoading ? (
        <LoadingState label="Carregando documentos" />
      ) : documents.isError ? (
        <ErrorState
          message={(documents.error as Error).message}
          onRetry={() => void documents.refetch()}
        />
      ) : documents.data?.length ? (
        <ul className="grid gap-2">
          {documents.data.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{document.original_name}</p>
                <p className="text-xs text-muted-foreground">
                  {documentCategoryLabel(document.category)} · {formatBytes(document.size_bytes)} ·{" "}
                  {formatDateTime(document.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Baixar ${document.original_name}`}
                  onClick={() => void download(document)}
                >
                  <Download size={16} />
                </Button>
                <PermissionGate permissions={["field-agent-documents:remove"]}>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remover ${document.original_name}`}
                    onClick={() => setRemoving(document)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </PermissionGate>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remover documento"
        description={`Remover ${removing?.original_name ?? "o documento"} do cadastro? A remoção fica registrada no histórico.`}
        busy={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.id, {
            onSuccess: () => {
              setRemoving(null);
              setFeedback({ message: "Documento removido." });
            },
            onError: (error) => {
              setRemoving(null);
              setFeedback({ error: true, message: error.message });
            },
          });
        }}
      />
    </section>
  );
}
