import { type FormEvent, type SelectHTMLAttributes, useState } from 'react';
import { FormField } from '@/components/base/FormField';
import { ErrorState } from '@/components/base/States';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalForm } from '@/components/ui/dialog';
import { preparationApi, usePreparationMutation } from './preparationQueries';
import type {
  AnswerPayload,
  AnswerValue,
  Preparation,
  PreparationAnswer,
  PreparationContext,
  PreparationMetadata,
  PreparationQuestion,
  PreparationTemplate,
} from './preparationTypes';

const control =
  'min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm';
export function ResponsibleSelect({
  users,
  value,
  onChange,
  ...attributes
}: {
  users: PreparationContext['responsible_users'];
  value: number | null;
  onChange: (value: number | null) => void;
} & Pick<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'aria-describedby' | 'aria-invalid'
>) {
  return (
    <select
      {...attributes}
      className={control}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">Não definido</option>
      {value && !users.some((u) => u.id === value) ? (
        <option value={value}>Usuário #{value} (indisponível)</option>
      ) : null}
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.label}
        </option>
      ))}
    </select>
  );
}
function MetadataFields({
  value,
  onChange,
  context,
}: {
  value: PreparationMetadata;
  onChange: (value: PreparationMetadata) => void;
  context: PreparationContext;
}) {
  return (
    <>
      <FormField label="Título">
        <Input
          required
          maxLength={200}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </FormField>
      <FormField label="Responsável" optional>
        <ResponsibleSelect
          users={context.responsible_users}
          value={value.responsible_user_id}
          onChange={(v) => onChange({ ...value, responsible_user_id: v })}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Data da preparação" optional>
          <Input
            type="date"
            value={value.scheduled_date ?? ''}
            onChange={(e) =>
              onChange({ ...value, scheduled_date: e.target.value || null })
            }
          />
        </FormField>
        <FormField label="Prazo" optional>
          <Input
            type="date"
            value={value.due_date ?? ''}
            onChange={(e) =>
              onChange({ ...value, due_date: e.target.value || null })
            }
          />
        </FormField>
      </div>
    </>
  );
}
export function CreatePreparationForm({
  projectId,
  context,
  templates,
  onCreated,
  onClose,
}: {
  projectId: number;
  context: PreparationContext;
  templates: PreparationTemplate[];
  onCreated: (id: number) => void;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 0);
  const [version, setVersion] = useState('');
  const [metadata, setMetadata] = useState<PreparationMetadata>({
    title: '',
    responsible_user_id: null,
    scheduled_date: null,
    due_date: null,
  });
  const template = templates.find((item) => item.id === templateId);
  const mutation = usePreparationMutation(projectId, () =>
    preparationApi.create(projectId, {
      ...metadata,
      template_id: templateId,
      ...(version ? { template_version: Number(version) } : {}),
    }),
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(undefined, {
      onSuccess: (result) => {
        onCreated(result.id);
      },
    });
  }
  return (
    <ModalForm
      open
      onOpenChange={(open) => !open && onClose()}
      title="Nova preparação"
    >
      <form onSubmit={submit} className="grid gap-4">
        <FormField label="Modelo">
          <select
            className={control}
            required
            value={templateId || ''}
            onChange={(e) => {
              setTemplateId(Number(e.target.value));
              setVersion('');
            }}
          >
            <option value="" disabled>
              Selecione um modelo
            </option>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · v{item.current_version}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Versão do modelo"
          hint="A versão escolhida será preservada nesta preparação."
        >
          <Input
            type="number"
            min={1}
            max={template?.current_version}
            placeholder={`Atual: ${template?.current_version ?? '—'}`}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </FormField>
        <MetadataFields
          context={context}
          value={metadata}
          onChange={setMetadata}
        />
        {!templates.length ? (
          <p role="status" className="text-sm text-muted-foreground">
            Crie um modelo desta categoria para começar.
          </p>
        ) : null}
        {mutation.isError ? (
          <ErrorState message={(mutation.error as Error).message} />
        ) : null}
        <Button
          disabled={mutation.isPending || !templateId || !metadata.title.trim()}
        >
          {mutation.isPending ? 'Criando…' : 'Criar preparação'}
        </Button>
      </form>
    </ModalForm>
  );
}
export function EditPreparationForm({
  projectId,
  context,
  instance,
  onClose,
  onSaved,
}: {
  projectId: number;
  context: PreparationContext;
  instance: Preparation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [metadata, setMetadata] = useState<PreparationMetadata>({
    title: instance.title,
    responsible_user_id: instance.responsible_user_id,
    scheduled_date: instance.scheduled_date,
    due_date: instance.due_date,
    notes: instance.notes,
  });
  const mutation = usePreparationMutation(projectId, () =>
    preparationApi.update(projectId, instance.id, {
      ...metadata,
      revision: instance.revision,
    }),
  );
  return (
    <ModalForm
      open
      onOpenChange={(open) => !open && onClose()}
      title="Dados da preparação"
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(undefined, { onSuccess: onSaved });
        }}
      >
        <MetadataFields
          value={metadata}
          onChange={setMetadata}
          context={context}
        />
        <FormField label="Observações gerais" optional>
          <textarea
            className={control}
            rows={4}
            maxLength={10000}
            value={metadata.notes ?? ''}
            onChange={(e) =>
              setMetadata({ ...metadata, notes: e.target.value || null })
            }
          />
        </FormField>
        {mutation.isError ? (
          <ErrorState message={(mutation.error as Error).message} />
        ) : null}
        <Button disabled={mutation.isPending || !metadata.title.trim()}>
          {mutation.isPending ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </form>
    </ModalForm>
  );
}
export function AnswerValueInput({
  question,
  value,
  onChange,
  units,
}: {
  question: PreparationQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  units: PreparationContext['units'];
}) {
  if (question.type === 'boolean')
    return (
      <select
        aria-label="Resposta"
        className={control}
        required
        value={typeof value === 'boolean' ? String(value) : ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : e.target.value === 'true')
        }
      >
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  if (question.type === 'select')
    return (
      <select
        aria-label="Resposta"
        className={control}
        required
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Selecione</option>
        {question.options?.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  if (question.type === 'sequence') {
    const sequence =
      value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : { start: 0, end: 0 };
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Número inicial">
          <Input
            type="number"
            min={0}
            step={1}
            required
            value={sequence.start}
            onChange={(e) =>
              onChange({ ...sequence, start: Number(e.target.value) })
            }
          />
        </FormField>
        <FormField label="Número final">
          <Input
            type="number"
            min={sequence.start}
            step={1}
            required
            value={sequence.end}
            onChange={(e) =>
              onChange({ ...sequence, end: Number(e.target.value) })
            }
          />
        </FormField>
        {question.quantity_question_id ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            O intervalo deve conter a quantidade de etiquetas informada
            anteriormente.
          </p>
        ) : null}
      </div>
    );
  }
  if (question.type === 'unit_allocations') {
    const entries = Array.isArray(value) ? value : [];
    const total = entries.reduce((sum, row) => sum + row.quantity, 0);
    return (
      <div className="grid gap-3">
        {!units.length ? (
          <p className="text-sm text-muted-foreground">
            Vincule unidades existentes ao projeto na área de unidades antes de
            responder.
          </p>
        ) : (
          units.map((unit) => {
            const entry = entries.find((row) => row.unit_id === unit.id);
            return (
              <div key={unit.id} className="grid gap-2 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(entry)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...entries, { unit_id: unit.id, quantity: 0 }]
                          : entries.filter((row) => row.unit_id !== unit.id),
                      )
                    }
                  />
                  {unit.name}
                </label>
                <p className="text-xs text-muted-foreground">{unit.address}</p>
                {entry ? (
                  <FormField label={`Quantidade em ${unit.name}`}>
                    <Input
                      type="number"
                      min={0}
                      max={1e9}
                      step={1}
                      required
                      value={entry.quantity}
                      onChange={(e) =>
                        onChange(
                          entries.map((row) =>
                            row.unit_id === unit.id
                              ? { ...row, quantity: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </FormField>
                ) : null}
              </div>
            );
          })
        )}
        <p className="text-sm font-semibold">Total informado: {total} itens</p>
        <p className="text-xs text-muted-foreground">
          A participação será calculada pelo servidor após salvar.
        </p>
      </div>
    );
  }
  if (question.type === 'long_text')
    return (
      <textarea
        aria-label="Resposta"
        required
        rows={5}
        maxLength={10000}
        className={control}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <Input
      aria-label="Resposta"
      required
      type={
        question.type === 'number'
          ? 'number'
          : question.type === 'date'
            ? 'date'
            : 'text'
      }
      min={question.type === 'number' ? 0 : undefined}
      max={question.type === 'number' ? 1e12 : undefined}
      step={question.type === 'number' ? 'any' : undefined}
      maxLength={2000}
      value={
        typeof value === 'string' || typeof value === 'number' ? value : ''
      }
      onChange={(e) =>
        onChange(
          question.type === 'number'
            ? e.target.value === ''
              ? null
              : Number(e.target.value)
            : e.target.value,
        )
      }
    />
  );
}
export function AnswerForm({
  projectId,
  instance,
  question,
  answer,
  context,
  onClose,
  onSaved,
}: {
  projectId: number;
  instance: Preparation;
  question: PreparationQuestion;
  answer: PreparationAnswer;
  context: PreparationContext;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [payload, setPayload] = useState<AnswerPayload>({
    question_id: question.id,
    state: answer.state,
    value: answer.value,
    notes: answer.notes,
    responsible_user_id: answer.responsible_user_id,
    due_date: answer.due_date,
  });
  const mutation = usePreparationMutation(projectId, () =>
    preparationApi.answers(projectId, instance.id, instance.revision, [
      {
        ...payload,
        value: payload.state === 'completed' ? payload.value : null,
      },
    ]),
  );
  return (
    <ModalForm
      open
      onOpenChange={(open) => !open && onClose()}
      title={question.label}
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(undefined, { onSuccess: onSaved });
        }}
      >
        <p className="text-sm text-muted-foreground">
          {question.category} ·{' '}
          {question.required ? 'Obrigatória quando aplicável' : 'Opcional'}
        </p>
        <FormField label="Situação">
          <select
            className={control}
            value={payload.state}
            onChange={(e) =>
              setPayload({
                ...payload,
                state: e.target.value as AnswerPayload['state'],
                value:
                  e.target.value === 'completed' &&
                  payload.value === null &&
                  question.type === 'sequence'
                    ? { start: 0, end: 0 }
                    : payload.value,
              })
            }
          >
            <option value="pending">Pendente</option>
            <option value="completed">Concluído</option>
            {question.allow_not_applicable ? (
              <option value="not_applicable">Não aplicável</option>
            ) : null}
          </select>
        </FormField>
        {payload.state === 'completed' ? (
          <div className="grid gap-2">
            <span className="text-sm font-semibold">Resposta</span>
            <AnswerValueInput
              question={question}
              value={payload.value}
              onChange={(value) => setPayload({ ...payload, value })}
              units={context.units}
            />
          </div>
        ) : null}
        <FormField
          label={
            payload.state === 'not_applicable'
              ? 'Justificativa de não aplicável'
              : 'Observações'
          }
          optional={payload.state !== 'not_applicable'}
        >
          <textarea
            className={control}
            rows={3}
            required={payload.state === 'not_applicable'}
            maxLength={10000}
            value={payload.notes ?? ''}
            onChange={(e) =>
              setPayload({ ...payload, notes: e.target.value || null })
            }
          />
        </FormField>
        <FormField label="Responsável pela resposta" optional>
          <ResponsibleSelect
            users={context.responsible_users}
            value={payload.responsible_user_id}
            onChange={(value) =>
              setPayload({ ...payload, responsible_user_id: value })
            }
          />
        </FormField>
        <FormField label="Prazo da resposta" optional>
          <Input
            type="date"
            value={payload.due_date ?? ''}
            onChange={(e) =>
              setPayload({ ...payload, due_date: e.target.value || null })
            }
          />
        </FormField>
        {mutation.isError ? (
          <ErrorState message={(mutation.error as Error).message} />
        ) : null}
        <Button disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar resposta'}
        </Button>
      </form>
    </ModalForm>
  );
}
