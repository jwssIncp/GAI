import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';
import { userLabel } from '@/utils/userName';
import { ApiError } from '@/api/http';
import { preparationApi, preparationKeys } from './preparationQueries';
import type {
  AnswerPayload,
  AnswerValue,
  Preparation,
  PreparationAnswer,
  PreparationContext,
  PreparationQuestion,
  ContactValue,
  DateRangeValue,
  ScheduleValue,
  SequenceValue,
} from './preparationTypes';
import { questionGroupTags, requestAtKickoff } from './referenceTemplates';
import { answerText, inlineChildren, isPercent, optionLabel, payloadOf, situationOf } from './answerHelpers';
import { ChipsEditor, ContactEditor, DateRangeEditor, ScheduleEditor, SequenceListEditor, StepperEditor, UnitAllocationsEditor } from './CompositeEditors';

const SAVE_KEY = ['preparation-answer'] as const;

/**
 * Salva uma resposta na linha com a revisão atual. Uma gravação por vez (os campos ficam
 * desabilitados enquanto outra está em andamento). Se outro usuário alterou antes (409), os
 * dados são recarregados e o aviso pede para refazer a alteração, sem sobrescrever.
 */
function useAnswerSaver(projectId: number, instance: Preparation) {
  const client = useQueryClient();
  const busy = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  const mutation = useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: (payload: AnswerPayload) =>
      preparationApi.answers(projectId, instance.id, instance.revision, [payload]),
    onSettled: () => client.invalidateQueries({ queryKey: preparationKeys.project(projectId) }),
  });
  const error = mutation.error
    ? mutation.error instanceof ApiError && mutation.error.status === 409
      ? 'Outro usuário alterou este kick-off. Os dados foram recarregados; refaça a alteração.'
      : (mutation.error as Error).message
    : null;
  return { save: (payload: AnswerPayload) => mutation.mutate(payload), busy, error };
}

const rowTone: Record<string, string> = {
  PENDENTE: 'bg-rose-50 dark:bg-rose-950/30',
  REALIZADO: 'bg-emerald-50 dark:bg-emerald-950/30',
  SOLICITAR: 'bg-sky-50 dark:bg-sky-950/30',
  BLOQUEADO: 'bg-muted/40',
};

/** Tabela de um grupo no padrão do sistema anterior: Nº, Realizado, Item, Grupo, Resposta, Observações. */
export function QuestionTable({
  caption,
  rows,
  questions,
  number,
  answerOf,
  context,
  editable,
  projectId,
  instance,
  onEdit,
}: {
  caption: string;
  rows: PreparationQuestion[];
  /** Todas as perguntas da versão (para achar complementos e a origem dos bloqueios). */
  questions: PreparationQuestion[];
  number: Map<string, number>;
  answerOf: (q: PreparationQuestion) => PreparationAnswer;
  context: PreparationContext;
  editable: boolean;
  projectId: number;
  instance: Preparation;
  onEdit: (id: string) => void;
}) {
  const saver = useAnswerSaver(projectId, instance);
  // Pergunta numérica que define quantas sequências uma lista terá: vira contador − / +.
  const stepperIds = new Set(
    questions.flatMap((x) => (x.type === 'sequence_list' && x.quantity_question_id ? [x.quantity_question_id] : [])),
  );
  const quantityOf = (x: PreparationQuestion) => {
    if (x.type !== 'sequence_list' || !x.quantity_question_id) return undefined;
    const source = questions.find((other) => other.id === x.quantity_question_id);
    const value = source ? answerOf(source) : undefined;
    return {
      count: value?.state === 'completed' && typeof value.value === 'number' ? value.value : 0,
      label: source?.label ?? '',
    };
  };
  return (
    <div className="grid">
      {saver.error ? (
        <p role="alert" className="border-b border-destructive/30 bg-destructive/[0.06] px-5 py-2 text-sm text-destructive">
          {saver.error}
        </p>
      ) : null}
      <div className="overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
        <table className="data-table w-full min-w-[960px] border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              {['Nº', 'Realizado', 'Item', 'Grupo', 'Resposta', 'Observações', 'Ações'].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className={cn('border-b border-border px-4 py-3 font-semibold first:pl-5 last:pr-5', header === 'Ações' && 'print:hidden')}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {rows.map((q) => {
              const a = answerOf(q);
              const situation = situationOf(a);
              const asked = requestAtKickoff.has(q.id);
              const tone = situation === 'REALIZADO' && asked ? 'SOLICITAR' : situation;
              const tag = questionGroupTags[q.id];
              const canChange = editable && a.applicable;
              const cell = 'border-b border-border/55 px-4 py-3 align-top first:pl-5 last:pr-5';
              const source = q.enabled_when?.[0]
                ? questions.find((other) => other.id === q.enabled_when![0].question_id)
                : undefined;
              return (
                <tr key={q.id} className={rowTone[tone]}>
                  <td className={cn(cell, 'numeric w-12', situation === 'PENDENTE' && 'text-rose-700 dark:text-rose-300')}>
                    {String(number.get(q.id)).padStart(2, '0')}
                  </td>
                  <td className={cn(cell, 'w-32')}>
                    <RealizedToggle
                      question={q}
                      answer={a}
                      disabled={!canChange || saver.busy}
                      onToggle={() => saver.save(payloadOf(a, { realized: !a.realized }))}
                    />
                  </td>
                  <td className={cell}>
                    <span
                      className={cn(
                        'font-semibold',
                        situation === 'PENDENTE' && 'text-rose-800 dark:text-rose-200',
                        tone === 'REALIZADO' && 'text-emerald-800 line-through decoration-1 opacity-80 dark:text-emerald-200',
                        tone === 'SOLICITAR' && 'text-sky-800 dark:text-sky-200',
                      )}
                    >
                      {q.label}
                    </span>
                    {asked ? <span className="mt-0.5 block text-xs font-semibold text-sky-700 dark:text-sky-300">* Solicitar no kick-off</span> : null}
                    {a.responsible_user_id || a.due_date ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Responsável:{' '}
                        {context.responsible_users.find((user) => user.id === a.responsible_user_id)?.label ??
                          (a.responsible_user_id ? userLabel(a.responsible_user_name) : 'Não definido')}{' '}
                        · Prazo: {formatDate(a.due_date)}
                      </p>
                    ) : null}
                  </td>
                  <td className={cn(cell, 'w-32 text-xs')}>
                    {tag ? <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-100">{tag}</span> : null}
                  </td>
                  <td className={cn(cell, 'min-w-56')}>
                    {!a.applicable ? (
                      <span className="inline-flex rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
                        Bloqueado{source ? ` — depende de «${source.label}»` : ' pelas respostas atuais'}
                      </span>
                    ) : (
                      <div className="grid gap-2">
                        <AnswerEditor key={`${q.id}-${instance.revision}`} question={q} answer={a} stepper={stepperIds.has(q.id)} quantity={quantityOf(q)} context={context} editable={canChange} busy={saver.busy} onSave={(payload) => saver.save(payload)} />
                        {inlineChildren(questions, q).map((child) => {
                          const childAnswer = answerOf(child);
                          if (!childAnswer.applicable) return null;
                          return (
                            <label key={child.id} className="grid gap-1 rounded-md border border-dashed border-sky-300 bg-sky-50/60 p-2 text-xs font-semibold text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
                              {child.label}
                              <AnswerEditor key={`${child.id}-${instance.revision}`} question={child} answer={childAnswer} quantity={quantityOf(child)} context={context} editable={editable} busy={saver.busy} onSave={(payload) => saver.save(payload)} />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className={cn(cell, 'w-[22%]')}>
                    {a.applicable ? (
                      <NotesEditor key={`${q.id}-notes-${instance.revision}`} answer={a} label={q.label} editable={canChange} busy={saver.busy} onSave={(notes) => saver.save(payloadOf(a, { notes }))} />
                    ) : null}
                  </td>
                  <td className={cn(cell, 'print:hidden')}>
                    {canChange ? (
                      <Button size="sm" variant="ghost" aria-label={`Detalhes: ${q.label}`} title="Responsável, prazo, N/A e unidades" onClick={() => onEdit(q.id)}>
                        Detalhes
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RealizedToggle({
  question,
  answer,
  disabled,
  onToggle,
}: {
  question: PreparationQuestion;
  answer: PreparationAnswer;
  disabled: boolean;
  onToggle: () => void;
}) {
  if (!answer.applicable)
    return <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">BLOQUEADO</span>;
  const done = Boolean(answer.realized);
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={`Realizado: ${question.label}`}
      title={done ? `Realizado${answer.realized_by_name ? ` por ${userLabel(answer.realized_by_name)}` : ''} — clique para desmarcar` : 'Marcar como realizado'}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70',
        done
          ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
          : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:bg-transparent dark:text-rose-200',
      )}
    >
      {done ? 'REALIZADO' : 'PENDENTE'}
    </button>
  );
}

/** Observações direto na linha; salva ao sair do campo, se mudou. */
function NotesEditor({ answer, label, editable, busy, onSave }: { answer: PreparationAnswer; label: string; editable: boolean; busy: boolean; onSave: (notes: string | null) => void }) {
  const [draft, setDraft] = useState(answer.notes ?? '');
  if (!editable) return <span className="whitespace-pre-wrap text-muted-foreground">{answer.notes}</span>;
  return (
    <textarea
      aria-label={`Observações: ${label}`}
      placeholder="Observação…"
      rows={1}
      maxLength={10000}
      disabled={busy}
      className="min-h-9 w-full resize-y rounded-md border bg-background px-2 py-1.5 text-sm"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim() ? draft : null;
        if ((next ?? '') !== (answer.notes ?? '')) onSave(next);
      }}
    />
  );
}

const control = 'h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-70';

/**
 * Resposta editável na linha conforme o tipo. Responder não marca o item como realizado.
 * Limpar a resposta volta o estado da resposta a pendente (o realizado não muda).
 */
function AnswerEditor({
  question: q,
  answer: a,
  context,
  editable,
  busy,
  onSave,
  stepper = false,
  quantity,
}: {
  question: PreparationQuestion;
  answer: PreparationAnswer;
  context: PreparationContext;
  editable: boolean;
  busy: boolean;
  onSave: (payload: AnswerPayload) => void;
  /** Número exibido como contador − / + (quantidade de uma lista de sequências). */
  stepper?: boolean;
  /** Lista de sequências: quantas (vem de outra pergunta) e o nome dela. */
  quantity?: { count: number; label: string };
}) {
  const save = (value: AnswerValue | null) =>
    onSave(payloadOf(a, { state: value === null ? 'pending' : 'completed', value }));
  const shown = answerText(q, a, context);
  if (editable && a.state !== 'not_applicable' && q.type === 'unit_allocations')
    return (
      <UnitAllocationsEditor
        label={`Endereços: ${q.label}`}
        units={context.units}
        value={Array.isArray(a.value) && a.state === 'completed' ? (a.value as Array<{ unit_id: number; quantity: number }>) : []}
        busy={busy}
        onCommit={(value) => save(value)}
      />
    );
  if (!editable || a.state === 'not_applicable' || q.type === 'unit_allocations')
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="whitespace-pre-wrap">{shown || <span className="text-muted-foreground">—</span>}</span>
      </span>
    );
  if (q.type === 'none')
    return (
      <span className="inline-flex rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
        Sem resposta — marque “Realizado” quando tratado
      </span>
    );
  const current = a.state === 'completed' ? a.value : null;
  const label = `Resposta: ${q.label}`;
  if (q.type === 'multi_select')
    return (
      <ChipsEditor
        label={label}
        options={q.options ?? []}
        value={Array.isArray(current) ? (current as string[]) : []}
        optionLabel={(option) => optionLabel(option, context)}
        busy={busy}
        onCommit={(value) => save(value)}
      />
    );
  if (q.type === 'contact')
    return <ContactEditor label={q.label} value={(current as ContactValue | null) ?? null} busy={busy} onCommit={(value) => save(value)} />;
  if (q.type === 'date_range')
    return <DateRangeEditor label={q.label} value={(current as DateRangeValue | null) ?? null} busy={busy} onCommit={(value) => save(value)} />;
  if (q.type === 'schedule')
    return <ScheduleEditor label={q.label} value={(current as ScheduleValue | null) ?? null} busy={busy} onCommit={(value) => save(value)} />;
  if (q.type === 'sequence_list')
    return (
      <SequenceListEditor
        key={quantity?.count ?? 0}
        label={q.label}
        count={quantity?.count ?? 0}
        sourceLabel={quantity?.label ?? ''}
        value={Array.isArray(current) ? (current as SequenceValue[]) : []}
        busy={busy}
        onCommit={(value) => save(value)}
      />
    );
  if (q.type === 'number' && stepper)
    return <StepperEditor label={label} value={typeof current === 'number' ? current : 0} busy={busy} onCommit={(value) => save(value)} />;
  if (q.type === 'select' || q.type === 'boolean')
    return (
      <select
        aria-label={label}
        className={cn(control, 'min-w-40')}
        disabled={busy}
        value={current === null ? '' : String(current)}
        onChange={(e) => {
          const raw = e.target.value;
          save(raw === '' ? null : q.type === 'boolean' ? raw === 'true' : raw);
        }}
      >
        <option value="">Selecione…</option>
        {q.type === 'boolean' ? (
          <>
            <option value="true">SIM</option>
            <option value="false">NÃO</option>
          </>
        ) : (
          q.options?.map((option) => (
            <option key={option} value={option}>
              {optionLabel(option, context)}
            </option>
          ))
        )}
      </select>
    );
  if (q.type === 'date')
    return (
      <input
        type="date"
        aria-label={label}
        className={cn(control, 'max-w-44')}
        disabled={busy}
        value={typeof current === 'string' ? current : ''}
        onChange={(e) => save(e.target.value || null)}
      />
    );
  if (q.type === 'number')
    return (
      <Suffixed suffix={isPercent(q) ? '%' : undefined}>
        <BlurInput
          label={label}
          initial={typeof current === 'number' ? current.toLocaleString('pt-BR') : ''}
          inputMode="decimal"
          align="right"
          busy={busy}
          normalize={(text) => {
            const digits = text.replace(/\./g, '').replace(',', '.').trim();
            if (!digits) return { value: null, text: '' };
            const value = Number(digits);
            return Number.isFinite(value) && value >= 0 ? { value, text: value.toLocaleString('pt-BR') } : undefined;
          }}
          onCommit={(value) => save(value as number | null)}
        />
      </Suffixed>
    );
  if (q.type === 'sequence') {
    const seq = current && typeof current === 'object' && !Array.isArray(current) ? (current as SequenceValue) : null;
    return <SequenceEditor label={q.label} start={seq?.start ?? null} end={seq?.end ?? null} busy={busy} onCommit={(value) => save(value)} />;
  }
  const long = q.type === 'long_text';
  return (
    <BlurInput
      label={label}
      multiline={long}
      initial={typeof current === 'string' ? current : ''}
      placeholder="Anotar…"
      busy={busy}
      normalize={(text) => ({ value: text.trim() ? text : null, text })}
      onCommit={(value) => save(value as string | null)}
    />
  );
}

function Suffixed({ suffix, children }: { suffix?: string; children: ReactNode }) {
  if (!suffix) return <>{children}</>;
  return (
    <span className="flex items-center gap-1">
      {children}
      <span className="text-sm font-semibold text-muted-foreground">{suffix}</span>
    </span>
  );
}

/** Campo que salva ao sair (Enter também confirma em campos de uma linha). */
function BlurInput({
  label,
  initial,
  multiline = false,
  placeholder,
  inputMode,
  align,
  busy,
  normalize,
  onCommit,
}: {
  label: string;
  initial: string;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: 'decimal';
  align?: 'right';
  busy: boolean;
  normalize: (text: string) => { value: AnswerValue | null; text: string } | undefined;
  onCommit: (value: AnswerValue | null) => void;
}) {
  const [text, setText] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  const commit = () => {
    if (text === initial) return;
    const parsed = normalize(text);
    if (!parsed) return setInvalid(true);
    setInvalid(false);
    setText(parsed.text);
    if (parsed.text !== initial) onCommit(parsed.value);
  };
  const props = {
    'aria-label': label,
    'aria-invalid': invalid || undefined,
    placeholder,
    disabled: busy,
    value: text,
    className: cn(multiline ? 'min-h-16 w-full resize-y rounded-md border bg-background px-2 py-1.5 text-sm' : control, align === 'right' && 'text-right tabular-nums', invalid && 'border-destructive'),
    onBlur: commit,
  };
  return multiline ? (
    <textarea {...props} rows={2} maxLength={10000} onChange={(e) => setText(e.target.value)} />
  ) : (
    <input
      {...props}
      inputMode={inputMode}
      maxLength={2000}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function SequenceEditor({ label, start, end, busy, onCommit }: { label: string; start: number | null; end: number | null; busy: boolean; onCommit: (value: { start: number; end: number } | null) => void }) {
  const [from, setFrom] = useState(start === null ? '' : String(start));
  const [to, setTo] = useState(end === null ? '' : String(end));
  const commit = () => {
    if (!from && !to) {
      if (start !== null) onCommit(null);
      return;
    }
    if (!from || !to) return;
    const first = Number(from);
    const last = Number(to);
    if (first === start && last === end) return;
    onCommit({ start: first, end: last });
  };
  const field = (value: string, set: (v: string) => void, name: string) => (
    <label className="grid gap-0.5 text-xs font-semibold text-muted-foreground">
      {name}
      <input aria-label={`${name}: ${label}`} inputMode="numeric" disabled={busy} className={cn(control, 'w-28 text-right tabular-nums')} value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} onBlur={commit} />
    </label>
  );
  return (
    <span className="flex flex-wrap gap-2">
      {field(from, setFrom, 'Nº Inicial')}
      {field(to, setTo, 'Nº Final')}
    </span>
  );
}
