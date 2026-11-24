import { useState } from 'react';
import { cn } from '@/utils/cn';
import type { ContactValue, DateRangeValue, ScheduleValue, SequenceValue } from './preparationTypes';

// Editores na linha dos tipos compostos do kick-off (padrão do sistema anterior). Cada um
// só envia ao servidor quando o valor está completo; o servidor valida de novo.

const control = 'h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-70';

/** Escolha múltipla em chips (Escopo, Perfil dos bens). */
export function ChipsEditor({
  label,
  options,
  value,
  optionLabel,
  busy,
  onCommit,
}: {
  label: string;
  options: string[];
  value: string[];
  optionLabel: (option: string) => string;
  busy: boolean;
  onCommit: (value: string[] | null) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            disabled={busy}
            onClick={() => {
              const next = on ? value.filter((v) => v !== option) : options.filter((o) => o === option || value.includes(o));
              onCommit(next.length ? next : null);
            }}
            className={cn(
              'min-h-7 rounded-full border px-2.5 text-xs font-semibold transition-colors disabled:opacity-70',
              on ? 'border-navy bg-navy text-white dark:border-steel-dark dark:bg-steel-dark' : 'border-border-strong bg-card hover:bg-secondary',
            )}
          >
            {optionLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

/** Telefone brasileiro com DDD: (11) 91234-5678 / (11) 1234-5678. */
function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
const validPhone = (phone: string) => /^[1-9]\d{9,10}$/.test(phone.replace(/\D/g, ''));

/** Contato: nome e telefone (dado pessoal; só aparece para quem acessa o projeto). */
export function ContactEditor({ label, value, busy, onCommit }: { label: string; value: ContactValue | null; busy: boolean; onCommit: (value: ContactValue | null) => void }) {
  const [name, setName] = useState(value?.name ?? '');
  const [phone, setPhone] = useState(value?.phone ?? '');
  const [error, setError] = useState('');
  const commit = () => {
    const next = { name: name.trim(), phone: phone.trim() ? phone.trim() : null };
    if (!next.name && !next.phone) {
      setError('');
      if (value) onCommit(null);
      return;
    }
    if (!next.name) return setError('Informe o nome.');
    if (next.phone && !validPhone(next.phone)) return setError('Telefone com DDD, ex.: (11) 91234-5678.');
    setError('');
    if (next.name !== (value?.name ?? '') || next.phone !== (value?.phone ?? null)) onCommit(next);
  };
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-2">
        <input aria-label={`Nome: ${label}`} placeholder="Nome" maxLength={120} disabled={busy} className={cn(control, 'min-w-40 flex-1')} value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} />
        <input aria-label={`Telefone: ${label}`} placeholder="(11) 91234-5678" inputMode="tel" disabled={busy} className={cn(control, 'w-40')} value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} onBlur={commit} />
      </div>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

/** Período: início e fim (ex.: PRAZO CAMPO). */
export function DateRangeEditor({ label, value, busy, onCommit }: { label: string; value: DateRangeValue | null; busy: boolean; onCommit: (value: DateRangeValue | null) => void }) {
  const [start, setStart] = useState(value?.start ?? '');
  const [end, setEnd] = useState(value?.end ?? '');
  const invalid = Boolean(start && end && end < start);
  const commit = (nextStart: string, nextEnd: string) => {
    if (!nextStart && !nextEnd) return value ? onCommit(null) : undefined;
    if (!nextStart || !nextEnd || nextEnd < nextStart) return;
    if (nextStart !== value?.start || nextEnd !== value?.end) onCommit({ start: nextStart, end: nextEnd });
  };
  const field = (name: string, current: string, set: (v: string) => void, next: (v: string) => [string, string]) => (
    <label className="grid gap-0.5 text-xs font-semibold text-muted-foreground">
      {name}
      <input type="date" aria-label={`${name}: ${label}`} disabled={busy} className={cn(control, 'w-40', invalid && 'border-destructive')} value={current} onChange={(e) => { set(e.target.value); commit(...next(e.target.value)); }} />
    </label>
  );
  return (
    <div className="grid gap-1">
      <span className="flex flex-wrap gap-2">
        {field('Início', start, setStart, (v) => [v, end])}
        {field('Fim', end, setEnd, (v) => [start, v])}
      </span>
      {invalid ? <span role="alert" className="text-xs text-destructive">O fim deve ser igual ou posterior ao início.</span> : null}
    </div>
  );
}

/** Horário especial: entrada, saída e finais de semana. */
export function ScheduleEditor({ label, value, busy, onCommit }: { label: string; value: ScheduleValue | null; busy: boolean; onCommit: (value: ScheduleValue | null) => void }) {
  const [hours, setHours] = useState<ScheduleValue>(value ?? { start: '', end: '', weekends: false });
  const commit = (next: ScheduleValue) => {
    setHours(next);
    if (!next.start && !next.end) return value ? onCommit(null) : undefined;
    if (!next.start || !next.end || next.start === next.end) return;
    if (next.start !== value?.start || next.end !== value?.end || next.weekends !== value?.weekends) onCommit(next);
  };
  return (
    <span className="flex flex-wrap items-end gap-2">
      <label className="grid gap-0.5 text-xs font-semibold text-muted-foreground">
        Entrada
        <input type="time" aria-label={`Entrada: ${label}`} disabled={busy} className={cn(control, 'w-28')} value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} onBlur={() => commit(hours)} />
      </label>
      <label className="grid gap-0.5 text-xs font-semibold text-muted-foreground">
        Saída
        <input type="time" aria-label={`Saída: ${label}`} disabled={busy} className={cn(control, 'w-28')} value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} onBlur={() => commit(hours)} />
      </label>
      <label className="flex min-h-9 items-center gap-1.5 text-xs font-semibold">
        <input type="checkbox" aria-label={`Finais de semana: ${label}`} disabled={busy} checked={hours.weekends} onChange={(e) => commit({ ...hours, weekends: e.target.checked })} />
        Finais de semana
      </label>
    </span>
  );
}

/** Contador − / + (ex.: quantidade de modelos de etiquetas antigas). */
export function StepperEditor({ label, value, busy, onCommit }: { label: string; value: number; busy: boolean; onCommit: (value: number | null) => void }) {
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" aria-label={`Diminuir: ${label}`} disabled={busy || value <= 0} className={cn(control, 'w-9 font-bold')} onClick={() => onCommit(value - 1 > 0 ? value - 1 : null)}>
        −
      </button>
      <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" aria-label={`Aumentar: ${label}`} disabled={busy || value >= 50} className={cn(control, 'w-9 font-bold')} onClick={() => onCommit(value + 1)}>
        +
      </button>
    </span>
  );
}

/** Uma sequência (Nº inicial / Nº final) por modelo informado na pergunta de quantidade. */
export function SequenceListEditor({ label, count, sourceLabel, value, busy, onCommit }: { label: string; count: number; sourceLabel: string; value: SequenceValue[]; busy: boolean; onCommit: (value: SequenceValue[] | null) => void }) {
  const [rows, setRows] = useState(() => Array.from({ length: count }, (_, i) => ({ start: value[i] ? String(value[i].start) : '', end: value[i] ? String(value[i].end) : '' })));
  if (!count)
    return <span className="inline-flex rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">Informe a quantidade de modelos em «{sourceLabel}».</span>;
  const commit = () => {
    if (rows.some((row) => !row.start || !row.end)) return;
    const next = rows.map((row) => ({ start: Number(row.start), end: Number(row.end) }));
    if (next.some((seq) => seq.end < seq.start)) return;
    if (JSON.stringify(next) !== JSON.stringify(value)) onCommit(next);
  };
  return (
    <div className="grid gap-1.5">
      {rows.map((row, index) => (
        <span key={index} className="flex flex-wrap items-end gap-2">
          <span className="min-w-24 text-xs font-semibold text-muted-foreground">Sequência {index + 1}</span>
          {(['start', 'end'] as const).map((key) => (
            <label key={key} className="grid gap-0.5 text-xs font-semibold text-muted-foreground">
              {key === 'start' ? 'Nº Inicial' : 'Nº Final'}
              <input
                aria-label={`Sequência ${index + 1} ${key === 'start' ? 'Nº Inicial' : 'Nº Final'}: ${label}`}
                inputMode="numeric"
                disabled={busy}
                className={cn(control, 'w-28 text-right tabular-nums')}
                value={row[key]}
                onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, [key]: e.target.value.replace(/\D/g, '') } : r)))}
                onBlur={commit}
              />
            </label>
          ))}
        </span>
      ))}
    </div>
  );
}
