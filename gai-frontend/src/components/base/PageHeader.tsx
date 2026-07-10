import { ReactNode } from 'react';

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="animate-fade-up flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <div className="eyebrow"><span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" /> Workspace</div>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-[2rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
