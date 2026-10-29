import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { pendingIssuesApi } from "@/api/endpoints";
import { normalizePage } from "@/api/pagination";
import { ApiError } from "@/api/http";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { MetricCard, ProgressCard } from "@/components/base/Cards";
import { FormField } from "@/components/base/FormField";
import { DataTable, type Column } from "@/components/base/DataTable";
import { Pagination } from "@/components/base/Pagination";
import { LoadingState, EmptyState, ErrorState } from "@/components/base/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalForm, DrawerForm } from "@/components/ui/dialog";
import { usePermissions } from "@/features/auth/usePermissions";
import { canMutateProjectOperations } from "@/features/projects/projectLifecycle";
import { PendingIssueDetailDrawer } from "@/features/pending-issues/PendingIssueDetailDrawer";
import { formatDate, formatDateTime } from "@/utils/format";
import {
  control,
  FieldTemplates,
  TaskDefinitionEditor,
} from "./FieldTemplates";
import {
  fieldApi,
  fieldKeys,
  newTask,
  priorities,
  stateLabels,
  type Checklist,
  type Task,
  type TaskState,
  type Priority,
} from "./fieldApi";

function useChange(
  project: number,
  operation: () => Promise<unknown>,
  onSuccess?: () => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: operation,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: fieldKeys.all(project) });
      onSuccess?.();
    },
  });
}
export function FieldCoordinationPage() {
  const project = Number(useParams().projectId),
    permissions = usePermissions();
  const [listPage, setListPage] = useState(1),
    [selected, setSelected] = useState<number>(),
    [models, setModels] = useState(false),
    [create, setCreate] = useState(false);
  const context = useQuery({
    queryKey: [...fieldKeys.all(project), "context"],
    queryFn: () => fieldApi.context(project, { page_size: 20 }),
  });
  const list = useQuery({
    queryKey: [...fieldKeys.all(project), "list", listPage],
    queryFn: () => fieldApi.list(project, listPage),
  });
  const selection = list.data?.items.some((row) => row.id === selected)
    ? selected
    : list.data?.items[0]?.id;
  const canEdit = permissions.hasPermission("field-coordination:edit");
  return (
    <PageContainer>
      <PageHeader
        title={`Coordenação de Campo · ${context.data?.project.name ?? "Projeto"}`}
        description="Etapas, tarefas, responsáveis e validação explícita da conclusão de campo."
      />
      {context.isLoading || list.isLoading ? (
        <LoadingState />
      ) : context.isError || list.isError ? (
        <ErrorState
          message={((context.error ?? list.error) as Error).message}
        />
      ) : context.data ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <FormField label="Checklist de campo">
              <select
                className={control}
                value={selection ?? ""}
                onChange={(e) => setSelected(Number(e.target.value))}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {list.data?.items.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title} ·{" "}
                    {row.status === "open"
                      ? "Aberto"
                      : row.status === "completed"
                        ? "Concluído"
                        : "Arquivado"}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setModels(true)}>
                Modelos de campo
              </Button>
              {canEdit &&
              canMutateProjectOperations(context.data.project.status) ? (
                <Button onClick={() => setCreate(true)}>
                  Iniciar checklist de campo
                </Button>
              ) : null}
            </div>
          </div>
          <Pagination
            page={listPage}
            totalPages={Math.max(1, Math.ceil((list.data?.total ?? 0) / 20))}
            onPageChange={setListPage}
          />
          {selection ? (
            <FieldWorkspace
              key={`${project}-${selection}`}
              project={project}
              id={selection}
              mutable={canMutateProjectOperations(context.data.project.status)}
            />
          ) : (
            <EmptyState
              title="Nenhum checklist de campo"
              description="Configure um modelo da organização e inicie uma instância para este projeto."
            />
          )}
          {models ? (
            <FieldTemplates
              org={context.data.project.organizationId}
              canEdit={canEdit}
              onClose={() => setModels(false)}
            />
          ) : null}
          {create ? (
            <CreateChecklist
              project={project}
              org={context.data.project.organizationId}
              onClose={() => setCreate(false)}
              onCreated={(id) => {
                setSelected(id);
                setListPage(1);
                setCreate(false);
              }}
            />
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}
function CreateChecklist({
  project,
  org,
  onClose,
  onCreated,
}: {
  project: number;
  org: number;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [page, setPage] = useState(1),
    [model, setModel] = useState(""),
    [version, setVersion] = useState(""),
    [title, setTitle] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const client = useQueryClient();
  const models = useQuery({
    queryKey: [...fieldKeys.templates(org), page],
    queryFn: () => fieldApi.templates(org, page),
  });
  const mutation = useMutation({
    mutationFn: () =>
      fieldApi.create(project, {
        template_id: Number(model),
        ...(version ? { template_version: Number(version) } : {}),
        title,
        command_key: key,
      }),
    onSuccess: async (row) => {
      await client.invalidateQueries({ queryKey: fieldKeys.all(project) });
      onCreated(row.id);
    },
  });
  return (
    <ModalForm
      open
      title="Iniciar checklist de campo"
      onOpenChange={(open) => !open && onClose()}
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {models.isError ? (
          <ErrorState message={(models.error as Error).message} />
        ) : null}
        <FormField label="Modelo">
          <select
            required
            className={control}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">Selecione um modelo ativo</option>
            {models.data?.items
              .filter((row) => !row.archivedAt)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · v{row.currentVersion}
                </option>
              ))}
          </select>
        </FormField>
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil((models.data?.total ?? 0) / 20))}
          onPageChange={setPage}
        />
        <FormField
          label="Versão escolhida"
          optional
          hint="Em branco usa a versão atual. O snapshot permanece independente."
        >
          <Input
            type="number"
            min={1}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </FormField>
        <FormField label="Título do checklist">
          <Input
            required
            minLength={2}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>
        {mutation.isError ? (
          <ErrorState message={(mutation.error as Error).message} />
        ) : null}
        <Button disabled={mutation.isPending || !model}>Criar checklist</Button>
      </form>
    </ModalForm>
  );
}
function FieldWorkspace({
  project,
  id,
  mutable,
}: {
  project: number;
  id: number;
  mutable: boolean;
}) {
  const permissions = usePermissions(),
    [page, setPage] = useState(1),
    [stage, setStage] = useState(""),
    [state, setState] = useState(""),
    [priority, setPriority] = useState(""),
    [due, setDue] = useState(""),
    [overdue, setOverdue] = useState(false),
    [responsible, setResponsible] = useState(""),
    [kind, setKind] = useState<"user" | "field_agent">("user"),
    [search, setSearch] = useState(""),
    [responsiblePage, setResponsiblePage] = useState(1);
  const [editing, setEditing] = useState<Task>(),
    [add, setAdd] = useState(false),
    [transition, setTransition] = useState<"complete" | "reopen" | "archive">(),
    [history, setHistory] = useState(false),
    [message, setMessage] = useState(false),
    [issue, setIssue] = useState<number>();
  const dashboard = useQuery({
    queryKey: [...fieldKeys.all(project), id, "dashboard"],
    queryFn: () => fieldApi.dashboard(project, id),
  });
  const query = {
    page,
    page_size: 20,
    group_id: stage || undefined,
    state: state || undefined,
    priority: priority || undefined,
    due_before: due || undefined,
    overdue: overdue ? "true" : undefined,
    ...(responsible
      ? {
          [kind === "user" ? "responsible_user_id" : "field_agent_id"]:
            Number(responsible),
        }
      : {}),
  };
  const tasks = useQuery({
    queryKey: [...fieldKeys.all(project), id, "tasks", query],
    queryFn: () => fieldApi.tasks(project, id, query),
  });
  const people = useQuery({
    queryKey: [
      ...fieldKeys.all(project),
      "people",
      kind,
      search,
      responsiblePage,
    ],
    queryFn: () =>
      fieldApi.context(project, {
        kind,
        search: search || undefined,
        page: responsiblePage,
      }),
  });
  const row = dashboard.data?.checklist,
    canEdit =
      permissions.hasPermission("field-coordination:edit") &&
      mutable &&
      row?.status === "open",
    canCoordinate =
      permissions.hasPermission("field-coordination:coordinate") && mutable;
  const approve = useChange(
    project,
    () => fieldApi.approve(project, id, editing!.id, tasks.data!.revision),
    () => setEditing(undefined),
  );
  const columns: Column<Task>[] = [
    {
      header: "Tarefa",
      cell: (t) => (
        <div>
          <p className="font-semibold">{t.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {row?.snapshot.groups.find((g) => g.id === t.groupId)?.title}
            {t.required ? " · Obrigatória" : " · Opcional"}
            {!t.applicable ? " · Fora de aplicabilidade" : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Situação",
      cell: (t) => (
        <div>
          {stateLabels[t.state]}
          {t.approvedById ? (
            <p className="text-xs text-primary">Aprovada</p>
          ) : null}
        </div>
      ),
    },
    {
      header: "Prioridade / prazo",
      cell: (t) => (
        <div>
          {priorities[t.priority]}
          <p className="text-xs text-muted-foreground">
            {formatDate(t.dueDate)}
          </p>
        </div>
      ),
    },
    {
      header: "Responsável",
      cell: (t) =>
        t.responsible
          ? `${t.responsible.kind === "user" ? "Usuário" : "Inventariante"}: ${t.responsible.name}`
          : t.responsibleUserId
            ? `Usuário #${t.responsibleUserId}`
            : t.fieldAgentId
              ? `Inventariante #${t.fieldAgentId}`
              : "Não definido",
    },
    {
      header: "Pendência patrimonial",
      cell: (t) =>
        t.issue ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIssue(t.issue!.id)}
          >
            {t.issue.title} · {t.issue.status}
          </Button>
        ) : t.hasLinkedIssue ? (
          "Vínculo protegido"
        ) : (
          "Sem vínculo"
        ),
    },
    {
      header: "Ações",
      cell: (t) => (
        <Button variant="secondary" size="sm" onClick={() => setEditing(t)}>
          {canEdit ? "Abrir tarefa" : "Consultar tarefa"}
        </Button>
      ),
    },
  ];
  if (dashboard.isLoading)
    return <LoadingState label="Carregando coordenação de campo" />;
  if (dashboard.isError)
    return (
      <ErrorState
        message={(dashboard.error as Error).message}
        onRetry={() => dashboard.refetch()}
      />
    );
  if (!dashboard.data || !row) return null;
  const summary = dashboard.data.summary;
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Etapas", summary.groups],
          ["Etapas concluídas", summary.groupsCompleted],
          ["Etapas pendentes", summary.groupsPending],
          ["Tarefas aplicáveis", summary.total],
          ["Concluídas", summary.completed],
          ["Bloqueadas", summary.blocked],
          ["Vencidas", summary.overdue],
          ["Pendências vinculadas", summary.linkedIssues],
        ].map(([label, value]) => (
          <MetricCard key={String(label)} label={String(label)} value={value} />
        ))}
      </section>
      <ProgressCard label="Progresso geral de campo" value={summary.percent} />
      <p className="text-sm text-muted-foreground">
        {summary.denominator} {summary.notApplicable} N/A;{" "}
        {summary.conditionallyExcluded} excluídas por condição. Situação:{" "}
        {row.status === "open"
          ? "Aberto"
          : row.status === "completed"
            ? "Concluído"
            : "Arquivado"}
        {row.completedAt
          ? ` · ${formatDateTime(row.completedAt)} · usuário #${row.completedById}`
          : ""}
        .
      </p>
      {!mutable ? (
        <p role="status" className="rounded-lg border p-3">
          O estado atual do projeto permite apenas consulta.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button onClick={() => setAdd(true)}>Nova tarefa</Button>
        ) : null}
        <Button variant="secondary" onClick={() => setHistory(true)}>
          Histórico de campo
        </Button>
        <Button variant="secondary" onClick={() => setMessage(true)}>
          Prévia de mensagem
        </Button>
        {canCoordinate && row.status !== "archived" ? (
          <>
            <Button
              onClick={() =>
                setTransition(
                  row.status === "completed" ? "reopen" : "complete",
                )
              }
            >
              {row.status === "completed"
                ? "Reabrir campo"
                : "Validar conclusão de campo"}
            </Button>
            <Button variant="ghost" onClick={() => setTransition("archive")}>
              Arquivar checklist
            </Button>
          </>
        ) : null}
      </div>
      <section className="premium-panel p-5">
        <h2 className="text-lg font-semibold">Etapas do campo</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {dashboard.data.groups
            .sort((a, b) => a.order - b.order)
            .map((group) => (
              <div key={group.id}>
                <ProgressCard label={group.title} value={group.percent} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {group.completed} concluídas · {group.notApplicable} N/A ·{" "}
                  {group.pending} pendentes · {group.blocked} bloqueadas /{" "}
                  {group.total} aplicáveis
                </p>
              </div>
            ))}
        </div>
      </section>
      <section className="premium-panel p-5">
        <h2 className="font-semibold">Distribuição por responsável</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {dashboard.data.responsibles.map((r, i) => (
            <li key={i}>
              {r.userName
                ? `Usuário: ${r.userName}`
                : r.agentName
                  ? `Inventariante: ${r.agentName}`
                  : "Sem responsável"}{" "}
              — {r.completed}/{r.total} tarefas concluídas
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-label="Filtros das tarefas"
        className="premium-panel grid gap-3 p-4 sm:grid-cols-3"
      >
        <FormField label="Filtrar etapa">
          <select
            className={control}
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            {row.snapshot.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Filtrar estado">
          <select
            className={control}
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(stateLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Filtrar prioridade">
          <select
            className={control}
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            {Object.entries(priorities).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Tipo de responsável">
          <select
            className={control}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setResponsible("");
              setResponsiblePage(1);
              setPage(1);
            }}
          >
            <option value="user">Usuário administrativo</option>
            <option value="field_agent">Inventariante vinculado</option>
          </select>
        </FormField>
        <FormField label="Buscar responsável">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setResponsiblePage(1);
            }}
          />
        </FormField>
        <FormField label="Filtrar responsável">
          <select
            className={control}
            value={responsible}
            onChange={(e) => {
              setResponsible(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {people.data?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        <div className="sm:col-span-3">
          <Pagination
            page={responsiblePage}
            totalPages={Math.max(1, Math.ceil((people.data?.total ?? 0) / 20))}
            onPageChange={setResponsiblePage}
          />
        </div>
        <FormField label="Prazo até">
          <Input
            type="date"
            value={due}
            onChange={(e) => {
              setDue(e.target.value);
              setPage(1);
            }}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked);
              setPage(1);
            }}
          />
          Somente vencidas
        </label>
        {people.isError ? (
          <ErrorState message={(people.error as Error).message} />
        ) : null}
      </section>
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.isError ? (
        <ErrorState message={(tasks.error as Error).message} />
      ) : (
        <>
          <DataTable
            items={tasks.data?.items ?? []}
            columns={columns}
            getKey={(t) => t.id}
          />
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil((tasks.data?.total ?? 0) / 20))}
            onPageChange={setPage}
          />
        </>
      )}
      {editing ? (
        <TaskForm
          project={project}
          row={row}
          task={editing}
          revision={tasks.data?.revision ?? row.revision}
          editable={!!canEdit}
          coordinate={!!canCoordinate}
          onClose={() => setEditing(undefined)}
          onApprove={() => approve.mutate()}
          approvalError={approve.error as Error | null}
        />
      ) : null}
      {add ? (
        <AddTaskForm
          project={project}
          row={row}
          onClose={() => setAdd(false)}
        />
      ) : null}
      {transition ? (
        <TransitionForm
          key={transition}
          project={project}
          row={row}
          action={transition}
          onClose={() => setTransition(undefined)}
        />
      ) : null}
      {history ? (
        <HistoryPanel
          project={project}
          id={id}
          onClose={() => setHistory(false)}
        />
      ) : null}
      {message ? (
        <MessagePanel
          project={project}
          id={id}
          filters={{
            group_id: stage || undefined,
            ...(responsible
              ? {
                  [kind === "user" ? "responsible_user_id" : "field_agent_id"]:
                    Number(responsible),
                }
              : {}),
          }}
          onClose={() => setMessage(false)}
        />
      ) : null}
      {issue && permissions.hasPermission("inventory-pending-issues:read") ? (
        <PendingIssueDetailDrawer
          projectId={project}
          id={issue}
          open
          onOpenChange={(open) => !open && setIssue(undefined)}
        />
      ) : null}
    </>
  );
}
function TaskForm({
  project,
  row,
  task,
  revision,
  editable,
  coordinate,
  onClose,
  onApprove,
  approvalError,
}: {
  project: number;
  row: Checklist;
  task: Task;
  revision: number;
  editable: boolean;
  coordinate: boolean;
  onClose: () => void;
  onApprove: () => void;
  approvalError: Error | null;
}) {
  const permissions = usePermissions();
  const [state, setState] = useState(task.state),
    [title, setTitle] = useState(task.title),
    [priority, setPriority] = useState(task.priority),
    [notes, setNotes] = useState(task.notes ?? ""),
    [reason, setReason] = useState(""),
    [start, setStart] = useState(task.startDate ?? ""),
    [due, setDue] = useState(task.dueDate ?? ""),
    [kind, setKind] = useState<"user" | "field_agent">(
      task.fieldAgentId ? "field_agent" : "user",
    ),
    [person, setPerson] = useState(
      String(task.fieldAgentId ?? task.responsibleUserId ?? ""),
    ),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [issue, setIssue] = useState(String(task.linkedIssueId ?? "")),
    [issuePage, setIssuePage] = useState(1),
    [issueSearch, setIssueSearch] = useState("");
  const people = useQuery({
    queryKey: [...fieldKeys.all(project), "responsibles", kind, search, page],
    queryFn: () =>
      fieldApi.context(project, { kind, search: search || undefined, page }),
  });
  const canLink = permissions.hasPermission("inventory-pending-issues:read");
  const issues = useQuery({
    queryKey: [...fieldKeys.all(project), "issues", issuePage, issueSearch],
    queryFn: () =>
      pendingIssuesApi.list(project, {
        page: issuePage,
        page_size: 20,
        search: issueSearch || undefined,
      }),
    enabled: canLink,
  });
  const issueData = issues.data ? normalizePage(issues.data) : null;
  const mutation = useChange(
    project,
    () =>
      fieldApi.task(project, row.id, task.id, {
        revision,
        state,
        title,
        priority,
        notes: notes || null,
        ...(reason ? { reason } : {}),
        responsible_user_id: kind === "user" && person ? Number(person) : null,
        field_agent_id:
          kind === "field_agent" && person ? Number(person) : null,
        start_date: start || null,
        due_date: due || null,
        ...(canLink ? { linked_issue_id: issue ? Number(issue) : null } : {}),
      }),
    onClose,
  );
  const locked =
    !editable ||
    (["completed", "not_applicable"].includes(task.state) &&
      state === task.state);
  return (
    <ModalForm
      open
      title="Tarefa de campo"
      onOpenChange={(open) => !open && onClose()}
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          {task.definition.description}{" "}
          {task.required ? "Obrigatória." : "Opcional."}{" "}
          {task.applicable
            ? ""
            : "Fora da aplicabilidade atual; respostas históricas preservadas."}
        </p>
        <FormField label="Estado da tarefa">
          <select
            className={control}
            disabled={!editable}
            value={state}
            onChange={(e) => setState(e.target.value as TaskState)}
          >
            {Object.entries(stateLabels)
              .filter(
                ([key]) =>
                  !["completed", "not_applicable"].includes(task.state) ||
                  coordinate ||
                  key === task.state,
              )
              .map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
          </select>
        </FormField>
        {locked && editable ? (
          <p className="text-sm">
            Reabra para pendente ou em andamento, com motivo, antes de editar.
          </p>
        ) : null}
        <fieldset disabled={locked} className="grid gap-3">
          <FormField label="Título da tarefa">
            <Input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField label="Prioridade">
            <select
              className={control}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {Object.entries(priorities).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Vínculo do responsável">
            <select
              className={control}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                setPerson("");
                setPage(1);
              }}
            >
              <option value="user">Usuário administrativo</option>
              <option value="field_agent">
                Inventariante vinculado ao projeto
              </option>
            </select>
          </FormField>
          <FormField label="Pesquisar responsável">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </FormField>
          <FormField
            label="Responsável pela tarefa"
            optional={!task.definition.requires_responsible}
          >
            <select
              className={control}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              required={
                state === "completed" && task.definition.requires_responsible
              }
            >
              <option value="">Não definido</option>
              {person &&
              !people.data?.items.some((p) => String(p.id) === person) ? (
                <option value={person}>Responsável #{person} (atual)</option>
              ) : null}
              {people.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil((people.data?.total ?? 0) / 20))}
            onPageChange={setPage}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Início previsto" optional>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </FormField>
            <FormField
              label="Prazo da tarefa"
              optional={!task.definition.requires_due_date}
            >
              <Input
                type="date"
                required={
                  state === "completed" && task.definition.requires_due_date
                }
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </FormField>
          </div>
          <FormField
            label="Observações da tarefa"
            optional={!task.definition.requires_notes}
          >
            <textarea
              className={control}
              required={state === "completed" && task.definition.requires_notes}
              maxLength={10000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
          {canLink ? (
            <>
              <FormField label="Buscar pendência patrimonial">
                <Input
                  value={issueSearch}
                  onChange={(e) => {
                    setIssueSearch(e.target.value);
                    setIssuePage(1);
                  }}
                />
              </FormField>
              <FormField label="Pendência patrimonial vinculada" optional>
                <select
                  className={control}
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                >
                  <option value="">Sem vínculo</option>
                  {issue &&
                  !issueData?.items.some((p) => String(p.id) === issue) ? (
                    <option value={issue}>Pendência #{issue} (atual)</option>
                  ) : null}
                  {issueData?.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · {p.status}
                    </option>
                  ))}
                </select>
              </FormField>
              <Pagination
                page={issuePage}
                totalPages={Math.max(1, issueData?.totalPages ?? 1)}
                onPageChange={setIssuePage}
              />
              <p className="text-xs text-muted-foreground">
                Os estados da tarefa e da pendência são independentes.
              </p>
            </>
          ) : null}
        </fieldset>
        <FormField
          label="Motivo / justificativa"
          optional={
            !["not_applicable"].includes(state) &&
            !["completed", "not_applicable"].includes(task.state)
          }
        >
          <textarea
            className={control}
            maxLength={5000}
            required={
              state === "not_applicable" ||
              (["completed", "not_applicable"].includes(task.state) &&
                state !== task.state)
            }
            disabled={!editable}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
        {task.completedAt ? (
          <p className="text-sm">
            Concluída em {formatDateTime(task.completedAt)}.
          </p>
        ) : null}
        {people.isError || issues.isError ? (
          <ErrorState
            message={((people.error ?? issues.error) as Error).message}
          />
        ) : null}
        {mutation.isError ? (
          <ErrorState message={(mutation.error as Error).message} />
        ) : null}
        {approvalError ? <ErrorState message={approvalError.message} /> : null}
        {editable ? (
          <Button disabled={mutation.isPending || locked}>Salvar tarefa</Button>
        ) : null}
        {coordinate &&
        row.status === "open" &&
        task.state === "completed" &&
        !task.approvedById ? (
          <Button type="button" variant="secondary" onClick={onApprove}>
            Aprovar tarefa
          </Button>
        ) : null}
      </form>
    </ModalForm>
  );
}
function AddTaskForm({
  project,
  row,
  onClose,
}: {
  project: number;
  row: Checklist;
  onClose: () => void;
}) {
  const [definition, setDefinition] = useState(() => ({
    ...newTask(row.snapshot.groups[0].id, 1000),
    required: false,
  }));
  const mutation = useChange(
    project,
    () =>
      fieldApi.addTask(project, row.id, { revision: row.revision, definition }),
    onClose,
  );
  return (
    <ModalForm
      open
      title="Nova tarefa de campo"
      onOpenChange={(open) => !open && onClose()}
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <TaskDefinitionEditor
          value={definition}
          onChange={setDefinition}
          groups={row.snapshot.groups}
          tasks={row.snapshot.tasks}
        />
        {mutation.isError ? (
          <ErrorState message={(mutation.error as Error).message} />
        ) : null}
        <Button disabled={mutation.isPending}>Criar tarefa</Button>
      </form>
    </ModalForm>
  );
}
function TransitionForm({
  project,
  row,
  action,
  onClose,
}: {
  project: number;
  row: Checklist;
  action: "complete" | "reopen" | "archive";
  onClose: () => void;
}) {
  const [reason, setReason] = useState(""),
    [key] = useState(() => crypto.randomUUID());
  const ready = useQuery({
    queryKey: [...fieldKeys.all(project), row.id, "readiness", row.revision],
    queryFn: () => fieldApi.readiness(project, row.id),
  });
  const mutation = useChange(
    project,
    () =>
      fieldApi.transition(project, row.id, {
        revision: row.revision,
        action,
        reason,
        command_key: key,
      }),
    onClose,
  );
  const title =
    action === "complete"
      ? "Conclusão de campo"
      : action === "reopen"
        ? "Reabrir campo"
        : "Arquivar checklist";
  return (
    <ModalForm open title={title} onOpenChange={(open) => !open && onClose()}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="text-sm">
          Todas as etapas obrigatórias aplicáveis serão verificadas. Esta ação
          não finaliza o projeto nem altera sessões de inventário.
        </p>
        {ready.isLoading ? (
          <LoadingState />
        ) : ready.isError ? (
          <ErrorState message={(ready.error as Error).message} />
        ) : ready.data?.blockers.length ? (
          <ul className="grid gap-2 rounded-lg border border-warning/30 p-3">
            {ready.data.blockers.map((b, i) => (
              <li key={i} className="text-sm">
                Tarefa #{b.task_id} · {b.message}
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="text-sm text-primary">
            Sem impedimentos de tarefas obrigatórias.
          </p>
        )}
        {action !== "complete" ? (
          <FormField label="Motivo da ação">
            <textarea
              required
              className={control}
              maxLength={5000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        ) : null}
        {mutation.isError ? (
          <>
            <ErrorState message={(mutation.error as Error).message} />
            {mutation.error instanceof ApiError &&
            Array.isArray(mutation.error.rawDetails) ? (
              <ul>
                {(mutation.error.rawDetails as Array<{ message: string }>).map(
                  (b, i) => (
                    <li key={i}>{b.message}</li>
                  ),
                )}
              </ul>
            ) : null}
          </>
        ) : null}
        <Button
          disabled={
            mutation.isPending ||
            ready.isLoading ||
            ready.isError ||
            (action === "complete" && !ready.data?.can_complete)
          }
        >
          {action === "complete"
            ? "Confirmar conclusão"
            : action === "reopen"
              ? "Confirmar reabertura"
              : "Confirmar arquivamento"}
        </Button>
      </form>
    </ModalForm>
  );
}
function describeChanges(changes: object): string[] {
  const data = changes as Record<string, unknown>;
  if (
    !data.before ||
    !data.after ||
    typeof data.before !== "object" ||
    typeof data.after !== "object"
  )
    return [];
  const before = data.before as Record<string, unknown>,
    after = data.after as Record<string, unknown>;
  const labels: Record<string, string> = {
    title: "Tarefa",
    state: "Estado",
    priority: "Prioridade",
    dueDate: "Prazo",
    startDate: "Início previsto",
    responsibleUserId: "Usuário responsável",
    fieldAgentId: "Inventariante",
    notes: "Observações",
    reason: "Motivo",
    approvedById: "Aprovador",
  };
  const present = (key: string, value: unknown) =>
    value == null || value === ""
      ? "Não definido"
      : key === "state"
        ? (stateLabels[value as TaskState] ?? String(value))
        : key === "priority"
          ? (priorities[value as Priority] ?? String(value))
          : String(value);
  return Object.entries(labels)
    .filter(([key]) => before[key] !== after[key])
    .map(
      ([key, label]) =>
        `${label}: ${present(key, before[key])} → ${present(key, after[key])}`,
    );
}
function HistoryPanel({
  project,
  id,
  onClose,
}: {
  project: number;
  id: number;
  onClose: () => void;
}) {
  const [before, setBefore] = useState<number>();
  const query = useQuery({
    queryKey: [...fieldKeys.all(project), id, "history", before],
    queryFn: () => fieldApi.history(project, id, before),
  });
  const labels: Record<string, string> = {
    CHECKLIST_CREATE: "Checklist criado",
    TASK_CREATE: "Tarefa criada",
    TASK_UPDATE: "Tarefa alterada/reaberta",
    TASK_APPROVE: "Tarefa aprovada",
    CHECKLIST_COMPLETE: "Campo concluído",
    CHECKLIST_REOPEN: "Campo reaberto",
    CHECKLIST_ARCHIVE: "Checklist arquivado",
    MESSAGE_PREVIEW: "Prévia consultada",
  };
  return (
    <DrawerForm
      open
      title="Histórico de campo"
      onOpenChange={(open) => !open && onClose()}
    >
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : (
        <div className="grid gap-3">
          {query.data?.items.map((event) => (
            <article className="rounded-lg border p-3 text-sm" key={event.id}>
              <p className="font-semibold">
                {labels[event.operation] ?? event.operation}
              </p>
              <p className="text-muted-foreground">
                {formatDateTime(event.createdAt)} · usuário #
                {event.performedById}
              </p>
              {"reason" in event.changes &&
              typeof event.changes.reason === "string" ? (
                <p>{event.changes.reason}</p>
              ) : null}
              {describeChanges(event.changes).map((change, index) => (
                <p key={index} className="mt-1 text-xs text-muted-foreground">
                  {change}
                </p>
              ))}
            </article>
          ))}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setBefore(undefined)}>
              Mais recentes
            </Button>
            <Button
              variant="secondary"
              disabled={!query.data?.next_before_id}
              onClick={() => setBefore(query.data?.next_before_id ?? undefined)}
            >
              Eventos anteriores
            </Button>
          </div>
        </div>
      )}
    </DrawerForm>
  );
}
function MessagePanel({
  project,
  id,
  filters,
  onClose,
}: {
  project: number;
  id: number;
  filters: object;
  onClose: () => void;
}) {
  const [kind, setKind] = useState("initial"),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  const preview = useMutation({
    mutationFn: () => fieldApi.message(project, id, { kind, ...filters }),
  });
  const labels = {
    initial: "Instruções iniciais",
    assigned: "Tarefas atribuídas",
    pending: "Pendências por responsável",
    open: "Atividades em aberto",
    inventory_start: "Orientações para início do inventário",
  };
  return (
    <ModalForm
      open
      title="Prévia de mensagem de campo"
      onOpenChange={(open) => !open && onClose()}
    >
      <div className="grid gap-4">
        <p className="text-sm">
          Usa os filtros atuais de etapa/responsável. Somente prévia e cópia;
          não envia mensagens.
        </p>
        <FormField label="Tipo de orientação">
          <select
            className={control}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              preview.reset();
              setCopied(false);
            }}
          >
            {Object.entries(labels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <Button
          variant="secondary"
          disabled={preview.isPending}
          onClick={() => {
            setCopied(false);
            preview.mutate();
          }}
        >
          Gerar prévia
        </Button>
        {preview.isError ? (
          <ErrorState message={(preview.error as Error).message} />
        ) : null}
        {preview.data ? (
          <>
            <FormField label="Mensagem para revisão">
              <textarea
                readOnly
                rows={12}
                className={control}
                value={preview.data.text}
              />
            </FormField>
            <p className="text-xs text-muted-foreground">
              {preview.data.included} de {preview.data.total} tarefas incluídas.
              Refine os filtros se necessário.
            </p>
            <Button
              onClick={() => {
                void navigator.clipboard
                  .writeText(preview.data!.text)
                  .then(() => setCopied(true))
                  .catch(() =>
                    setCopyError(
                      "Não foi possível copiar. Selecione o texto da prévia.",
                    ),
                  );
              }}
            >
              Copiar prévia revisada
            </Button>
            {copied ? (
              <p role="status">Texto copiado. Nenhuma mensagem foi enviada.</p>
            ) : null}
            {copyError ? <p role="alert">{copyError}</p> : null}
          </>
        ) : null}
      </div>
    </ModalForm>
  );
}
