import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DrawerForm, ModalForm } from "@/components/ui/dialog";
import { FormField } from "@/components/base/FormField";
import { ErrorState, LoadingState } from "@/components/base/States";
import { Pagination } from "@/components/base/Pagination";
import {
  fieldApi,
  fieldKeys,
  newTask,
  stateLabels,
  type Condition,
  type Definition,
  type Group,
  type TaskDefinition,
  type Template,
  type TaskState,
} from "./fieldApi";
export const control =
  "min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const flags: Array<
  [
    keyof Pick<
      TaskDefinition,
      | "required"
      | "allow_not_applicable"
      | "requires_responsible"
      | "requires_due_date"
      | "requires_notes"
      | "requires_approval"
      | "requires_issue_resolved"
    >,
    string,
  ]
> = [
  ["required", "Obrigatória"],
  ["allow_not_applicable", "Permitir N/A com justificativa"],
  ["requires_responsible", "Exigir responsável"],
  ["requires_due_date", "Exigir prazo"],
  ["requires_notes", "Exigir observações na conclusão"],
  ["requires_approval", "Exigir aprovação da coordenação"],
  ["requires_issue_resolved", "Exigir pendência patrimonial resolvida"],
];
export function ConditionsEditor({
  value,
  tasks,
  onChange,
}: {
  value: Condition[];
  tasks: TaskDefinition[];
  onChange: (v: Condition[]) => void;
}) {
  return (
    <fieldset className="grid gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">
        Aplicável quando (todas as condições)
      </legend>
      {value.map((condition, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select
            aria-label={`Tarefa de condição ${index + 1}`}
            className={control}
            value={condition.task_id}
            onChange={(e) =>
              onChange(
                value.map((v, i) =>
                  i === index ? { ...v, task_id: e.target.value } : v,
                ),
              )
            }
          >
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <select
            aria-label={`Estado de condição ${index + 1}`}
            className={control}
            value={condition.states[0]}
            onChange={(e) =>
              onChange(
                value.map((v, i) =>
                  i === index
                    ? { ...v, states: [e.target.value as TaskState] }
                    : v,
                ),
              )
            }
          >
            {Object.entries(stateLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            Remover condição
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={!tasks.length || value.length >= 10}
        onClick={() =>
          onChange([...value, { task_id: tasks[0].id, states: ["completed"] }])
        }
      >
        Adicionar condição
      </Button>
    </fieldset>
  );
}
export function TaskDefinitionEditor({
  value,
  onChange,
  groups,
  tasks,
}: {
  value: TaskDefinition;
  onChange: (v: TaskDefinition) => void;
  groups: Group[];
  tasks: TaskDefinition[];
}) {
  return (
    <div className="grid gap-3">
      <FormField label="Nome da tarefa">
        <Input
          required
          maxLength={200}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </FormField>
      <FormField label="Etapa">
        <select
          className={control}
          value={value.group_id}
          onChange={(e) => onChange({ ...value, group_id: e.target.value })}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Descrição da tarefa" optional>
        <textarea
          className={control}
          maxLength={5000}
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </FormField>
      <FormField label="Ordem da tarefa">
        <Input
          type="number"
          min={0}
          max={10000}
          required
          value={value.order}
          onChange={(e) =>
            onChange({ ...value, order: Number(e.target.value) })
          }
        />
      </FormField>
      <div className="grid gap-2 sm:grid-cols-2">
        {flags.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <ConditionsEditor
        value={value.applicable_if ?? []}
        tasks={tasks.filter((t) => t.id !== value.id)}
        onChange={(applicable_if) => onChange({ ...value, applicable_if })}
      />
    </div>
  );
}
export function FieldTemplates({
  org,
  canEdit,
  onClose,
}: {
  org: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient(),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<number>(),
    [editing, setEditing] = useState<Template | null | undefined>(),
    [version, setVersion] = useState<number>();
  const list = useQuery({
    queryKey: [...fieldKeys.templates(org), page],
    queryFn: () => fieldApi.templates(org, page),
  });
  const detail = useQuery({
    queryKey: [...fieldKeys.templates(org), "detail", selected, version],
    queryFn: () => fieldApi.template(org, selected!, version),
    enabled: !!selected,
  });
  const archive = useMutation({
    mutationFn: () => fieldApi.archiveTemplate(org, detail.data!),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: fieldKeys.templates(org) }),
  });
  return (
    <DrawerForm
      open
      title="Modelos de Coordenação de Campo"
      onOpenChange={(open) => !open && onClose()}
    >
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Versões imutáveis. Alterações não mudam tarefas ou snapshots dos
          checklists existentes.
        </p>
        {canEdit ? (
          <Button onClick={() => setEditing(null)}>Novo modelo de campo</Button>
        ) : null}
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState message={(list.error as Error).message} />
        ) : (
          <>
            <FormField label="Modelo de campo">
              <select
                className={control}
                value={selected ?? ""}
                onChange={(e) => {
                  setSelected(Number(e.target.value));
                  setVersion(undefined);
                }}
              >
                <option value="">Selecione</option>
                {list.data?.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · v{t.currentVersion}
                    {t.archivedAt ? " · Arquivado" : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil((list.data?.total ?? 0) / 20))}
              onPageChange={setPage}
            />
          </>
        )}
        {detail.isError ? (
          <ErrorState message={(detail.error as Error).message} />
        ) : null}
        {detail.data ? (
          <>
            <FormField label="Consultar versão">
              <Input
                type="number"
                min={1}
                max={detail.data.currentVersion}
                value={version ?? detail.data.currentVersion}
                onChange={(e) => setVersion(Number(e.target.value))}
              />
            </FormField>
            <p className="text-sm">{detail.data.description}</p>
            {detail.data.definition.groups.map((g) => (
              <section className="rounded-lg border p-3" key={g.id}>
                <h3 className="font-semibold">
                  {g.order + 1}. {g.title}
                </h3>
                <ul className="mt-2 grid gap-1 text-sm">
                  {detail
                    .data!.definition.tasks.filter((t) => t.group_id === g.id)
                    .map((t) => (
                      <li key={t.id}>
                        {t.title}
                        {t.required ? " · Obrigatória" : ""}
                      </li>
                    ))}
                </ul>
              </section>
            ))}
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={
                    !!detail.data.archivedAt ||
                    (!!version && version !== detail.data.currentVersion)
                  }
                  onClick={() => setEditing(detail.data)}
                >
                  Editar e publicar versão
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => archive.mutate()}
                  disabled={archive.isPending}
                >
                  {detail.data.archivedAt
                    ? "Restaurar modelo"
                    : "Arquivar modelo"}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
        {archive.isError ? (
          <ErrorState message={(archive.error as Error).message} />
        ) : null}
      </div>
      {editing !== undefined ? (
        <ModelForm
          org={org}
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(id) => {
            setSelected(id);
            setVersion(undefined);
            setEditing(undefined);
            void client.invalidateQueries({
              queryKey: fieldKeys.templates(org),
            });
          }}
        />
      ) : null}
    </DrawerForm>
  );
}
function ModelForm({
  org,
  existing,
  onClose,
  onSaved,
}: {
  org: number;
  existing: Template | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [name, setName] = useState(existing?.name ?? ""),
    [description, setDescription] = useState(existing?.description ?? ""),
    [definition, setDefinition] = useState<Definition>(() =>
      existing
        ? structuredClone(existing.definition)
        : {
            groups: [
              {
                id: "stage_" + crypto.randomUUID().replaceAll("-", ""),
                title: "Etapa inicial",
                order: 0,
                required: false,
              },
            ],
            tasks: [],
          },
    );
  const [taskIndex, setTaskIndex] = useState<number>();
  const mutation = useMutation({
    mutationFn: () =>
      fieldApi.saveTemplate(
        org,
        {
          name,
          description,
          definition,
          ...(existing ? { expected_version: existing.currentVersion } : {}),
        },
        existing?.id,
      ),
    onSuccess: (row) => onSaved(row.id),
  });
  const updateGroup = (id: string, change: Partial<Group>) =>
    setDefinition((d) => ({
      ...d,
      groups: d.groups.map((g) => (g.id === id ? { ...g, ...change } : g)),
    }));
  return (
    <ModalForm
      open
      title={existing ? "Publicar versão do modelo" : "Novo modelo de campo"}
      onOpenChange={(open) => !open && onClose()}
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <FormField label="Nome do modelo">
          <Input
            required
            minLength={2}
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="Descrição do modelo" optional>
          <textarea
            className={control}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        {definition.groups.map((group, index) => (
          <section key={group.id} className="grid gap-3 rounded-xl border p-3">
            <FormField label={`Nome da etapa ${index + 1}`}>
              <Input
                required
                value={group.title}
                onChange={(e) =>
                  updateGroup(group.id, { title: e.target.value })
                }
              />
            </FormField>
            <FormField label={`Ordem da etapa ${index + 1}`}>
              <Input
                type="number"
                min={0}
                max={10000}
                required
                value={group.order}
                onChange={(e) =>
                  updateGroup(group.id, { order: Number(e.target.value) })
                }
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(e) =>
                  updateGroup(group.id, { required: e.target.checked })
                }
              />
              Todas as tarefas desta etapa são obrigatórias
            </label>
            <ConditionsEditor
              value={group.applicable_if ?? []}
              tasks={definition.tasks.filter((t) => t.group_id !== group.id)}
              onChange={(applicable_if) =>
                updateGroup(group.id, { applicable_if })
              }
            />
            {definition.tasks
              .filter((t) => t.group_id === group.id)
              .sort((a, b) => a.order - b.order)
              .map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>{task.title}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setTaskIndex(
                        definition.tasks.findIndex((t) => t.id === task.id),
                      )
                    }
                  >
                    Editar tarefa
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDefinition((d) => ({
                        ...d,
                        tasks: d.tasks.filter((t) => t.id !== task.id),
                      }))
                    }
                  >
                    Remover tarefa
                  </Button>
                </div>
              ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDefinition((d) => ({
                  ...d,
                  tasks: [...d.tasks, newTask(group.id, d.tasks.length)],
                }));
                setTaskIndex(definition.tasks.length);
              }}
            >
              Adicionar tarefa à etapa {index + 1}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={definition.groups.length === 1}
              onClick={() =>
                setDefinition((d) => ({
                  ...d,
                  groups: d.groups.filter((g) => g.id !== group.id),
                  tasks: d.tasks.filter((t) => t.group_id !== group.id),
                }))
              }
            >
              Remover etapa do modelo
            </Button>
          </section>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={definition.groups.length >= 50}
          onClick={() =>
            setDefinition((d) => ({
              ...d,
              groups: [
                ...d.groups,
                {
                  id: "stage_" + crypto.randomUUID().replaceAll("-", ""),
                  title: "Nova etapa",
                  order: d.groups.length,
                  required: false,
                },
              ],
            }))
          }
        >
          Adicionar etapa
        </Button>
        <p className="text-xs text-muted-foreground">
          Cada etapa precisa ter tarefas. Condições são validadas no servidor;
          ciclos são rejeitados.
        </p>
        {mutation.isError ? (
          <ErrorState message={(mutation.error as Error).message} />
        ) : null}
        <Button disabled={mutation.isPending || !definition.tasks.length}>
          {mutation.isPending
            ? "Salvando…"
            : existing
              ? "Publicar versão"
              : "Salvar modelo"}
        </Button>
      </form>
      {taskIndex !== undefined && definition.tasks[taskIndex] ? (
        <ModalForm
          open
          title="Definição da tarefa"
          onOpenChange={(open) => !open && setTaskIndex(undefined)}
        >
          <TaskDefinitionEditor
            value={definition.tasks[taskIndex]}
            groups={definition.groups}
            tasks={definition.tasks}
            onChange={(task) =>
              setDefinition((d) => ({
                ...d,
                tasks: d.tasks.map((t, i) => (i === taskIndex ? task : t)),
              }))
            }
          />
          <Button className="mt-4" onClick={() => setTaskIndex(undefined)}>
            Aplicar tarefa ao modelo
          </Button>
        </ModalForm>
      ) : null}
    </ModalForm>
  );
}
