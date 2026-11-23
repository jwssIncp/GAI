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
        <div className="pointer-events-none fixed inset-x-4 bottom-6 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2" aria-label="Notificações">
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
        // Aviso do sistema anterior: fundo navy, texto claro, centralizado embaixo.
        'pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-white/10 bg-navy p-3.5 pr-11 text-[#EAF0F4] shadow-elevated animate-fade-up',
      )}
      role={entry.tone === 'error' ? 'alert' : 'status'}
    >
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-md bg-white/10', entry.tone === 'success' ? 'text-[hsl(145_50%_72%)]' : entry.tone === 'error' ? 'text-[hsl(353_85%_80%)]' : 'text-[hsl(205_65%_78%)]')}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[0.84375rem] font-semibold">{entry.title}</p>
        {entry.description ? <p className="mt-1 text-xs leading-5 text-[#EAF0F4]/75">{entry.description}</p> : null}
      </div>
      <button type="button" className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-md text-[#EAF0F4]/70 transition hover:bg-white/10 hover:text-white" onClick={() => onDismiss(entry.id)} aria-label="Fechar notificação">
        <X size={14} />
      </button>
      <span className={cn('absolute inset-x-0 bottom-0 h-0.5', entry.tone === 'success' ? 'bg-success' : entry.tone === 'error' ? 'bg-destructive' : 'bg-info')} />
    </div>
  );
}
