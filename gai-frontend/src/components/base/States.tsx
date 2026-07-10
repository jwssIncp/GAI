import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadingState({ label = 'Carregando dados' }: { label?: string }) {
  return (
    <div className="premium-panel grid min-h-48 place-items-center p-8 text-center" role="status" aria-live="polite">
      <div className="grid w-full max-w-sm justify-items-center gap-3">
        <div className="relative grid size-11 place-items-center rounded-xl bg-primary-subtle text-primary">
          <span className="absolute inset-0 animate-ping rounded-xl bg-primary/10" aria-hidden="true" />
          <Loader2 className="relative animate-spin" size={20} />
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">Sincronizando as informacoes mais recentes.</p>
        <div className="mt-2 grid w-full gap-2" aria-hidden="true">
          <span className="skeleton-shimmer h-2 w-full rounded-full" />
          <span className="skeleton-shimmer mx-auto h-2 w-3/4 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title = 'Nenhum registro encontrado', description = 'Ajuste os filtros ou crie um novo registro.' }: { title?: string; description?: string }) {
  return (
    <div className="premium-panel grid min-h-52 place-items-center border-dashed p-8 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-border/70 bg-muted/60 text-muted-foreground shadow-inner-highlight">
          <Inbox size={22} />
        </div>
        <h3 className="mt-4 font-bold tracking-tight">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message = 'Nao foi possivel carregar os dados.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-destructive/25 bg-destructive/[0.045] p-5 shadow-panel">
      <div className="absolute inset-y-0 left-0 w-1 bg-destructive" aria-hidden="true" />
      <div className="flex items-center gap-2.5 font-semibold text-destructive">
        <span className="grid size-8 place-items-center rounded-lg bg-destructive/10"><AlertTriangle size={16} /></span> Nao foi possivel concluir
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button className="mt-5" variant="secondary" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
