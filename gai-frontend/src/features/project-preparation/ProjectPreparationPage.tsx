import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { navigationHref } from '@/features/projects/navigationContext';
import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { ProgressCard } from '@/components/base/Cards';
import { Tabs } from '@/components/base/Tabs';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DrawerForm, ModalForm } from '@/components/ui/dialog';
import { usePermissions } from '@/features/auth/usePermissions';
import { canMutateProjectOperations } from '@/features/projects/projectLifecycle';
import { formatDate, formatDateTime } from '@/utils/format';
import {
  AnswerForm,
  CreatePreparationForm,
  EditPreparationForm,
} from './PreparationForms';
import { TemplateManager } from './TemplateManager';
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
  type Preparation,
  type PreparationAnswer,
  type PreparationContext,
  type PreparationQuestion,
} from './preparationTypes';

export function ProjectPreparationPage() {
  const location = useLocation();
  const params = useParams();
  const projectId = Number(params.projectId);
  const kind =
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
  const [message, setMessage] = useState('');
  const items = list.data?.items.filter((item) => item.kind === kind) ?? [];
  const selection = items.some((item) => item.id === selected)
    ? selected
    : items[0]?.id;
  const detail = usePreparation(projectId, selection);
  const title = `${kindLabels[kind]} · ${context.data?.project.name ?? 'Preparação do projeto'}`;
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
            label: 'Checklist do Cliente',
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
          <section className="premium-panel grid gap-4 p-5 sm:grid-cols-2">
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="grid min-w-56 gap-2 text-sm font-semibold">
              Preparações de {kindLabels[kind]}
              <select
                className="h-10 rounded-lg border bg-background px-3"
                value={selection ?? ''}
                onChange={(e) => {
                  setSelected(Number(e.target.value));
                  setMessage('');
                }}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {statusLabels[item.status]} · v
                    {item.snapshot.version}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setModelsOpen(true)}>
                Modelos da organização
              </Button>
              {permissions.hasPermission('project-preparation:edit') &&
              canMutateProjectOperations(context.data.project.status) ? (
                <Button onClick={() => setCreateOpen(true)}>
                  Nova preparação
                </Button>
              ) : null}
            </div>
          </div>
          {message ? (
            <p
              role="status"
              className="rounded-lg border border-primary/20 bg-primary-subtle p-3 text-sm text-primary"
            >
              {message}
            </p>
          ) : null}
          {!items.length ? (
            <EmptyState
              title={`Nenhum ${kindLabels[kind]} criado`}
              description="Cadastre ou escolha um modelo da organização e crie uma preparação independente para este projeto."
            />
          ) : detail.isLoading ? (
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
                context={context.data}
                templates={(templates.data?.items ?? []).filter(
                  (template) => template.kind === kind && !template.archived_at,
                )}
                onClose={() => setCreateOpen(false)}
                onCreated={(id) => {
                  setSelected(id);
                  setCreateOpen(false);
                  setMessage(
                    'Preparação criada com uma cópia preservada do modelo.',
                  );
                }}
              />
            )
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
  const [action, setAction] = useState<'approve' | 'reopen' | 'archive'>();
  const transition = usePreparationMutation(
    projectId,
    (operation: 'approve' | 'reopen' | 'archive') =>
      preparationApi.transition(
        projectId,
        instance.id,
        instance.revision,
        operation,
      ),
  );
  const question = instance.snapshot.questions.find((q) => q.id === questionId);
  const answer = instance.answers.find((a) => a.question_id === questionId);
  const categories = [
    ...new Set(
      instance.snapshot.questions
        .filter((q) => q.visible)
        .map((q) => q.category),
    ),
  ];
  return (
    <div className="grid gap-5">
      {!canMutateProjectOperations(context.project.status) ? (
        <p
          role="status"
          className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground"
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
                ? `Usuário #${instance.responsible_user_id}`
                : 'Não definido')}
          </p>
          <p>
            Data: {formatDate(instance.scheduled_date)} · Prazo:{' '}
            {formatDate(instance.due_date)}
          </p>
          {instance.approved_at ? (
            <p>
              Aprovação: {formatDateTime(instance.approved_at)} · usuário #
              {instance.approved_by_id}
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
        {instance.progress.conditionally_disabled} desabilitadas por condição.
      </p>
      <div className="flex flex-wrap gap-2">
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
        {permissions.hasPermission('project-preparation:approve') &&
        instance.status !== 'archived' &&
        canMutateProjectOperations(context.project.status) ? (
          <Button
            onClick={() =>
              setAction(instance.status === 'approved' ? 'reopen' : 'approve')
            }
          >
            {instance.status === 'approved'
              ? 'Reabrir preparação'
              : 'Aprovar preparação'}
          </Button>
        ) : null}
        {canEdit ? (
          <Button variant="ghost" onClick={() => setAction('archive')}>
            Arquivar preparação
          </Button>
        ) : null}
      </div>
      {transition.isError ? (
        <ErrorState message={(transition.error as Error).message} />
      ) : null}
      {instance.progress.missing_required.length ? (
        <p className="text-sm text-muted-foreground">
          {instance.progress.missing_required.length} pergunta(s) obrigatória(s)
          ainda pendente(s). A aprovação exige resolver todas as obrigatórias
          aplicáveis.
        </p>
      ) : null}
      {categories.map((category) => (
        <section key={category} className="grid gap-3">
          <h2 className="text-lg font-bold">{category}</h2>
          {instance.snapshot.questions
            .filter((q) => q.visible && q.category === category)
            .map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                answer={instance.answers.find((a) => a.question_id === q.id)!}
                context={context}
                editable={canEdit}
                onEdit={() => setQuestionId(q.id)}
              />
            ))}
        </section>
      ))}
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
      <ConfirmDialog
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(undefined)}
        title={
          action === 'approve'
            ? 'Aprovar preparação'
            : action === 'reopen'
              ? 'Reabrir preparação'
              : 'Arquivar preparação'
        }
        description={
          action === 'approve'
            ? 'As respostas serão bloqueadas para edição. Perguntas obrigatórias aplicáveis precisam estar resolvidas.'
            : action === 'reopen'
              ? 'A aprovação será encerrada e as respostas poderão ser editadas. O histórico será preservado.'
              : 'A preparação ficará somente para consulta, sem excluir respostas ou histórico.'
        }
        busy={transition.isPending}
        onConfirm={() =>
          action &&
          transition.mutate(action, {
            onSuccess: () => {
              setAction(undefined);
              onMessage('Situação da preparação atualizada.');
            },
          })
        }
      />
    </div>
  );
}
function QuestionCard({
  question,
  answer,
  context,
  editable,
  onEdit,
}: {
  question: PreparationQuestion;
  answer: PreparationAnswer;
  context: PreparationContext;
  editable: boolean;
  onEdit: () => void;
}) {
  let value = 'Sem resposta';
  if (answer.state === 'not_applicable') value = 'Não aplicável';
  else if (answer.state === 'completed')
    value =
      typeof answer.value === 'boolean'
        ? answer.value
          ? 'Sim'
          : 'Não'
        : Array.isArray(answer.value)
          ? answer.allocations
              .map(
                (row) =>
                  `${context.units.find((unit) => unit.id === row.unit_id)?.name ?? `Unidade #${row.unit_id}`}: ${row.quantity} itens (${row.participation_percent}%)`,
              )
              .join('; ')
          : answer.value && typeof answer.value === 'object'
            ? `${answer.value.start} a ${answer.value.end}`
            : question.type === 'date'
              ? formatDate(String(answer.value))
              : String(answer.value);
  return (
    <article
      className={`premium-panel grid gap-3 p-4 sm:p-5 ${!answer.applicable ? 'opacity-65' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">
            {question.label}
            {question.required ? (
              <span className="ml-2 text-xs text-primary">Obrigatória</span>
            ) : null}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {!answer.applicable
              ? 'Desabilitada pelas respostas atuais; histórico preservado'
              : answer.state === 'pending'
                ? 'Pendente'
                : answer.state === 'completed'
                  ? 'Concluído'
                  : 'Não aplicável'}
          </p>
        </div>
        {editable && answer.applicable ? (
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Responder: ${question.label}`}
            onClick={onEdit}
          >
            Responder
          </Button>
        ) : null}
      </div>
      {answer.applicable ? (
        <>
          <p className="whitespace-pre-wrap text-sm">{value}</p>
          {answer.notes ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {answer.notes}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Responsável:{' '}
            {context.responsible_users.find(
              (user) => user.id === answer.responsible_user_id,
            )?.label ??
              (answer.responsible_user_id
                ? `Usuário #${answer.responsible_user_id}`
                : 'Não definido')}{' '}
            · Prazo: {formatDate(answer.due_date)}
            {answer.answered_at
              ? ` · Respondido em ${formatDateTime(answer.answered_at)} por usuário #${answer.answered_by_id}`
              : ''}
          </p>
        </>
      ) : null}
    </article>
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
                {formatDateTime(item.created_at)} · usuário #
                {item.performed_by_id}
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
