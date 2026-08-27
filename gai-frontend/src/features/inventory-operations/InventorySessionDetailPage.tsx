import { Ban, CheckCircle2, Eye, Flag, Play, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { normalizePage } from '@/api/pagination';
import { DataTable, type Column } from '@/components/base/DataTable';
import { FilterPanel } from '@/components/base/FilterPanel';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { Pagination } from '@/components/base/Pagination';
import { ErrorState, LoadingState } from '@/components/base/States';
import { StatusBadge } from '@/components/base/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DrawerForm, ModalForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { formatDateTime } from '@/utils/format';
import type {
  ConsolidationDecision,
  InventoryObservation,
  InventoryReconciliation,
  InventoryRound,
  InventoryRoundKind,
  InventoryRoundStatus,
  ReconciliationStatus,
} from '@/types/api';
import { createIdempotencyKey } from './idempotency';
import { getInventoryOperationErrorMessage } from './inventoryOperationErrors';
import { ObservationEvidenceDrawer } from './ObservationEvidenceDrawer';
import {
  useCancelInventorySession,
  useConsolidate,
  useCreateObservation,
  useFinishInventorySession,
  useFinishRound,
  useInventoryObservations,
  useInventoryRounds,
  useInventorySession,
  useReconciliations,
  useRequestReinventory,
  useRunReconciliation,
  useStartInventorySession,
} from './inventoryOperationsQueries';

const initialRoundParams = { page: 1, page_size: 20, status: undefined, type: undefined } as const;
const reconciliationLabels: Record<ReconciliationStatus, string> = { matched: 'Compativel', physical_surplus: 'Sobra fisica', accounting_surplus: 'Sobra contabil', duplicate: 'Duplicidade', plate_divergence: 'Placa divergente' };
const roundKindLabels: Record<InventoryRoundKind, string> = { initial: 'Inicial', reinventory: 'Reinventario' };

export function InventorySessionDetailPage() {
  const projectId = Number(useParams().projectId);
  const sessionId = Number(useParams().sessionId);
  const session = useInventorySession(projectId, sessionId);
  const initialRounds = useInventoryRounds(projectId, sessionId, initialRoundParams);
  const start = useStartInventorySession(projectId, sessionId);
  const finish = useFinishInventorySession(projectId, sessionId);
  const cancel = useCancelInventorySession(projectId, sessionId);
  const [finishingSession, setFinishingSession] = useState(false);
  const [cancellingSession, setCancellingSession] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  if (session.isLoading || initialRounds.isLoading) return <PageContainer><LoadingState label="Carregando sessao e rodadas" /></PageContainer>;
  if (session.isError || !session.data || initialRounds.isError || !initialRounds.data) {
    const error = session.error ?? initialRounds.error;
    return <PageContainer><ErrorState message={getInventoryOperationErrorMessage(error)} onRetry={() => { void session.refetch(); void initialRounds.refetch(); }} /></PageContainer>;
  }

  const item = session.data;
  const initialRoundPage = normalizePage(initialRounds.data);
  const currentRound = initialRoundPage.items.find((round) => round.id === item.current_round_id) ?? null;
  const canCancel = item.status === 'draft' || item.status === 'active';
  const canFinish = item.status === 'active' && item.current_round_id === null;
  const lifecycleError = start.error ?? finish.error ?? cancel.error;

  function confirmCancellation(event: FormEvent) {
    event.preventDefault();
    const reason = cancellationReason.trim();
    if (!reason) return;
    cancel.mutate({ reason }, { onSuccess: () => { setCancellationReason(''); setCancellingSession(false); } });
  }

  return <PageContainer>
    <PageHeader title={item.name} description={`Sessao #${item.id}. Projeto #${projectId}.`} />
    <div className="flex flex-wrap gap-2 border-b pb-3 text-sm"><Link className="text-primary hover:underline" to={`/app/projects/${projectId}/inventory/sessions`}>Sessoes</Link><span className="text-muted-foreground">/ Detalhe</span></div>
    <section className="premium-panel grid gap-3 p-5 sm:grid-cols-4">
      <Info label="Status" value={<StatusBadge value={item.status} />} />
      <Info label="Rodada atual" value={currentRound ? <span className="inline-flex items-center gap-2">Rodada {currentRound.round_number} <StatusBadge value="ATIVA" /></span> : '-'} />
      <Info label="Iniciada em" value={formatDateTime(item.started_at)} />
      <Info label={item.status === 'cancelled' ? 'Cancelada em' : 'Finalizada em'} value={formatDateTime(item.status === 'cancelled' ? item.cancelled_at : item.finished_at)} />
      {item.cancellation_reason ? <div className="sm:col-span-4"><Info label="Motivo do cancelamento" value={item.cancellation_reason} /></div> : null}
    </section>

    <div className="flex flex-wrap gap-2">
      {item.status === 'draft' ? <PermissionGate permissions={['inventory-sessions:update']}><Button disabled={start.isPending} loading={start.isPending} onClick={() => start.mutate(undefined)}><Play size={17} /> Iniciar sessao e rodada 1</Button></PermissionGate> : null}
      {canFinish ? <PermissionGate permissions={['inventory-sessions:update']}><Button onClick={() => setFinishingSession(true)}><Flag size={17} /> Finalizar sessao</Button></PermissionGate> : null}
      {canCancel ? <PermissionGate permissions={['inventory-sessions:update']}><Button variant="danger" onClick={() => setCancellingSession(true)}><Ban size={17} /> Cancelar sessao</Button></PermissionGate> : null}
    </div>
    {lifecycleError ? <ErrorState message={getInventoryOperationErrorMessage(lifecycleError)} /> : null}

    <RoundsSection projectId={projectId} sessionId={sessionId} currentRoundId={item.current_round_id} />
    <ObservationsSection projectId={projectId} sessionId={sessionId} sessionActive={item.status === 'active'} currentRoundId={item.current_round_id} rounds={initialRoundPage.items} />
    <ReconciliationsSection projectId={projectId} sessionId={sessionId} />

    <ConfirmDialog
      open={finishingSession}
      onOpenChange={setFinishingSession}
      title="Finalizar sessao de inventario?"
      description="Depois da finalizacao, novas observacoes, evidencias e reinventarios ficarao indisponiveis conforme as regras do backend."
      busy={finish.isPending}
      onConfirm={() => finish.mutate(undefined, { onSuccess: () => setFinishingSession(false) })}
    />
    <ModalForm open={cancellingSession} onOpenChange={setCancellingSession} title="Cancelar sessao de inventario?">
      <form className="grid gap-4" onSubmit={confirmCancellation}>
        <p className="text-sm text-muted-foreground">O cancelamento e definitivo para a operacao e preserva todo o historico existente.</p>
        <label className="grid gap-1 text-sm font-medium">Motivo do cancelamento<textarea aria-label="Motivo do cancelamento" required maxLength={2000} className="min-h-28 rounded-md border bg-background p-3" value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} /></label>
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button type="button" variant="secondary" disabled={cancel.isPending} onClick={() => setCancellingSession(false)}>Voltar</Button>
          <Button type="submit" variant="danger" loading={cancel.isPending} disabled={!cancellationReason.trim()}>Confirmar cancelamento</Button>
        </div>
      </form>
    </ModalForm>
  </PageContainer>;
}

function RoundsSection({ projectId, sessionId, currentRoundId }: { projectId: number; sessionId: number; currentRoundId: number | null }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InventoryRoundStatus | ''>('');
  const [type, setType] = useState<InventoryRoundKind | ''>('');
  const params = useMemo(() => ({ page, page_size: 20, status: status || undefined, type: type || undefined }), [page, status, type]);
  const query = useInventoryRounds(projectId, sessionId, params);
  const data = query.data ? normalizePage(query.data) : null;
  const columns: Column<InventoryRound>[] = [
    { header: 'Rodada', cell: (item) => <span className="inline-flex items-center gap-2">Rodada {item.round_number} {item.id === currentRoundId ? <StatusBadge value="ATIVA" /> : null}</span> },
    { header: 'Tipo', cell: (item) => roundKindLabels[item.type] },
    { header: 'Status', cell: (item) => <StatusBadge value={item.status} /> },
    { header: 'Inicio', cell: (item) => formatDateTime(item.started_at) },
    { header: 'Termino', cell: (item) => formatDateTime(item.finished_at) },
    { header: 'Motivo', cell: (item) => item.reason || '-' },
    { header: 'Responsavel', cell: (item) => item.requested_by_id ? `#${item.requested_by_id}` : '-' },
  ];
  return <section className="grid gap-4">
    <div><p className="eyebrow">Historico</p><h2 className="mt-2 text-lg font-bold">Rodadas da sessao</h2></div>
    <FilterPanel>
      <select aria-label="Filtrar rodada por status" className="h-10 rounded-md border bg-background px-3" value={status} onChange={(event) => { setStatus(event.target.value as InventoryRoundStatus | ''); setPage(1); }}><option value="">Todos os status</option><option value="active">Ativa</option><option value="finished">Finalizada</option><option value="cancelled">Cancelada</option></select>
      <select aria-label="Filtrar rodada por tipo" className="h-10 rounded-md border bg-background px-3" value={type} onChange={(event) => { setType(event.target.value as InventoryRoundKind | ''); setPage(1); }}><option value="">Todos os tipos</option><option value="initial">Inicial</option><option value="reinventory">Reinventario</option></select>
    </FilterPanel>
    {query.isLoading ? <LoadingState label="Carregando rodadas" /> : query.isError ? <ErrorState message={getInventoryOperationErrorMessage(query.error)} onRetry={() => query.refetch()} /> : data ? <><DataTable columns={columns} items={data.items} getKey={(item) => item.id} /><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /></> : null}
  </section>;
}

function ObservationsSection({ projectId, sessionId, sessionActive, currentRoundId, rounds }: { projectId: number; sessionId: number; sessionActive: boolean; currentRoundId: number | null; rounds: InventoryRound[] }) {
  const [page, setPage] = useState(1);
  const [round, setRound] = useState('');
  const [inventoryItem, setInventoryItem] = useState('');
  const [agent, setAgent] = useState('');
  const [observeOpen, setObserveOpen] = useState(false);
  const [reinventoryOpen, setReinventoryOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [evidenceTarget, setEvidenceTarget] = useState<InventoryObservation | null>(null);
  const params = useMemo(() => ({ page, page_size: 20, round_id: round ? Number(round) : undefined, inventory_item_id: inventoryItem ? Number(inventoryItem) : undefined, field_agent_id: agent ? Number(agent) : undefined }), [agent, inventoryItem, page, round]);
  const query = useInventoryObservations(projectId, sessionId, params);
  const data = query.data ? normalizePage(query.data) : null;
  const finish = useFinishRound(projectId, sessionId);
  const roundNumbers = useMemo(() => new Map(rounds.map((item) => [item.id, item.round_number])), [rounds]);
  const columns: Column<InventoryObservation>[] = [
    { header: 'Item', cell: (item) => `#${item.inventory_item_id}` },
    { header: 'Rodada', cell: (item) => roundNumbers.has(item.round_id) ? `Rodada ${roundNumbers.get(item.round_id)}` : `#${item.round_id}` },
    { header: 'Resultado', cell: (item) => <StatusBadge value={item.result} /> },
    { header: 'Placa observada', cell: (item) => item.observed_plate || '-' },
    { header: 'Serie observada', cell: (item) => item.observed_serial_number || '-' },
    { header: 'Setor', cell: (item) => item.sector_text || '-' },
    { header: 'Localizacao', cell: (item) => item.location_text || '-' },
    { header: 'Agente', cell: (item) => `#${item.field_agent_id}` },
    { header: 'Capturada em', cell: (item) => formatDateTime(item.captured_at) },
    { header: 'Historico', cell: (item) => item.prior_observation_id ? `Anterior #${item.prior_observation_id}` : 'Inventario inicial' },
    { header: 'Evidencias', cell: (item) => <Button type="button" size="sm" variant="secondary" onClick={() => setEvidenceTarget(item)}><Eye size={15} /> Abrir</Button> },
  ];
  return <section className="grid gap-4">
    <div><p className="eyebrow">Operacao</p><h2 className="mt-2 text-lg font-bold">Observacoes</h2><p className="text-sm text-muted-foreground">A placa observada e evidencia de campo e nunca altera automaticamente a placa mestre.</p></div>
    <FilterPanel><input className="h-10 rounded-md border bg-background px-3" aria-label="Filtrar por rodada" inputMode="numeric" placeholder="ID da rodada" value={round} onChange={(event) => { setRound(event.target.value); setPage(1); }} /><input className="h-10 rounded-md border bg-background px-3" aria-label="Filtrar por item" inputMode="numeric" placeholder="ID do item" value={inventoryItem} onChange={(event) => { setInventoryItem(event.target.value); setPage(1); }} /><input className="h-10 rounded-md border bg-background px-3" aria-label="Filtrar por inventariante" inputMode="numeric" placeholder="ID do inventariante" value={agent} onChange={(event) => { setAgent(event.target.value); setPage(1); }} /></FilterPanel>
    {sessionActive ? <div className="flex flex-wrap gap-2">{currentRoundId ? <PermissionGate permissions={['inventory-observations:create']}><Button onClick={() => setObserveOpen(true)}><Plus size={17} /> Adicionar observacao</Button></PermissionGate> : null}<PermissionGate permissions={['inventory-rounds:reinventory']}><Button variant="secondary" onClick={() => setReinventoryOpen(true)}><RefreshCw size={17} /> Solicitar reinventario</Button></PermissionGate>{currentRoundId ? <PermissionGate permissions={['inventory-sessions:update']}><Button variant="secondary" onClick={() => setFinishing(true)}><CheckCircle2 size={17} /> Finalizar rodada atual</Button></PermissionGate> : null}</div> : null}
    {finish.isError ? <ErrorState message={getInventoryOperationErrorMessage(finish.error)} /> : null}
    {query.isLoading ? <LoadingState label="Carregando observacoes" /> : query.isError ? <ErrorState message={getInventoryOperationErrorMessage(query.error)} onRetry={() => query.refetch()} /> : data ? <><DataTable columns={columns} items={data.items} getKey={(item) => item.id} /><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /></> : null}
    <ObservationDrawer projectId={projectId} sessionId={sessionId} roundId={currentRoundId} open={observeOpen} onOpenChange={setObserveOpen} />
    <ReinventoryDrawer projectId={projectId} sessionId={sessionId} open={reinventoryOpen} onOpenChange={setReinventoryOpen} />
    <ConfirmDialog open={finishing} onOpenChange={setFinishing} title="Finalizar rodada" description={`Finalizar a rodada atual #${currentRoundId ?? ''}? Novas observacoes nao serao aceitas nela.`} busy={finish.isPending} onConfirm={() => currentRoundId && finish.mutate(currentRoundId, { onSuccess: () => setFinishing(false) })} />
    <ObservationEvidenceDrawer projectId={projectId} sessionId={sessionId} observation={evidenceTarget} sessionActive={sessionActive} open={Boolean(evidenceTarget)} onOpenChange={(open) => !open && setEvidenceTarget(null)} />
  </section>;
}

function ObservationDrawer({ projectId, sessionId, roundId, open, onOpenChange }: { projectId: number; sessionId: number; roundId: number | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [itemId, setItemId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [result, setResult] = useState('found');
  const [plate, setPlate] = useState('');
  const [serial, setSerial] = useState('');
  const [sector, setSector] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [key, setKey] = useState(() => createIdempotencyKey());
  const mutation = useCreateObservation(projectId, sessionId);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!roundId) return;
    mutation.mutate({ roundId, payload: { inventory_item_id: Number(itemId), field_agent_id: Number(agentId), idempotency_key: key, result: result as 'found', observed_plate: plate || null, observed_serial_number: serial || null, sector_text: sector || null, location_text: location || null, notes: notes || null, captured_at: new Date().toISOString() } }, { onSuccess: () => { setKey(createIdempotencyKey()); onOpenChange(false); } });
  }
  return <DrawerForm open={open} onOpenChange={onOpenChange} title={`Nova observacao - rodada #${roundId ?? '?'}`}><form className="grid gap-3" onSubmit={submit}><NumberField label="Item patrimonial" value={itemId} onChange={setItemId} /><NumberField label="Inventariante" value={agentId} onChange={setAgentId} /><label className="grid gap-1 text-sm font-medium">Resultado<select className="h-10 rounded-md border bg-background px-3" value={result} onChange={(event) => setResult(event.target.value)}><option value="found">Encontrado</option><option value="not_found">Nao encontrado</option><option value="divergent">Divergente</option><option value="duplicated">Duplicado</option></select></label><TextField label="Placa observada (evidencia)" value={plate} onChange={setPlate} maxLength={100} /><TextField label="Serie observada" value={serial} onChange={setSerial} maxLength={100} /><TextField label="Setor informado" value={sector} onChange={setSector} maxLength={255} /><TextField label="Localizacao" value={location} onChange={setLocation} maxLength={2000} /><TextField label="Notas" value={notes} onChange={setNotes} maxLength={4000} />{mutation.isError ? <ErrorState message={getInventoryOperationErrorMessage(mutation.error)} /> : null}<Button disabled={mutation.isPending || !itemId || !agentId || !roundId}>{mutation.isPending ? 'Enviando...' : 'Registrar observacao'}</Button></form></DrawerForm>;
}

function ReinventoryDrawer({ projectId, sessionId, open, onOpenChange }: { projectId: number; sessionId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [itemId, setItemId] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useRequestReinventory(projectId, sessionId);
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate({ inventory_item_id: Number(itemId), reason: reason.trim() }, { onSuccess: () => onOpenChange(false) }); }
  return <DrawerForm open={open} onOpenChange={onOpenChange} title="Solicitar reinventario"><form className="grid gap-3" onSubmit={submit}><NumberField label="Item divergente" value={itemId} onChange={setItemId} /><label className="grid gap-1 text-sm font-medium">Motivo<textarea required maxLength={2000} className="min-h-28 rounded-md border bg-background p-3" value={reason} onChange={(event) => setReason(event.target.value)} /></label>{mutation.isError ? <ErrorState message={getInventoryOperationErrorMessage(mutation.error)} /> : null}<Button disabled={mutation.isPending || !itemId || !reason.trim()}>{mutation.isPending ? 'Solicitando...' : 'Criar nova rodada'}</Button></form></DrawerForm>;
}

function ReconciliationsSection({ projectId, sessionId }: { projectId: number; sessionId: number }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ReconciliationStatus | ''>('');
  const [run, setRun] = useState('');
  const [target, setTarget] = useState<InventoryReconciliation | null>(null);
  const [decision, setDecision] = useState<ConsolidationDecision>('accepted');
  const params = useMemo(() => ({ page, page_size: 20, status, run_number: run ? Number(run) : undefined }), [page, run, status]);
  const query = useReconciliations(projectId, sessionId, params);
  const data = query.data ? normalizePage(query.data) : null;
  const execute = useRunReconciliation(projectId, sessionId);
  const consolidate = useConsolidate(projectId, sessionId);
  const columns: Column<InventoryReconciliation>[] = [{ header: 'Execucao', cell: (item) => `#${item.run_number}` }, { header: 'Data', cell: (item) => formatDateTime(item.created_at) }, { header: 'Resultado', cell: (item) => <span><StatusBadge value={item.status} /> <span className="sr-only">{reconciliationLabels[item.status]}</span></span> }, { header: 'Placa fisica', cell: (item) => item.physical_plate || '-' }, { header: 'Placa contabil', cell: (item) => item.accounting_plate || '-' }, { header: 'Consolidacao', cell: (item) => <PermissionGate permissions={['consolidations:create']}><Button size="sm" variant="secondary" disabled={item.status === 'duplicate'} onClick={() => setTarget(item)}>{item.status === 'duplicate' ? 'Bloqueada: duplicidade' : 'Consolidar'}</Button></PermissionGate> }];
  const operationError = execute.error ?? consolidate.error;
  return <section className="grid gap-4"><div><p className="eyebrow">Processamento</p><h2 className="mt-2 text-lg font-bold">Conciliacoes versionadas</h2></div><FilterPanel><input className="h-10 rounded-md border bg-background px-3" aria-label="Filtrar por execucao" placeholder="Numero da execucao" value={run} onChange={(event) => { setRun(event.target.value); setPage(1); }} /><select aria-label="Filtrar conciliacao por status" className="h-10 rounded-md border bg-background px-3" value={status} onChange={(event) => { setStatus(event.target.value as ReconciliationStatus | ''); setPage(1); }}><option value="">Todos os status</option>{Object.entries(reconciliationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FilterPanel><PermissionGate permissions={['reconciliations:create']}><div><Button disabled={execute.isPending} onClick={() => execute.mutate(undefined)}><RefreshCw size={17} /> {execute.isPending ? 'Executando...' : 'Executar conciliacao'}</Button></div></PermissionGate>{operationError ? <ErrorState message={getInventoryOperationErrorMessage(operationError)} /> : null}{query.isLoading ? <LoadingState label="Carregando conciliacoes" /> : query.isError ? <ErrorState message={getInventoryOperationErrorMessage(query.error)} onRetry={() => query.refetch()} /> : data ? <><DataTable columns={columns} items={data.items} getKey={(item) => item.id} /><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /></> : null}<ConfirmDialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)} title="Consolidar resultado" description={`A consolidacao #${target?.id ?? ''} cria um snapshot imutavel. Decisao: ${decision}.`} busy={consolidate.isPending} onConfirm={() => target && consolidate.mutate({ id: target.id, decision }, { onSuccess: () => setTarget(null) })} />{target ? <label className="grid max-w-xs gap-1 text-sm font-medium">Decisao<select className="h-10 rounded-md border bg-background px-3" value={decision} onChange={(event) => setDecision(event.target.value as ConsolidationDecision)}><option value="accepted">Aceitar</option><option value="corrected">Corrigir</option><option value="rejected">Rejeitar</option></select></label> : null}</section>;
}

function Info({ label, value }: { label: string; value: ReactNode }) { return <div><div className="text-xs font-bold uppercase text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>; }
function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-1 text-sm font-medium">{label}<input required min={1} type="number" className="h-10 rounded-md border bg-background px-3" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function TextField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) { return <label className="grid gap-1 text-sm font-medium">{label}<input maxLength={maxLength} className="h-10 rounded-md border bg-background px-3" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
