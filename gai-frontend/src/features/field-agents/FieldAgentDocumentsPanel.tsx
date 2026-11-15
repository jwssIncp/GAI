import { Download, FileUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { fieldAgentsApi } from "@/api/endpoints";
import { FileUpload } from "@/components/base/Inputs";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PermissionGate } from "@/features/auth/PermissionGate";
import { formatDateTime } from "@/utils/format";
import type { FieldAgentDocument } from "@/types/api";
import {
  useFieldAgentDocuments,
  useRemoveFieldAgentDocument,
  useUploadFieldAgentDocument,
} from "./fieldAgentsQueries";

const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/** Documentos anexados ao cadastro do inventariante (vários arquivos; baixar e remover). */
export function FieldAgentDocumentsPanel({ fieldAgentId }: { fieldAgentId: number }) {
  const [feedback, setFeedback] = useState<{ error?: boolean; message: string } | null>(null);
  const [removing, setRemoving] = useState<FieldAgentDocument | null>(null);
  const documents = useFieldAgentDocuments(fieldAgentId);
  const upload = useUploadFieldAgentDocument(fieldAgentId);
  const remove = useRemoveFieldAgentDocument(fieldAgentId);

  async function handleFile(file: File) {
    setFeedback(null);
    try {
      await upload.mutateAsync(file);
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
            PDF ou imagem. O limite por arquivo vem dos parâmetros financeiros.
          </p>
        </div>
        <PermissionGate permissions={["field-agent-documents:upload"]}>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            <FileUp size={16} /> {upload.isPending ? "Enviando..." : "Anexar documento"}
            <FileUpload
              aria-label="Anexar documento"
              accept={ACCEPTED}
              className="sr-only"
              onFile={handleFile}
              disabled={upload.isPending}
            />
          </label>
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
                  {formatBytes(document.size_bytes)} · {formatDateTime(document.created_at)}
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
