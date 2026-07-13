import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/utils/cn';

export function ModalForm({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-md data-[state=open]:animate-fade-up" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="glass-surface fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(94vw,580px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border/80 bg-popover p-6 shadow-elevated data-[state=open]:animate-scale-in sm:p-7"
        >
          <div className="border-b border-border/70 pb-4 pr-10">
            <p className="eyebrow">Ação segura</p>
            <DialogPrimitive.Title className="mt-1.5 text-xl font-bold tracking-tight text-popover-foreground">{title}</DialogPrimitive.Title>
          </div>
          <DialogPrimitive.Close className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Fechar">
            <X size={17} />
          </DialogPrimitive.Close>
          <div className="mt-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DrawerForm({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm data-[state=open]:animate-fade-up" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn('fixed right-0 top-0 z-50 h-dvh w-[min(94vw,580px)] overflow-y-auto border-l border-border/70 bg-popover p-6 shadow-elevated data-[state=open]:animate-slide-in-right sm:p-8')}
        >
          <div className="sticky -top-6 z-10 -mx-2 border-b border-border/70 bg-popover/90 px-2 pb-4 pr-12 pt-1 backdrop-blur-xl sm:-top-8">
            <p className="eyebrow">Detalhes</p>
            <DialogPrimitive.Title className="mt-1.5 text-xl font-bold tracking-tight text-popover-foreground">{title}</DialogPrimitive.Title>
          </div>
          <DialogPrimitive.Close className="fixed right-4 top-4 z-20 grid size-9 place-items-center rounded-lg border border-border/60 bg-popover/80 text-muted-foreground shadow-panel backdrop-blur transition hover:bg-muted hover:text-foreground sm:right-6 sm:top-6" aria-label="Fechar">
            <X size={17} />
          </DialogPrimitive.Close>
          <div className="mt-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, busy = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; onConfirm: () => void; busy?: boolean }) {
  return (
    <ModalForm open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-7 flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" variant="danger" loading={busy} disabled={busy} onClick={onConfirm}>
          Confirmar
        </Button>
      </div>
    </ModalForm>
  );
}
