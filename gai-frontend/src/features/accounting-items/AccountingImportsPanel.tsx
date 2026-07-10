import { AlertTriangle, Eye, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { normalizePage } from '@/api/pagination';
import { FileUpload } from '@/components/base/Inputs';
import { DataTable, type Column } from '@/components/base/DataTable';
import { ErrorState, LoadingState, EmptyState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ModalForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { formatDateTime } from '@/utils/format';
import { validateAccountingImportFile } from './accountingItemSchemas';
import { useAccountingImportErrors, useAccountingImports, useImportAccountingFile } from './accountingItemsQueries';
import type { AccountingImportBatch } from '@/types/api';

export function AccountingImportsPanel({ projectId }: { projectId: number }) {
  const [importOpen, setImportOpen] = useState(false);
  const [errorsBatch, setErrorsBatch] = useState<AccountingImportBatch | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const imports = useAccountingImports(projectId);
  const upload = useImportAccountingFile(projectId);
  const errors = useAccountingImportErrors(projectId, errorsBatch?.id);
  const data = imports.data ? normalizePage(imports.data) : null;

  async function handleFile(file: File) {
    const validation = validateAccountingImportFile(file);
    setFeedback(validation);
    if (validation) return;
    try {
      const batch = await upload.mutateAsync(file);
      setFeedback(`Importacao #${batch.id} registrada com status ${batch.status}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel importar o arquivo.');
    }
  }

  const columns: Column<AccountingImportBatch>[] = [
    { header: 'Arquivo', cell: (batch) => <div className="font-medium">{batch.original_file_name}<div className="text-xs text-muted-foreground">#{batch.id}</div></div> },
    { header: 'Status', cell: (batch) => <StatusBadge value={batch.status} /> },
    { header: 'Linhas', cell: (batch) => `${batch.processed_rows}/${batch.total_rows}` },
    { header: 'Sucesso', cell: (batch) => batch.success_rows },
    { header: 'Falhas', cell: (batch) => batch.failed_rows },
    { header: 'Atualizado em', cell: (batch) => formatDateTime(batch.updated_at) },
    {
      header: 'Acoes',
      cell: (batch) => (
        <PermissionGate permissions={['inventory-accounting-items:export-errors']}>
          <Button type="button" variant="ghost" aria-label="Visualizar erros da importacao" disabled={!batch.failed_rows} onClick={() => setErrorsBatch(batch)}>
            <Eye size={16} />
          </Button>
        </PermissionGate>
      ),
    },
  ];

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Importacoes</h2>
          <p className="text-sm text-muted-foreground">Historico de arquivos XLSX processados pelo backend.</p>
        </div>
        <PermissionGate permissions={['inventory-accounting-items:import']}>
          <Button type="button" onClick={() => setImportOpen(true)}><FileSpreadsheet size={17} /> Importar XLSX</Button>
        </PermissionGate>
      </div>
      {imports.isLoading ? <LoadingState label="Carregando importacoes" /> : imports.isError ? <ErrorState message={(imports.error as Error).message} onRetry={() => imports.refetch()} /> : data?.items.length ? (
        <DataTable columns={columns} items={data.items} getKey={(batch) => batch.id} />
      ) : <EmptyState title="Nenhuma importacao registrada" description="Importe um XLSX para carregar a base contabil do projeto." />}

      <ModalForm open={importOpen} onOpenChange={setImportOpen} title="Importar base contabil XLSX">
        <div className="grid gap-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Colunas esperadas</p>
            <p className="mt-2">placa, descricao_01, descricao_conta_contabil, localizacao, data_aquisicao, valor_aquisicao, cod_base, status, codigo_investor, obs_1, obs_2, placa_nova_inventario, descricao_inventario, localizacao_inventario.</p>
          </div>
          <FileUpload aria-label="Selecionar XLSX contabil" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onFile={handleFile} disabled={upload.isPending} />
          {upload.isPending ? <LoadingState label="Enviando arquivo" /> : null}
          {feedback ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{feedback}</p> : null}
        </div>
      </ModalForm>

      <ModalForm open={Boolean(errorsBatch)} onOpenChange={(open) => !open && setErrorsBatch(null)} title={`Erros da importacao ${errorsBatch ? `#${errorsBatch.id}` : ''}`}>
        {errors.isLoading ? <LoadingState label="Carregando erros" /> : errors.isError ? <ErrorState message={(errors.error as Error).message} /> : errors.data?.items.length ? (
          <div className="grid max-h-[60vh] gap-2 overflow-auto">
            {errors.data.items.map((error) => (
              <div key={`${errorsBatch?.id}-${error.row}`} className="rounded-md border p-3">
                <div className="flex items-center gap-2 font-medium"><AlertTriangle size={16} /> Linha {error.row}</div>
                <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                  {error.errors.map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : <EmptyState title="Sem erros registrados" description="O backend nao retornou erros para este batch." />}
      </ModalForm>
    </section>
  );
}
