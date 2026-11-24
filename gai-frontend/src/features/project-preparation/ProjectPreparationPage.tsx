import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { navigationHref } from '@/features/projects/navigationContext';
import { DataPanel, DataPanelFilters, ViewToggle } from '@/components/base/DataPanel';
import { DataTable } from '@/components/base/DataTable';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { ProgressCard } from '@/components/base/Cards';
import { Tabs } from '@/components/base/Tabs';
import { Button } from '@/components/ui/button';
import { DrawerForm, ModalForm } from '@/components/ui/dialog';
import { usePermissions } from '@/features/auth/usePermissions';
import { saveBlob } from '@/features/expenses/expensesApi';
import { canMutateProjectOperations } from '@/features/projects/projectLifecycle';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime } from '@/utils/format';
import { userLabel } from '@/utils/userName';
import {
  AnswerForm,
  CreatePreparationForm,
  EditPreparationForm,
} from './PreparationForms';
import { TemplateManager } from './TemplateManager';
import { PreparationActionDialog, type PreparationAction } from './PreparationActionDialog';
import {
  preparationApi,
  preparationKeys,
  usePreparation,
  usePreparationContext,
  usePreparationMutation,
  usePreparations,
  usePreparationTemplates,
} from './preparationQueries';
import {
  kindLabels,
  statusLabels,
  type AnswerPayload,
  type Preparation,
  type PreparationAnswer,
  type PreparationContext,
  type PreparationKind,
  type PreparationQuestion,
} from './preparationTypes';
import { questionGroupTags, requestAtKickoff } from './referenceTemplates';
import './preparation.css';

const listTitles: Record<PreparationKind, string> = {
  kickoff: 'Kick-offs',
  client_checklist: 'Checklists do cliente',
};
const newLabels: Record<PreparationKind, string> = {
  kickoff: 'Novo kick-off',
  client_checklist: 'Novo checklist',
};
/** Em andamento primeiro, como no sistema anterior; depois concluídos e arquivados. */
const statusOrder: Record<Preparation['status'], number> = {
  in_progress: 0,
  draft: 1,
  approved: 2,
  archived: 3,
};

/** Situação na lista, no vocabulário do sistema anterior. */
const listSituation: Record<Preparation['status'], { label: string; tone: string }> = {
  draft: { label: 'Em andamento', tone: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' },
  in_progress: { label: 'Em andamento', tone: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' },
  approved: { label: 'Concluída', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100' },
  archived: { label: 'Arquivada', tone: 'bg-muted text-muted-foreground' },
};

/** Busca sem acento e sem diferenciar maiúsculas ("sao paulo" acha "São Paulo"). */
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

/** "X de Y (Z%)": respondidas (concluídas + não aplicáveis) sobre as perguntas habilitadas. */
function progressLabel(item: Preparation) {
  const done = item.progress.completed + item.progress.not_applicable;
  return `${done} de ${item.progress.total} (${item.progress.percent}%)`;
}

export function ProjectPreparationPage() {
  const location = useLocation();
  const params = useParams();
  const projectId = Number(params.projectId);
  const kind: PreparationKind =
    params.kind === 'client-checklist' ? 'client_checklist' : 'kickoff';
  const permissions = usePermissions();
  const context = usePreparationContext(projectId);
  const list = usePreparations(projectId);
  const templates = usePreparationTemplates(
    context.data?.project.organization_id,
  );
  const [selected, setSelected] = useState<number>();
  const [createOpen, setCreateOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [listHidden, setListHidden] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [rowAction, setRowAction] = useState<{ instance: Preparation; action: PreparationAction }>();
  const ofKind = list.data?.items.filter((item) => item.kind === kind) ?? [];
  const term = normalize(search.trim());
  const items = ofKind
    .filter((item) => showArchived || item.status !== 'archived')
    .filter((item) => !term || normalize(item.title).includes(term))
    .slice()
    .sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        String(b.scheduled_date ?? b.created_at).localeCompare(
          String(a.scheduled_date ?? a.created_at),
        ),
    );
  const selection = items.some((item) => item.id === selected)
    ? selected
    : items[0]?.id;
  const detail = usePreparation(projectId, selection);
  const title = `${kindLabels[kind]} · ${context.data?.project.name ?? 'Preparação do projeto'}`;
  const canCreate =
    permissions.hasPermission('project-preparation:edit') &&
    Boolean(context.data) &&
    canMutateProjectOperations(context.data!.project.status);
  const operational = Boolean(context.data) && canMutateProjectOperations(context.data!.project.status);
  const canApprove = permissions.hasPermission('project-preparation:approve') && operational;
  const selectedItem = items.find((item) => item.id === selection);
  const canDeleteSelected =
    canCreate && Boolean(selectedItem) && ['draft', 'in_progress'].includes(selectedItem!.status);
  return (
    <PageContainer>
      <PageHeader
        title={title}
        description="Organize as informações iniciais, acompanhe respostas e revise a preparação do projeto."
        action={
          <Link
            className="text-sm font-semibold text-primary hover:underline"
            to={navigationHref(`/app/projects/${projectId}/summary`, location.search)}
          >
            Voltar ao projeto
          </Link>
        }
      />
      <Tabs
        tabs={[
          {
            label: 'Kick-off',
            to: `/app/projects/${projectId}/preparation/kickoff`,
          },
          {
            label: 'Checklist do cliente',
            to: `/app/projects/${projectId}/preparation/client-checklist`,
          },
        ]}
      />
      {context.isLoading || list.isLoading ? (
        <LoadingState label="Carregando preparação" />
      ) : context.isError || list.isError ? (
        <ErrorState
          message={((context.error ?? list.error) as Error).message}
          onRetry={() => {
            void context.refetch();
            void list.refetch();
          }}
        />
      ) : context.data ? (
        <>
          <section className="premium-panel grid gap-4 p-5 sm:grid-cols-2 print:hidden">
            <div>
              <p className="eyebrow">Empresa</p>
              <p className="mt-2 font-semibold">
                {context.data.company?.name ?? 'Empresa não vinculada'}
              </p>
            </div>
            <div>
              <p className="eyebrow">Unidades do projeto</p>
              {context.data.units.length ? (
                <ul className="mt-2 grid gap-1 text-sm">
                  {context.data.units.map((unit) => (
                    <li key={unit.id}>
                      {unit.name}
                      <span className="text-muted-foreground">
                        {' '}
                        — {unit.address || 'Endereço não informado'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhuma unidade vinculada.
                </p>
              )}
            </div>
          </section>
          <DataPanel
            className="print:hidden"
            title={listTitles[kind]}
            titleId="preparation-list-title"
            count={`${items.length} ${kind === 'kickoff' ? 'kick-off(s)' : 'checklist(s)'}`}
            hidden={listHidden}
            onToggle={() => setListHidden((value) => !value)}
            contentId="preparation-list"
            extra={
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setModelsOpen(true)}
                >
                  Modelos da organização
                </Button>
                {canCreate ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedItem || !canDeleteSelected}
                    title={
                      selectedItem && !canDeleteSelected
                        ? 'Só é possível excluir um item em andamento; reabra antes se estiver concluído.'
                        : undefined
                    }
                    onClick={() =>
                      selectedItem && setRowAction({ instance: selectedItem, action: 'archive' })
                    }
                    className="border border-rose-300 bg-transparent text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/40"
                  >
                    Excluir
                  </Button>
                ) : null}
                {canCreate ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                  >
                    + {newLabels[kind]}
                  </Button>
                ) : null}
              </>
            }
          >
            <DataPanelFilters label={`Filtros de ${listTitles[kind]}`}>
              <input
                type="search"
                aria-label="Buscar cliente"
                placeholder="Buscar cliente…"
                className="min-h-8 rounded-[6px] border border-input bg-background px-3 text-sm md:w-72"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <ViewToggle on={showArchived} onClick={() => setShowArchived((value) => !value)}>
                Mostrar arquivados
              </ViewToggle>
            </DataPanelFilters>
            {items.length ? (
              <DataTable
                bare
                caption={listTitles[kind]}
                items={items}
                getKey={(item) => item.id}
                columns={[
                  {
                    header: 'Cliente',
                    cell: (item) => (
                      <button
                        type="button"
                        aria-pressed={item.id === selection}
                        onClick={() => {
                          setSelected(item.id);
                          setMessage('');
                        }}
                        className={cn(
                          'text-left font-semibold hover:underline',
                          item.id === selection
                            ? 'text-primary'
                            : 'text-foreground',
                        )}
                      >
                        {item.title}
                        {item.id === selection ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (aberto)
                          </span>
                        ) : null}
                      </button>
                    ),
                  },
                  {
                    header: 'Data',
                    cell: (item) => formatDate(item.scheduled_date ?? item.created_at),
                  },
                  {
                    header: 'Check list',
                    numeric: true,
                    cell: (item) => progressLabel(item),
                  },
                  {
                    header: 'Situação',
                    cell: (item) => (
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold',
                          listSituation[item.status].tone,
                        )}
                        title={statusLabels[item.status]}
                      >
                        {listSituation[item.status].label}
                      </span>
                    ),
                  },
                  {
                    header: 'Ações',
                    cell: (item) =>
                      !canApprove || item.status === 'archived' ? null : item.status === 'approved' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          title="Reabrir"
                          aria-label={`Reabrir ${item.title}`}
                          onClick={() => setRowAction({ instance: item, action: 'reopen' })}
                        >
                          Reabrir
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          title="Marcar como concluído"
                          aria-label={`Concluir ${item.title}`}
                          onClick={() => setRowAction({ instance: item, action: 'approve' })}
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          ✓ Concluir
                        </Button>
                      ),
                  },
                ]}
              />
            ) : ofKind.length ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Nenhum {kind === 'kickoff' ? 'kick-off' : 'checklist'} encontrado.
              </p>
            ) : (
              <EmptyState
                title={`Nenhum ${kindLabels[kind]} criado`}
                description={`Use “+ ${newLabels[kind]}” para começar.`}
              />
            )}
          </DataPanel>
          {message ? (
            <p
              role="status"
              className="rounded-lg border border-primary/20 bg-primary-subtle p-3 text-sm text-primary print:hidden"
            >
              {message}
            </p>
          ) : null}
          {!items.length ? null : detail.isLoading ? (
            <LoadingState label="Carregando respostas" />
          ) : detail.isError ? (
            <ErrorState
              message={(detail.error as Error).message}
              onRetry={() => detail.refetch()}
            />
          ) : detail.data ? (
            <PreparationDetail
              key={detail.data.id}
              projectId={projectId}
              instance={detail.data}
              context={context.data}
              onMessage={setMessage}
            />
          ) : null}
          {createOpen ? (
            templates.isLoading ? (
              <ModalForm
                open
                title="Nova preparação"
                onOpenChange={setCreateOpen}
              >
                <LoadingState label="Carregando modelos" />
              </ModalForm>
            ) : templates.isError ? (
              <ModalForm
                open
                title="Nova preparação"
                onOpenChange={setCreateOpen}
              >
                <ErrorState
                  message={(templates.error as Error).message}
                  onRetry={() => templates.refetch()}
                />
              </ModalForm>
            ) : (
              <CreatePreparationForm
                key={kind}
                projectId={projectId}
                kind={kind}
                context={context.data}
                templates={(templates.data?.items ?? []).filter(
                  (template) => template.kind === kind && !template.archived_at,
                )}
                onClose={() => setCreateOpen(false)}
                onCreated={(id) => {
                  setSelected(id);
                  setCreateOpen(false);
                  setMessage(
                    `${kindLabels[kind]} criado.`,
                  );
                }}
              />
            )
          ) : null}
          {rowAction ? (
            <PreparationActionDialog
              key={`${rowAction.instance.id}-${rowAction.action}`}
              projectId={projectId}
              instance={rowAction.instance}
              action={rowAction.action}
              onClose={() => setRowAction(undefined)}
              onDone={(text) => {
                setRowAction(undefined);
                setMessage(text);
              }}
            />
          ) : null}
          {modelsOpen ? (
            <TemplateManager
              organizationId={context.data.project.organization_id}
              kind={kind}
              canEdit={permissions.hasPermission('project-preparation:edit')}
              onClose={() => setModelsOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}

type SituationFilter = 'all' | 'pending' | 'done';

/** Texto da resposta para a tabela, a impressão e a planilha. */
function answerText(
  question: PreparationQuestion,
  answer: PreparationAnswer,
  context: PreparationContext,
): string {
  if (!answer.applicable) return 'Bloqueado pelas respostas atuais';
  if (answer.state === 'not_applicable') return 'N/A';
  if (answer.state !== 'completed') return '';
  const value = answer.value;
  if (typeof value === 'boolean') return value ? 'SIM' : 'NÃO';
  if (Array.isArray(value))
    return answer.allocations
      .map(
        (row) =>
          `${context.units.find((unit) => unit.id === row.unit_id)?.name ?? `Unidade #${row.unit_id}`}: ${row.quantity} itens (${row.participation_percent}%)`,
      )
      .join('; ');
  if (value && typeof value === 'object') return `${value.start} a ${value.end}`;
  if (question.type === 'date') return formatDate(String(value));
  return value == null ? '' : String(value);
}

/** Situação da linha no padrão do sistema anterior: PENDENTE / REALIZADO. */
function situationOf(answer: PreparationAnswer) {
  if (!answer.applicable) return 'BLOQUEADO';
  if (answer.state === 'completed') return 'REALIZADO';
  if (answer.state === 'not_applicable') return 'N/A';
  return 'PENDENTE';
}

const csvCell = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`;

function PreparationDetail({
  projectId,
  instance,
  context,
  onMessage,
}: {
  projectId: number;
  instance: Preparation;
  context: PreparationContext;
  onMessage: (message: string) => void;
}) {
  const permissions = usePermissions();
  const canEdit =
    permissions.hasPermission('project-preparation:edit') &&
    canMutateProjectOperations(context.project.status) &&
    ['draft', 'in_progress'].includes(instance.status);
  const [questionId, setQuestionId] = useState<string>();
  const [edit, setEdit] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [filter, setFilter] = useState<SituationFilter>('all');
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const [action, setAction] = useState<PreparationAction>();
  const question = instance.snapshot.questions.find((q) => q.id === questionId);
  const answer = instance.answers.find((a) => a.question_id === questionId);
  const visible = instance.snapshot.questions
    .filter((q) => q.visible)
    .slice()
    .sort((a, b) => a.order - b.order);
  const answerOf = (q: PreparationQuestion) =>
    instance.answers.find((a) => a.question_id === q.id)!;
  const number = new Map(visible.map((q, index) => [q.id, index + 1]));
  const categories = [...new Set(visible.map((q) => q.category))];
  const matches = (q: PreparationQuestion) => {
    const a = answerOf(q);
    if (filter === 'pending') return a.applicable && a.state === 'pending';
    if (filter === 'done') return a.state !== 'pending';
    return true;
  };
  function exportSheet() {
    const header = ['Nº', 'Seção', 'Item', 'Situação', 'Resposta', 'Observações'];
    const rows = visible.map((q) => {
      const a = answerOf(q);
      return [
        number.get(q.id)!,
        q.category,
        q.label,
        situationOf(a),
        answerText(q, a, context),
        a.notes ?? '',
      ];
    });
    // Separador ";" e BOM para o Excel em português abrir com acentos e colunas certas.
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(';'))
      .join('\r\n');
    saveBlob(
      new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8' }),
      `${instance.title}.csv`,
    );
  }
  return (
    <div className="preparation-print grid gap-5">
      {!canMutateProjectOperations(context.project.status) ? (
        <p
          role="status"
          className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground print:hidden"
        >
          O status atual do projeto permite apenas consulta da preparação.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <ProgressCard
          label="Progresso de preenchimento"
          value={instance.progress.percent}
        />
        <section className="premium-panel grid gap-2 p-5 text-sm">
          <h2 className="text-lg font-bold">{instance.title}</h2>
          <p>
            {statusLabels[instance.status]} · {instance.snapshot.name} · versão{' '}
            {instance.snapshot.version}
          </p>
          <p>
            Responsável:{' '}
            {context.responsible_users.find(
              (u) => u.id === instance.responsible_user_id,
            )?.label ??
              (instance.responsible_user_id
                ? userLabel(instance.responsible_user_name)
                : 'Não definido')}
          </p>
          <p>
            Data: {formatDate(instance.scheduled_date)} · Prazo:{' '}
            {formatDate(instance.due_date)}
          </p>
          {instance.approved_at ? (
            <p>
              Conclusão: {formatDateTime(instance.approved_at)} ·{' '}
              {userLabel(instance.approved_by_name)}
            </p>
          ) : null}
          {instance.notes ? (
            <p className="whitespace-pre-wrap text-muted-foreground">
              {instance.notes}
            </p>
          ) : null}
        </section>
      </div>
      <p className="text-sm text-muted-foreground">
        {instance.progress.completed} concluídas ·{' '}
        {instance.progress.not_applicable} não aplicáveis ·{' '}
        {instance.progress.pending} pendentes de {instance.progress.total}{' '}
        perguntas visíveis e habilitadas. Fora do denominador:{' '}
        {instance.progress.hidden} ocultas e{' '}
        {instance.progress.conditionally_disabled} bloqueadas por condição.
      </p>
      <div className="flex flex-wrap gap-2 print:hidden">
        {canEdit ? (
          <Button variant="secondary" onClick={() => setEdit(true)}>
            Responsáveis e datas
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
          Histórico
        </Button>
        <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
          Prévia de comunicação
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={15} /> Imprimir
        </Button>
        <Button variant="secondary" onClick={exportSheet}>
          <Download size={15} /> Exportar (Excel)
        </Button>
        {permissions.hasPermission('project-preparation:approve') &&
        instance.status !== 'archived' &&
        canMutateProjectOperations(context.project.status) ? (
          <Button
            onClick={() =>
              setAction(instance.status === 'approved' ? 'reopen' : 'approve')
            }
          >
            {instance.status === 'approved' ? 'Reabrir' : 'Concluir'}
          </Button>
        ) : null}
        {canEdit ? (
          <Button variant="ghost" onClick={() => setAction('archive')}>
            Excluir
          </Button>
        ) : null}
      </div>
      {instance.progress.missing_required.length ? (
        <p className="text-sm text-muted-foreground print:hidden">
          {instance.progress.missing_required.length} pergunta(s) obrigatória(s)
          ainda pendente(s). A conclusão exige resolver todas as obrigatórias
          aplicáveis.
        </p>
      ) : null}
      <div className="rounded-lg border bg-card print:hidden">
        <DataPanelFilters label="Filtrar por situação">
          <span className="text-sm font-semibold">Situação:</span>
          <ViewToggle on={filter === 'all'} onClick={() => setFilter('all')}>
            Todos
          </ViewToggle>
          <ViewToggle
            on={filter === 'pending'}
            onClick={() => setFilter('pending')}
          >
            Pendentes
          </ViewToggle>
          <ViewToggle on={filter === 'done'} onClick={() => setFilter('done')}>
            Realizados
          </ViewToggle>
        </DataPanelFilters>
      </div>
      {categories.map((category, index) => {
        const all = visible.filter((q) => q.category === category);
        const applicable = all.filter((q) => answerOf(q).applicable);
        const done = applicable.filter(
          (q) => answerOf(q).state !== 'pending',
        ).length;
        const rows = all.filter(matches);
        const hidden = hiddenGroups.includes(category);
        return (
          <DataPanel
            key={category}
            title={category}
            titleId={`preparation-group-${index}`}
            count={`${done} de ${applicable.length} verificado(s)`}
            hidden={hidden}
            onToggle={() =>
              setHiddenGroups((current) =>
                hidden
                  ? current.filter((name) => name !== category)
                  : [...current, category],
              )
            }
            contentId={`preparation-group-${index}-content`}
          >
            {rows.length ? (
              <QuestionTable
                caption={category}
                rows={rows}
                number={number}
                answerOf={answerOf}
                context={context}
                editable={canEdit}
                projectId={projectId}
                instance={instance}
                onEdit={setQuestionId}
                onMessage={onMessage}
              />
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Nenhum item nesta situação.
              </p>
            )}
          </DataPanel>
        );
      })}
      {question && answer ? (
        <AnswerForm
          key={`${instance.id}-${question.id}`}
          projectId={projectId}
          instance={instance}
          question={question}
          answer={answer}
          context={context}
          onClose={() => setQuestionId(undefined)}
          onSaved={() => {
            setQuestionId(undefined);
            onMessage(
              'Resposta salva. Progresso e condições atualizados pelo servidor.',
            );
          }}
        />
      ) : null}
      {edit ? (
        <EditPreparationForm
          projectId={projectId}
          instance={instance}
          context={context}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            onMessage('Dados da preparação atualizados.');
          }}
        />
      ) : null}
      {historyOpen ? (
        <HistoryPanel
          projectId={projectId}
          instance={instance.id}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
      {previewOpen ? (
        <CommunicationPanel
          projectId={projectId}
          instance={instance.id}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
      {action ? (
        <PreparationActionDialog
          key={action}
          projectId={projectId}
          instance={instance}
          action={action}
          onClose={() => setAction(undefined)}
          onDone={(text) => {
            setAction(undefined);
            onMessage(text);
          }}
        />
      ) : null}
    </div>
  );
}

const rowTone: Record<string, string> = {
  PENDENTE: 'bg-rose-50 dark:bg-rose-950/30',
  REALIZADO: 'bg-emerald-50 dark:bg-emerald-950/30',
  'N/A': 'bg-muted/40',
  BLOQUEADO: 'opacity-60',
};
const situationTone: Record<string, string> = {
  PENDENTE: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-100',
  REALIZADO:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100',
  'N/A': 'bg-muted text-muted-foreground',
  BLOQUEADO: 'bg-muted text-muted-foreground',
};

/** Tabela de um grupo no padrão do sistema anterior: Nº, Realizado, Item, Grupo, Resposta, Observações. */
function QuestionTable({
  caption,
  rows,
  number,
  answerOf,
  context,
  editable,
  projectId,
  instance,
  onEdit,
  onMessage,
}: {
  caption: string;
  rows: PreparationQuestion[];
  number: Map<string, number>;
  answerOf: (q: PreparationQuestion) => PreparationAnswer;
  context: PreparationContext;
  editable: boolean;
  projectId: number;
  instance: Preparation;
  onEdit: (id: string) => void;
  onMessage: (message: string) => void;
}) {
  return (
    <div
      className="overflow-x-auto"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="data-table w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            {['Nº', 'Realizado', 'Item', 'Grupo', 'Resposta', 'Observações', 'Ações'].map(
              (header) => (
                <th
                  key={header}
                  scope="col"
                  className={cn(
                    'border-b border-border px-4 py-3 font-semibold first:pl-5 last:pr-5',
                    header === 'Ações' && 'print:hidden',
                  )}
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {rows.map((q) => {
            const a = answerOf(q);
            const situation = situationOf(a);
            const tag = questionGroupTags[q.id];
            const cell =
              'border-b border-border/55 px-4 py-3 align-top first:pl-5 last:pr-5';
            return (
              <tr key={q.id} className={rowTone[situation]}>
                <td className={cn(cell, 'numeric w-12')}>
                  {String(number.get(q.id)).padStart(2, '0')}
                </td>
                <td className={cn(cell, 'w-28')}>
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-bold',
                      situationTone[situation],
                    )}
                    title={
                      situation === 'BLOQUEADO'
                        ? 'Desabilitada pelas respostas atuais; histórico preservado'
                        : undefined
                    }
                  >
                    {situation}
                  </span>
                </td>
                <td className={cell}>
                  <span
                    className={cn(
                      'font-semibold',
                      situation === 'REALIZADO' && 'line-through decoration-1 opacity-80',
                    )}
                  >
                    {q.label}
                  </span>
                  {q.required ? (
                    <span className="ml-2 text-xs text-primary">Obrigatória</span>
                  ) : null}
                  {a.responsible_user_id || a.due_date ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Responsável:{' '}
                      {context.responsible_users.find(
                        (user) => user.id === a.responsible_user_id,
                      )?.label ??
                        (a.responsible_user_id
                          ? userLabel(a.responsible_user_name)
                          : 'Não definido')}{' '}
                      · Prazo: {formatDate(a.due_date)}
                    </p>
                  ) : null}
                </td>
                <td className={cn(cell, 'w-32 text-xs')}>
                  {requestAtKickoff.has(q.id) ? (
                    <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-100">
                      Solicitar no kick-off
                    </span>
                  ) : tag ? (
                    <span className="font-semibold text-muted-foreground">{tag}</span>
                  ) : null}
                </td>
                <td className={cell}>
                  {editable && a.applicable && (q.type === 'select' || q.type === 'boolean') ? (
                    <InlineChoice
                      question={q}
                      answer={a}
                      projectId={projectId}
                      instance={instance}
                      onMessage={onMessage}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">
                      {answerText(q, a, context) || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  )}
                </td>
                <td className={cn(cell, 'whitespace-pre-wrap text-muted-foreground')}>
                  {a.applicable ? a.notes : null}
                </td>
                <td className={cn(cell, 'print:hidden')}>
                  {editable && a.applicable ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Responder: ${q.label}`}
                      onClick={() => onEdit(q.id)}
                    >
                      Responder
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Resposta de lista direto na linha, como no sistema anterior: escolher uma opção marca o
 * item como REALIZADO; voltar para "Selecione" o devolve a PENDENTE.
 */
function InlineChoice({
  question,
  answer,
  projectId,
  instance,
  onMessage,
}: {
  question: PreparationQuestion;
  answer: PreparationAnswer;
  projectId: number;
  instance: Preparation;
  onMessage: (message: string) => void;
}) {
  const mutation = usePreparationMutation(projectId, (payload: AnswerPayload) =>
    preparationApi.answers(projectId, instance.id, instance.revision, [payload]),
  );
  const current =
    answer.state === 'completed'
      ? typeof answer.value === 'boolean'
        ? String(answer.value)
        : typeof answer.value === 'string'
          ? answer.value
          : ''
      : '';
  function change(raw: string) {
    const value =
      raw === ''
        ? null
        : question.type === 'boolean'
          ? raw === 'true'
          : raw;
    mutation.mutate(
      {
        question_id: question.id,
        state: value === null ? 'pending' : 'completed',
        value,
        notes: answer.notes,
        responsible_user_id: answer.responsible_user_id,
        due_date: answer.due_date,
      },
      { onSuccess: () => onMessage('Resposta salva.') },
    );
  }
  return (
    <div className="grid gap-1">
      <select
        aria-label={`Resposta: ${question.label}`}
        className="h-9 w-full min-w-40 rounded-md border bg-background px-2 text-sm"
        value={current}
        disabled={mutation.isPending}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">{answer.state === 'not_applicable' ? 'N/A' : 'Selecione'}</option>
        {question.type === 'boolean' ? (
          <>
            <option value="true">SIM</option>
            <option value="false">NÃO</option>
          </>
        ) : (
          question.options?.map((option) => <option key={option}>{option}</option>)
        )}
      </select>
      {mutation.isError ? (
        <span role="alert" className="text-xs text-destructive">
          {(mutation.error as Error).message}
        </span>
      ) : null}
    </div>
  );
}
function HistoryPanel({
  projectId,
  instance,
  onClose,
}: {
  projectId: number;
  instance: number;
  onClose: () => void;
}) {
  const [beforeId, setBeforeId] = useState<number>();
  const query = useQuery({
    queryKey: [
      ...preparationKeys.project(projectId),
      'history',
      instance,
      beforeId,
    ],
    queryFn: () => preparationApi.history(projectId, instance, beforeId),
    retry: false,
  });
  const names: Record<string, string> = {
    INSTANCE_CREATED: 'Preparação criada',
    INSTANCE_UPDATED: 'Dados atualizados',
    ANSWER_SAVED: 'Resposta salva',
    INSTANCE_APPROVE: 'Preparação aprovada',
    INSTANCE_REOPEN: 'Preparação reaberta',
    INSTANCE_ARCHIVE: 'Preparação arquivada',
    COMMUNICATION_PREVIEW: 'Prévia de comunicação gerada',
  };
  return (
    <DrawerForm
      open
      onOpenChange={(open) => !open && onClose()}
      title="Histórico da preparação"
    >
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          message={(query.error as Error).message}
          onRetry={() => query.refetch()}
        />
      ) : (
        <div className="grid gap-3">
          {query.data?.items.map((item) => (
            <article key={item.id} className="rounded-lg border p-3">
              <h3 className="text-sm font-bold">
                {names[item.operation] ?? item.operation}
              </h3>
              <p className="my-2 text-xs text-muted-foreground">
                {formatDateTime(item.created_at)} ·{' '}
                {userLabel(item.performed_by_name)}
              </p>
              <details className="text-xs">
                <summary className="cursor-pointer text-primary">
                  Ver alteração registrada
                </summary>
                <HistoryChange changes={item.changes} />
              </details>
            </article>
          ))}
          {!query.data?.items.length ? (
            <EmptyState title="Sem alterações registradas" />
          ) : null}
          <div className="flex gap-2">
            {beforeId ? (
              <Button
                variant="secondary"
                onClick={() => setBeforeId(undefined)}
              >
                Mais recentes
              </Button>
            ) : null}
            {query.data?.next_before_id ? (
              <Button
                variant="secondary"
                onClick={() => setBeforeId(query.data!.next_before_id!)}
              >
                Mais antigas
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </DrawerForm>
  );
}
function HistoryChange({ changes }: { changes: Record<string, unknown> }) {
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const describe = (value: unknown): string => {
    if (value == null) return 'Não informado';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'string')
      return (
        (
          {
            pending: 'Pendente',
            completed: 'Concluído',
            not_applicable: 'Não aplicável',
            ...statusLabels,
          } as Record<string, string>
        )[value] ?? value
      );
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value))
      return value
        .map((row) => {
          const entry = record(row);
          return `Unidade #${String(entry.unit_id)}: ${String(entry.quantity)} itens`;
        })
        .join('; ');
    const entry = record(value);
    if ('start' in entry && 'end' in entry)
      return `${String(entry.start)} a ${String(entry.end)}`;
    const labels: Record<string, string> = {
      state: 'Situação',
      value: 'Resposta',
      notes: 'Observações',
      title: 'Título',
      responsibleUserId: 'Responsável (usuário)',
      scheduledDate: 'Data',
      dueDate: 'Prazo',
      status: 'Situação',
      approvedById: 'Aprovado por (usuário)',
      approvedAt: 'Data da aprovação',
    };
    return (
      Object.entries(labels)
        .filter(([key]) => key in entry)
        .map(([key, label]) => `${label}: ${describe(entry[key])}`)
        .join('\n') || 'Registro preservado'
    );
  };
  const snapshot = record(changes.snapshot);
  return (
    <div className="mt-2 grid gap-2 rounded-lg bg-muted p-3 leading-6">
      {typeof changes.question_label === 'string' ? (
        <p className="font-semibold">{changes.question_label}</p>
      ) : null}
      {'before' in changes ? (
        <p className="whitespace-pre-wrap">Antes: {describe(changes.before)}</p>
      ) : null}
      {'after' in changes ? (
        <p className="whitespace-pre-wrap">Depois: {describe(changes.after)}</p>
      ) : null}
      {snapshot.name ? (
        <p>
          Modelo: {String(snapshot.name)} · versão {String(snapshot.version)}
        </p>
      ) : null}
      {changes.channel ? (
        <p>
          {changes.channel === 'email'
            ? 'Prévia de e-mail'
            : 'Orientação técnica'}{' '}
          gerada para revisão, sem envio.
        </p>
      ) : null}
      {changes.revision ? <p>Revisão {String(changes.revision)}</p> : null}
    </div>
  );
}
function CommunicationPanel({
  projectId,
  instance,
  onClose,
}: {
  projectId: number;
  instance: number;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const preview = useMutation({
    mutationFn: (channel: 'email' | 'guidance') =>
      preparationApi.communication(projectId, instance, channel),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [...preparationKeys.project(projectId), 'history', instance],
      }),
  });
  const [copyMessage, setCopyMessage] = useState('');
  async function copy() {
    if (!preview.data) return;
    try {
      await navigator.clipboard.writeText(
        `${preview.data.subject}\n\n${preview.data.body}`,
      );
      setCopyMessage('Texto copiado. Nenhuma mensagem foi enviada.');
    } catch {
      setCopyMessage(
        'Não foi possível copiar. Selecione e copie o texto da prévia.',
      );
    }
  }
  return (
    <ModalForm
      open
      onOpenChange={(open) => !open && onClose()}
      title="Prévia de comunicação"
    >
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Revise o conteúdo antes de copiar. Destinatário não definido; nenhuma
          mensagem será enviada por esta tela.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={preview.isPending}
            onClick={() => {
              setCopyMessage('');
              preview.mutate('email');
            }}
          >
            Gerar prévia de e-mail
          </Button>
          <Button
            variant="secondary"
            disabled={preview.isPending}
            onClick={() => {
              setCopyMessage('');
              preview.mutate('guidance');
            }}
          >
            Gerar orientação técnica
          </Button>
        </div>
        {preview.isPending ? (
          <LoadingState label="Preparando conteúdo" />
        ) : preview.isError ? (
          <ErrorState message={(preview.error as Error).message} />
        ) : preview.data ? (
          <>
            <h3 className="font-semibold">{preview.data.subject}</h3>
            <textarea
              aria-label="Conteúdo da prévia"
              readOnly
              className="min-h-80 w-full rounded-lg border bg-background p-3 text-sm"
              value={preview.data.body}
            />
            <Button onClick={() => void copy()}>Copiar texto revisado</Button>
          </>
        ) : (
          <EmptyState
            title="Escolha o conteúdo da prévia"
            description="O texto será gerado somente a partir deste projeto e das respostas aplicáveis."
          />
        )}
        {copyMessage ? (
          <p role="status" className="text-sm text-primary">
            {copyMessage}
          </p>
        ) : null}
      </div>
    </ModalForm>
  );
}
