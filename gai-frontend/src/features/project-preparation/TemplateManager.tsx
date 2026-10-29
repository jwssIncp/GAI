import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { FormField } from '@/components/base/FormField';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, DrawerForm, ModalForm } from '@/components/ui/dialog';
import {
  preparationApi,
  preparationKeys,
  usePreparationTemplates,
} from './preparationQueries';
import { referenceTemplate } from './referenceTemplates';
import {
  kindLabels,
  questionTypeLabels,
  type Condition,
  type PreparationKind,
  type PreparationQuestion,
  type PreparationTemplate,
  type QuestionType,
  type Scalar,
  type TemplatePayload,
} from './preparationTypes';

const control =
  'min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm';
function newQuestion(order: number): PreparationQuestion {
  return {
    id: `q_${crypto.randomUUID().replaceAll('-', '')}`,
    category: 'Geral',
    label: 'Nova pergunta',
    type: 'text',
    order,
    required: false,
    visible: true,
    allow_not_applicable: true,
  };
}
export function TemplateManager({
  organizationId,
  kind,
  canEdit,
  onClose,
}: {
  organizationId: number;
  kind: PreparationKind;
  canEdit: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const list = usePreparationTemplates(organizationId);
  const [selected, setSelected] = useState<number>();
  const [draft, setDraft] = useState<TemplatePayload | null>(null);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [viewVersion, setViewVersion] = useState<number>();
  const [message, setMessage] = useState('');
  const detail = useQuery({
    queryKey: [
      ...preparationKeys.templates(organizationId),
      'detail',
      selected,
    ],
    queryFn: () => preparationApi.template(organizationId, selected!),
    enabled: Boolean(selected),
    retry: false,
  });
  const historical = useQuery({
    queryKey: [
      ...preparationKeys.templates(organizationId),
      'version',
      selected,
      viewVersion,
    ],
    queryFn: () =>
      preparationApi.version(organizationId, selected!, viewVersion!),
    enabled: Boolean(selected && viewVersion),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (task: () => Promise<PreparationTemplate>) => task(),
    onSuccess: async (item) => {
      await client.invalidateQueries({
        queryKey: preparationKeys.templates(organizationId),
      });
      setSelected(item.id);
      setDraft(null);
      setEditing(false);
      setArchiving(false);
      setViewVersion(undefined);
      setMessage(
        'Modelo salvo. Preparações existentes mantêm suas versões e respostas.',
      );
    },
  });
  const item = detail.data;
  const questions = viewVersion ? historical.data?.questions : item?.questions;
  return (
    <DrawerForm
      open
      onOpenChange={(open) => !open && onClose()}
      title="Modelos da organização"
    >
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Modelos reutilizáveis de {kindLabels[kind]}. Alterações publicam uma
          nova versão; preparações já criadas permanecem intactas.
        </p>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setDraft(referenceTemplate(kind));
                setEditing(true);
                setMessage('');
                mutation.reset();
              }}
            >
              Novo modelo de referência
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft({ name: '', kind, questions: [newQuestion(0)] });
                setEditing(true);
                mutation.reset();
              }}
            >
              Modelo em branco
            </Button>
          </div>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-primary">
            {message}
          </p>
        ) : null}
        {mutation.isError ? (
          <ErrorState message={(mutation.error as Error).message} />
        ) : null}
        {list.isLoading ? (
          <LoadingState label="Carregando modelos" />
        ) : list.isError ? (
          <ErrorState
            message={(list.error as Error).message}
            onRetry={() => list.refetch()}
          />
        ) : (
          <>
            <FormField label="Modelo">
              <select
                className={control}
                value={selected ?? ''}
                onChange={(e) => {
                  setSelected(Number(e.target.value));
                  setViewVersion(undefined);
                  setMessage('');
                  mutation.reset();
                }}
              >
                <option value="">Selecione um modelo</option>
                {list.data?.items
                  .filter((model) => model.kind === kind)
                  .map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · v{model.current_version}
                      {model.archived_at ? ' · arquivado' : ''}
                    </option>
                  ))}
              </select>
            </FormField>
            {!list.data?.items.some((model) => model.kind === kind) ? (
              <EmptyState
                title="Nenhum modelo nesta categoria"
                description="Crie um modelo e revise as perguntas antes de utilizar nos projetos."
              />
            ) : null}
          </>
        )}
        {selected && detail.isLoading ? (
          <LoadingState />
        ) : selected && detail.isError ? (
          <ErrorState
            message={(detail.error as Error).message}
            onRetry={() => detail.refetch()}
          />
        ) : item ? (
          <>
            <div className="flex flex-wrap gap-2">
              {canEdit && !item.archived_at ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraft(null);
                    setEditing(true);
                    mutation.reset();
                  }}
                >
                  Editar nova versão
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate(() =>
                      preparationApi.cloneTemplate(organizationId, item.id),
                    )
                  }
                >
                  Clonar modelo
                </Button>
              ) : null}
              {canEdit && !item.archived_at ? (
                <Button variant="ghost" onClick={() => setArchiving(true)}>
                  Arquivar modelo
                </Button>
              ) : null}
            </div>
            <FormField label="Versão para consulta">
              <select
                className={control}
                value={viewVersion ?? ''}
                onChange={(e) =>
                  setViewVersion(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              >
                <option value="">Atual · v{item.current_version}</option>
                {item.versions?.map((version) => (
                  <option key={version.version} value={version.version}>
                    v{version.version} · {version.name}
                  </option>
                ))}
              </select>
            </FormField>
            {viewVersion && historical.isLoading ? (
              <LoadingState />
            ) : historical.isError ? (
              <ErrorState message={(historical.error as Error).message} />
            ) : (
              <ol className="grid gap-2">
                {questions?.map((q) => (
                  <li key={q.id} className="rounded-lg border p-3 text-sm">
                    <span className="font-semibold">{q.label}</span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.category} · {questionTypeLabels[q.type]} ·{' '}
                      {q.required ? 'Obrigatória' : 'Opcional'} ·{' '}
                      {q.visible ? 'Visível' : 'Oculta'}
                      {q.enabled_when?.length ? ' · Condicional' : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : null}
        {editing && (draft || item) ? (
          <TemplateEditor
            key={draft ? 'new' : `${item!.id}-${item!.current_version}`}
            initial={
              draft ?? {
                name: item!.name,
                kind: item!.kind,
                questions: item!.questions!,
              }
            }
            existing={!draft}
            busy={mutation.isPending}
            error={
              mutation.isError ? (mutation.error as Error).message : undefined
            }
            onClose={() => setEditing(false)}
            onSave={(payload) =>
              mutation.mutate(() =>
                draft
                  ? preparationApi.createTemplate(organizationId, payload)
                  : preparationApi.updateTemplate(organizationId, item!.id, {
                      name: payload.name,
                      questions: payload.questions,
                      expected_version: item!.current_version,
                    }),
              )
            }
          />
        ) : null}
        <ConfirmDialog
          open={archiving}
          onOpenChange={setArchiving}
          title="Arquivar modelo"
          description="O modelo não poderá originar novas preparações. Versões e respostas existentes serão preservadas."
          busy={mutation.isPending}
          onConfirm={() =>
            item &&
            mutation.mutate(() =>
              preparationApi.archiveTemplate(
                organizationId,
                item.id,
                item.current_version,
              ),
            )
          }
        />
      </div>
    </DrawerForm>
  );
}
function TemplateEditor({
  initial,
  existing,
  busy,
  error,
  onClose,
  onSave,
}: {
  initial: TemplatePayload;
  existing: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (payload: TemplatePayload) => void;
}) {
  const [payload, setPayload] = useState<TemplatePayload>(() =>
    structuredClone(initial),
  );
  const [questionId, setQuestionId] = useState<string>();
  const question = payload.questions.find((q) => q.id === questionId);
  function move(index: number, offset: number) {
    const questions = [...payload.questions];
    const other = index + offset;
    if (other < 0 || other >= questions.length) return;
    [questions[index], questions[other]] = [questions[other], questions[index]];
    setPayload({ ...payload, questions });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    onSave({
      ...payload,
      questions: payload.questions.map((q, order) => ({ ...q, order })),
    });
  }
  return (
    <ModalForm
      open
      onOpenChange={(open) => !open && onClose()}
      title={existing ? 'Publicar nova versão do modelo' : 'Criar modelo'}
    >
      <form onSubmit={submit} className="grid gap-4">
        <FormField label="Nome do modelo">
          <Input
            required
            maxLength={200}
            value={payload.name}
            onChange={(e) => setPayload({ ...payload, name: e.target.value })}
          />
        </FormField>
        <p className="text-xs text-muted-foreground">
          Visibilidade e obrigatoriedade são independentes. Para ocultar uma
          pergunta obrigatória, altere também sua obrigatoriedade
          explicitamente. N/A exige justificativa na resposta.
        </p>
        <ol className="grid gap-2">
          {payload.questions.map((q, index) => (
            <li key={q.id} className="grid gap-2 rounded-lg border p-3">
              <span className="text-sm font-semibold">
                {index + 1}. {q.label}
              </span>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setQuestionId(q.id)}
                  aria-label={`Editar pergunta ${index + 1}`}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Mover pergunta ${index + 1} para cima`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === payload.questions.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Mover pergunta ${index + 1} para baixo`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPayload({
                      ...payload,
                      questions: payload.questions.filter(
                        (item) => item.id !== q.id,
                      ),
                    })
                  }
                >
                  Remover desta versão
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="secondary"
          disabled={payload.questions.length >= 120}
          onClick={() => {
            const q = newQuestion(payload.questions.length);
            setPayload({ ...payload, questions: [...payload.questions, q] });
            setQuestionId(q.id);
          }}
        >
          Adicionar pergunta
        </Button>
        {error ? <ErrorState message={error} /> : null}
        <Button
          disabled={busy || !payload.name.trim() || !payload.questions.length}
        >
          {busy ? 'Salvando…' : existing ? 'Publicar versão' : 'Salvar modelo'}
        </Button>
      </form>
      {question ? (
        <QuestionEditor
          key={question.id}
          initial={question}
          questions={payload.questions}
          typeLocked={
            existing && initial.questions.some((q) => q.id === question.id)
          }
          onClose={() => setQuestionId(undefined)}
          onSave={(updated) => {
            setPayload({
              ...payload,
              questions: payload.questions.map((q) =>
                q.id === updated.id ? updated : q,
              ),
            });
            setQuestionId(undefined);
          }}
        />
      ) : null}
    </ModalForm>
  );
}
function QuestionEditor({
  initial,
  questions,
  typeLocked,
  onClose,
  onSave,
}: {
  initial: PreparationQuestion;
  questions: PreparationQuestion[];
  typeLocked: boolean;
  onClose: () => void;
  onSave: (q: PreparationQuestion) => void;
}) {
  const [q, setQ] = useState<PreparationQuestion>(() =>
    structuredClone(initial),
  );
  const [options, setOptions] = useState(initial.options?.join('\n') ?? '');
  const sources = questions.filter((item) => item.id !== q.id);
  return (
    <ModalForm
      open
      onOpenChange={(open) => !open && onClose()}
      title="Configurar pergunta"
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...q,
            ...(q.type === 'select'
              ? {
                  options: options
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }
              : {}),
          });
        }}
      >
        <FormField label="Pergunta">
          <Input
            required
            maxLength={500}
            value={q.label}
            onChange={(e) => setQ({ ...q, label: e.target.value })}
          />
        </FormField>
        <FormField label="Categoria">
          <Input
            required
            maxLength={100}
            value={q.category}
            onChange={(e) => setQ({ ...q, category: e.target.value })}
          />
        </FormField>
        <FormField
          label="Tipo"
          hint={
            typeLocked
              ? 'Para mudar o tipo, adicione uma nova pergunta. A identidade histórica será preservada.'
              : undefined
          }
        >
          <select
            className={control}
            value={q.type}
            disabled={typeLocked}
            onChange={(e) => {
              const next = { ...q, type: e.target.value as QuestionType };
              delete next.options;
              delete next.quantity_question_id;
              setQ(next);
            }}
          >
            {Object.entries(questionTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        {q.type === 'select' ? (
          <FormField label="Opções, uma por linha">
            <textarea
              required
              className={control}
              rows={4}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
            />
          </FormField>
        ) : null}
        {q.type === 'sequence' ? (
          <FormField label="Conferir quantidade com" optional>
            <select
              className={control}
              value={q.quantity_question_id ?? ''}
              onChange={(e) => {
                const next = { ...q };
                if (e.target.value) next.quantity_question_id = e.target.value;
                else delete next.quantity_question_id;
                setQ(next);
              }}
            >
              <option value="">Somente validar início e fim</option>
              {sources
                .filter((item) => item.type === 'number')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
            </select>
          </FormField>
        ) : null}
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={q.required}
            onChange={(e) => setQ({ ...q, required: e.target.checked })}
          />
          Obrigatória quando aplicável
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={q.visible}
            onChange={(e) => setQ({ ...q, visible: e.target.checked })}
          />
          Visível no preenchimento
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={q.allow_not_applicable}
            onChange={(e) =>
              setQ({ ...q, allow_not_applicable: e.target.checked })
            }
          />
          Permitir não aplicável com justificativa
        </label>
        {q.required && !q.visible ? (
          <p role="alert" className="text-sm text-destructive">
            Uma pergunta obrigatória não pode ficar oculta.
          </p>
        ) : null}
        <section className="grid gap-3 rounded-lg border p-3">
          <h3 className="text-sm font-bold">Habilitar somente quando</h3>
          <p className="text-xs text-muted-foreground">
            Todas as condições devem ser atendidas por respostas concluídas. Sem
            condições, a pergunta fica habilitada.
          </p>
          {(q.enabled_when ?? []).map((condition, index) => (
            <ConditionEditor
              key={index}
              condition={condition}
              sources={sources}
              onChange={(next) =>
                setQ({
                  ...q,
                  enabled_when: q.enabled_when!.map((c, i) =>
                    i === index ? next : c,
                  ),
                })
              }
              onRemove={() =>
                setQ({
                  ...q,
                  enabled_when: q.enabled_when!.filter((_, i) => i !== index),
                })
              }
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!sources.length || (q.enabled_when?.length ?? 0) >= 10}
            onClick={() =>
              setQ({
                ...q,
                enabled_when: [
                  ...(q.enabled_when ?? []),
                  { question_id: sources[0].id, operator: 'answered' },
                ],
              })
            }
          >
            Adicionar condição
          </Button>
        </section>
        <Button
          disabled={
            !q.label.trim() || !q.category.trim() || (q.required && !q.visible)
          }
        >
          Aplicar pergunta
        </Button>
      </form>
    </ModalForm>
  );
}
function ConditionEditor({
  condition,
  sources,
  onChange,
  onRemove,
}: {
  condition: Condition;
  sources: PreparationQuestion[];
  onChange: (condition: Condition) => void;
  onRemove: () => void;
}) {
  const source = sources.find((q) => q.id === condition.question_id);
  const value = Array.isArray(condition.value)
    ? condition.value.join(', ')
    : condition.value;
  function changeValue(raw: string) {
    const parse = (v: string): Scalar =>
      source?.type === 'boolean'
        ? v === 'true'
        : source?.type === 'number'
          ? Number(v)
          : v;
    onChange({
      ...condition,
      value:
        condition.operator === 'in'
          ? raw.split(',').map((v) => parse(v.trim()))
          : parse(raw),
    });
  }
  return (
    <div className="grid gap-2 border-t pt-3">
      <FormField label="Pergunta de origem">
        <select
          className={control}
          value={condition.question_id}
          onChange={(e) =>
            onChange({ question_id: e.target.value, operator: 'answered' })
          }
        >
          {sources.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Condição">
        <select
          className={control}
          value={condition.operator}
          onChange={(e) =>
            onChange({
              question_id: condition.question_id,
              operator: e.target.value as Condition['operator'],
            })
          }
        >
          <option value="answered">Foi respondida</option>
          {!['sequence', 'unit_allocations'].includes(source?.type ?? '') ? (
            <>
              <option value="equals">É igual a</option>
              <option value="not_equals">É diferente de</option>
              <option value="in">É um destes valores</option>
            </>
          ) : null}
        </select>
      </FormField>
      {condition.operator !== 'answered' ? (
        <FormField
          label={
            condition.operator === 'in'
              ? 'Valores separados por vírgula'
              : 'Valor esperado'
          }
        >
          {source?.type === 'boolean' && condition.operator !== 'in' ? (
            <select
              className={control}
              value={value === undefined ? '' : String(value)}
              required
              onChange={(e) => changeValue(e.target.value)}
            >
              <option value="">Selecione</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          ) : (
            <Input
              required
              value={String(value ?? '')}
              type={
                source?.type === 'number' && condition.operator !== 'in'
                  ? 'number'
                  : 'text'
              }
              onChange={(e) => changeValue(e.target.value)}
            />
          )}
        </FormField>
      ) : null}
      <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
        Remover condição
      </Button>
    </div>
  );
}
