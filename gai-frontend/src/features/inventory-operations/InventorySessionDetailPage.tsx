import { CheckCircle2, Play, Plus, RefreshCw } from 'lucide-react';
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
import { ConfirmDialog, DrawerForm } from '@/components/ui/dialog';
import { PermissionGate } from '@/features/auth/PermissionGate';
import { formatDateTime } from '@/utils/format';
import type { ConsolidationDecision, InventoryObservation, InventoryReconciliation, InventoryRound, InventorySessionStartResponse, ReconciliationStatus } from '@/types/api';
import { createIdempotencyKey } from './idempotency';
import { useConsolidate, useCreateObservation, useFinishRound, useInventoryObservations, useInventorySession, useReconciliations, useRequestReinventory, useRunReconciliation, useStartInventorySession } from './inventoryOperationsQueries';

const reconciliationLabels: Record<ReconciliationStatus, string> = { matched: 'Compativel', physical_surplus: 'Sobra fisica', accounting_surplus: 'Sobra contabil', duplicate: 'Duplicidade', plate_divergence: 'Placa divergente' };

export function InventorySessionDetailPage() {
  const projectId = Number(useParams().projectId);
  const sessionId = Number(useParams().sessionId);
  const session = useInventorySession(projectId, sessionId);
  const [activeRoundId, setActiveRoundId] = useState<number | null>(null);
  const start = useStartInventorySession(projectId, sessionId);
  if (session.isLoading) return <PageContainer><LoadingState label="Carregando sessao" /></PageContainer>;
  if (session.isError || !session.data) return <PageContainer><ErrorState message={(session.error as Error)?.message} onRetry={() => session.refetch()} /></PageContainer>;
  const item = session.data;
  return <PageContainer>
    <PageHeader title={item.name} description={`Sessao #${item.id}. Projeto #${projectId}.`} />
    <div className="flex flex-wrap gap-2 border-b pb-3 text-sm"><Link className="text-primary hover:underline" to={`/app/projects/${projectId}/inventory/sessions`}>Sessoes</Link><span className="text-muted-foreground">/ Detalhe</span></div>
    <section className="premium-panel grid gap-3 p-5 sm:grid-cols-4"><Info label="Status" value={<StatusBadge value={item.status} />} /><Info label="Criada em" value={formatDateTime(item.created_at)} /><Info label="Iniciada em" value={formatDateTime(item.started_at)} /><Info label="Finalizada em" value={formatDateTime(item.finished_at)} /></section>
    {item.status === 'draft' ? <PermissionGate permissions={['inventory-sessions:update']}><div><Button disabled={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: (data) => setActiveRoundId((data as InventorySessionStartResponse).round.id) })}><Play size={17} /> {start.isPending ? 'Iniciando...' : 'Iniciar sessao e rodada 1'}</Button></div></PermissionGate> : null}
    {start.isError ? <ErrorState message={(start.error as Error).message} /> : null}
    {item.status === 'active' && !activeRoundId ? <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm"><strong>Rodada atual indisponivel apos recarregar.</strong> Consulte as observacoes abaixo para recuperar IDs de rodadas existentes. O backend ainda nao oferece listagem de rodadas.</div> : null}
    <ObservationsSection projectId={projectId} sessionId={sessionId} sessionActive={item.status === 'active'} activeRoundId={activeRoundId} onRoundAvailable={setActiveRoundId} />
    <ReconciliationsSection projectId={projectId} sessionId={sessionId} />
  </PageContainer>;
}

function ObservationsSection({ projectId, sessionId, sessionActive, activeRoundId, onRoundAvailable }: { projectId: number; sessionId: number; sessionActive: boolean; activeRoundId: number | null; onRoundAvailable: (id: number) => void }) {
  const [page, setPage] = useState(1); const [round, setRound] = useState(''); const [inventoryItem, setInventoryItem] = useState(''); const [agent, setAgent] = useState('');
  const [observeOpen, setObserveOpen] = useState(false); const [reinventoryOpen, setReinventoryOpen] = useState(false); const [finishing, setFinishing] = useState(false);
  const params = useMemo(() => ({ page, page_size: 20, round_id: round ? Number(round) : undefined, inventory_item_id: inventoryItem ? Number(inventoryItem) : undefined, field_agent_id: agent ? Number(agent) : undefined }), [agent, inventoryItem, page, round]);
  const query = useInventoryObservations(projectId, sessionId, params); const data = query.data ? normalizePage(query.data) : null;
  const finish = useFinishRound(projectId, sessionId);
  const latestRoundId = activeRoundId ?? (data?.items.reduce((max, value) => Math.max(max, value.round_id), 0) || null);
  const columns: Column<InventoryObservation>[] = [
    { header: 'Item', cell: (item) => `#${item.inventory_item_id}` }, { header: 'Rodada', cell: (item) => `#${item.round_id}` }, { header: 'Resultado', cell: (item) => <StatusBadge value={item.result} /> },
    { header: 'Placa observada (evidencia)', cell: (item) => item.observed_plate || '-' }, { header: 'Serie observada', cell: (item) => item.observed_serial_number || '-' },
    { header: 'Setor informado', cell: (item) => item.sector_text || '-' }, { header: 'Localizacao', cell: (item) => item.location_text || '-' }, { header: 'Capturada em', cell: (item) => formatDateTime(item.captured_at) },
    { header: 'Historico', cell: (item) => item.prior_observation_id ? `Anterior #${item.prior_observation_id}` : 'Inventario inicial' },
  ];
  return <section className="grid gap-4"><div><p className="eyebrow">Operacao</p><h2 className="mt-2 text-lg font-bold">Rodadas e observacoes</h2><p className="text-sm text-muted-foreground">A placa observada e evidencia de campo e nunca altera automaticamente a placa mestre.</p></div>
    <FilterPanel><input className="h-10 rounded-md border bg-background px-3" aria-label="Filtrar por rodada" inputMode="numeric" placeholder="ID da rodada" value={round} onChange={(e) => { setRound(e.target.value); setPage(1); }} /><input className="h-10 rounded-md border bg-background px-3" aria-label="Filtrar por item" inputMode="numeric" placeholder="ID do item" value={inventoryItem} onChange={(e) => { setInventoryItem(e.target.value); setPage(1); }} /><input className="h-10 rounded-md border bg-background px-3" aria-label="Filtrar por inventariante" inputMode="numeric" placeholder="ID do inventariante" value={agent} onChange={(e) => { setAgent(e.target.value); setPage(1); }} /></FilterPanel>
    {sessionActive ? <div className="flex flex-wrap gap-2"><PermissionGate permissions={['inventory-observations:create']}><Button disabled={!latestRoundId} onClick={() => setObserveOpen(true)}><Plus size={17} /> Adicionar observacao</Button></PermissionGate><PermissionGate permissions={['inventory-rounds:reinventory']}><Button variant="secondary" onClick={() => setReinventoryOpen(true)}><RefreshCw size={17} /> Solicitar reinventario</Button></PermissionGate><PermissionGate permissions={['inventory-sessions:update']}><Button variant="secondary" disabled={!latestRoundId} onClick={() => setFinishing(true)}><CheckCircle2 size={17} /> Finalizar rodada</Button></PermissionGate></div> : null}
    {query.isLoading ? <LoadingState label="Carregando observacoes" /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : data ? <><DataTable columns={columns} items={data.items} getKey={(item) => item.id} /><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /></> : null}
    <ObservationDrawer projectId={projectId} sessionId={sessionId} roundId={latestRoundId} open={observeOpen} onOpenChange={setObserveOpen} />
    <ReinventoryDrawer projectId={projectId} sessionId={sessionId} open={reinventoryOpen} onOpenChange={setReinventoryOpen} onCreated={onRoundAvailable} />
    <ConfirmDialog open={finishing} onOpenChange={setFinishing} title="Finalizar rodada" description={`Finalizar a rodada #${latestRoundId ?? ''}? Novas observacoes nao serao aceitas nela.`} onConfirm={() => latestRoundId && finish.mutate(latestRoundId, { onSuccess: () => setFinishing(false) })} />
  </section>;
}

function ObservationDrawer({ projectId, sessionId, roundId, open, onOpenChange }: { projectId: number; sessionId: number; roundId: number | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [itemId, setItemId] = useState(''); const [agentId, setAgentId] = useState(''); const [result, setResult] = useState('found'); const [plate, setPlate] = useState(''); const [sector, setSector] = useState(''); const [location, setLocation] = useState(''); const [notes, setNotes] = useState('');
  const [key, setKey] = useState(() => createIdempotencyKey()); const mutation = useCreateObservation(projectId, sessionId);
  function submit(event: FormEvent) { event.preventDefault(); if (!roundId) return; mutation.mutate({ roundId, payload: { inventory_item_id: Number(itemId), field_agent_id: Number(agentId), idempotency_key: key, result: result as 'found', observed_plate: plate || null, sector_text: sector || null, location_text: location || null, notes: notes || null, captured_at: new Date().toISOString() } }, { onSuccess: () => { setKey(createIdempotencyKey()); onOpenChange(false); } }); }
  return <DrawerForm open={open} onOpenChange={onOpenChange} title={`Nova observacao - rodada #${roundId ?? '?'}`}><form className="grid gap-3" onSubmit={submit}><NumberField label="Item patrimonial" value={itemId} onChange={setItemId} /><NumberField label="Inventariante" value={agentId} onChange={setAgentId} /><label className="grid gap-1 text-sm font-medium">Resultado<select className="h-10 rounded-md border bg-background px-3" value={result} onChange={(e) => setResult(e.target.value)}><option value="found">Encontrado</option><option value="not_found">Nao encontrado</option><option value="divergent">Divergente</option><option value="duplicated">Duplicado</option></select></label><TextField label="Placa observada (evidencia)" value={plate} onChange={setPlate} maxLength={100} /><TextField label="Setor informado" value={sector} onChange={setSector} maxLength={255} /><TextField label="Localizacao" value={location} onChange={setLocation} maxLength={2000} /><TextField label="Notas" value={notes} onChange={setNotes} maxLength={4000} />{mutation.isError ? <ErrorState message={(mutation.error as Error).message} /> : null}<Button disabled={mutation.isPending || !itemId || !agentId || !roundId}>{mutation.isPending ? 'Enviando...' : 'Registrar evidencia'}</Button></form></DrawerForm>;
}

function ReinventoryDrawer({ projectId, sessionId, open, onOpenChange, onCreated }: { projectId: number; sessionId: number; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: number) => void }) {
  const [itemId, setItemId] = useState(''); const [reason, setReason] = useState(''); const mutation = useRequestReinventory(projectId, sessionId);
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate({ inventory_item_id: Number(itemId), reason: reason.trim() }, { onSuccess: (data) => { onCreated((data as InventoryRound).id); onOpenChange(false); } }); }
  return <DrawerForm open={open} onOpenChange={onOpenChange} title="Solicitar reinventario"><form className="grid gap-3" onSubmit={submit}><NumberField label="Item divergente" value={itemId} onChange={setItemId} /><label className="grid gap-1 text-sm font-medium">Motivo<textarea required maxLength={2000} className="min-h-28 rounded-md border bg-background p-3" value={reason} onChange={(e) => setReason(e.target.value)} /></label>{mutation.isError ? <ErrorState message={(mutation.error as Error).message} /> : null}<Button disabled={mutation.isPending || !itemId || !reason.trim()}>{mutation.isPending ? 'Solicitando...' : 'Criar nova rodada'}</Button></form></DrawerForm>;
}

function ReconciliationsSection({ projectId, sessionId }: { projectId: number; sessionId: number }) {
  const [page, setPage] = useState(1); const [status, setStatus] = useState<ReconciliationStatus | ''>(''); const [run, setRun] = useState(''); const [target, setTarget] = useState<InventoryReconciliation | null>(null); const [decision, setDecision] = useState<ConsolidationDecision>('accepted');
  const params = useMemo(() => ({ page, page_size: 20, status, run_number: run ? Number(run) : undefined }), [page, run, status]); const query = useReconciliations(projectId, sessionId, params); const data = query.data ? normalizePage(query.data) : null; const execute = useRunReconciliation(projectId, sessionId); const consolidate = useConsolidate(projectId, sessionId);
  const columns: Column<InventoryReconciliation>[] = [{ header: 'Execucao', cell: (item) => `#${item.run_number}` }, { header: 'Data', cell: (item) => formatDateTime(item.created_at) }, { header: 'Resultado', cell: (item) => <span><StatusBadge value={item.status} /> <span className="sr-only">{reconciliationLabels[item.status]}</span></span> }, { header: 'Placa fisica', cell: (item) => item.physical_plate || '-' }, { header: 'Placa contabil', cell: (item) => item.accounting_plate || '-' }, { header: 'Consolidacao', cell: (item) => <PermissionGate permissions={['consolidations:create']}><Button size="sm" variant="secondary" disabled={item.status === 'duplicate'} onClick={() => setTarget(item)}>{item.status === 'duplicate' ? 'Bloqueada: duplicidade' : 'Consolidar'}</Button></PermissionGate> }];
  return <section className="grid gap-4"><div><p className="eyebrow">Processamento</p><h2 className="mt-2 text-lg font-bold">Conciliacoes versionadas</h2></div><FilterPanel><input className="h-10 rounded-md border bg-background px-3" aria-label="Filtrar por execucao" placeholder="Numero da execucao" value={run} onChange={(e) => { setRun(e.target.value); setPage(1); }} /><select aria-label="Filtrar conciliacao por status" className="h-10 rounded-md border bg-background px-3" value={status} onChange={(e) => { setStatus(e.target.value as ReconciliationStatus | ''); setPage(1); }}><option value="">Todos os status</option>{Object.entries(reconciliationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FilterPanel><PermissionGate permissions={['reconciliations:create']}><div><Button disabled={execute.isPending} onClick={() => execute.mutate(undefined)}><RefreshCw size={17} /> {execute.isPending ? 'Executando...' : 'Executar conciliacao'}</Button></div></PermissionGate>{execute.isError ? <ErrorState message={(execute.error as Error).message} /> : null}{query.isLoading ? <LoadingState label="Carregando conciliacoes" /> : query.isError ? <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /> : data ? <><DataTable columns={columns} items={data.items} getKey={(item) => item.id} /><Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /></> : null}<ConfirmDialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)} title="Consolidar resultado" description={`A consolidacao #${target?.id ?? ''} cria um snapshot imutavel. Decisao: ${decision}.`} onConfirm={() => target && consolidate.mutate({ id: target.id, decision }, { onSuccess: () => setTarget(null) })} />{target ? <label className="grid max-w-xs gap-1 text-sm font-medium">Decisao<select className="h-10 rounded-md border bg-background px-3" value={decision} onChange={(e) => setDecision(e.target.value as ConsolidationDecision)}><option value="accepted">Aceitar</option><option value="corrected">Corrigir</option><option value="rejected">Rejeitar</option></select></label> : null}</section>;
}

function Info({ label, value }: { label: string; value: ReactNode }) { return <div><div className="text-xs font-bold uppercase text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>; }
function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-1 text-sm font-medium">{label}<input required min={1} type="number" className="h-10 rounded-md border bg-background px-3" value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function TextField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) { return <label className="grid gap-1 text-sm font-medium">{label}<input maxLength={maxLength} className="h-10 rounded-md border bg-background px-3" value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
