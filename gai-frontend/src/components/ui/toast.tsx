import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastInput } from './toast-context';
import { cn } from '@/utils/cn';

type ToastEntry = ToastInput & {
  id: string;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((activeToasts) => activeToasts.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setToasts((activeToasts) => [...activeToasts.slice(-3), { tone: 'info', duration: 4500, ...input, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [dismiss, toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' ? createPortal(
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:w-[380px]" aria-label="Notificações">
          {toasts.map((entry) => <ToastItem key={entry.id} entry={entry} onDismiss={dismiss} />)}
        </div>,
        document.body,
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(entry.id), entry.duration);
    return () => window.clearTimeout(timer);
  }, [entry.duration, entry.id, onDismiss]);

  const Icon = entry.tone === 'success' ? CheckCircle2 : entry.tone === 'error' ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        'glass-surface pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border bg-popover/90 p-4 pr-11 text-popover-foreground shadow-elevated animate-slide-in-right',
        entry.tone === 'success' ? 'border-success/25' : entry.tone === 'error' ? 'border-destructive/25' : 'border-info/25',
      )}
      role={entry.tone === 'error' ? 'alert' : 'status'}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', entry.tone === 'success' ? 'bg-success-subtle text-success' : entry.tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-info-subtle text-info')}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-bold">{entry.title}</p>
        {entry.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{entry.description}</p> : null}
      </div>
      <button type="button" className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={() => onDismiss(entry.id)} aria-label="Fechar notificação">
        <X size={14} />
      </button>
      <span className={cn('absolute inset-x-0 bottom-0 h-0.5', entry.tone === 'success' ? 'bg-success' : entry.tone === 'error' ? 'bg-destructive' : 'bg-info')} />
    </div>
  );
}
