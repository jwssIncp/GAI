import { ReactNode } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { navigationSectionFor, sectionLabel } from '@/constants/navigation';

function Eyebrow({ label }: { label: string | null }) {
  return label ? <div className="eyebrow mb-2"><span className="size-1.5 rounded-full bg-primary" /> {label}</div> : null;
}

/** Rótulo do módulo da rota atual: os mesmos nomes das seções do menu lateral. */
function RouteEyebrow() {
  const section = navigationSectionFor(useLocation().pathname);
  return <Eyebrow label={section ? sectionLabel(section) : null} />;
}

/**
 * Cabeçalho da tela: rótulo do módulo (eyebrow), título (h1 — um por página),
 * descrição e ações. O rótulo vem da rota (seção do menu); a prop `eyebrow`
 * substitui (texto) ou oculta (null) esse rótulo.
 */
export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: string; action?: ReactNode; eyebrow?: string | null }) {
  const inRouter = useInRouterContext();
  return (
    <div className="animate-fade-up flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow !== undefined ? <Eyebrow label={eyebrow} /> : inRouter ? <RouteEyebrow /> : null}
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-[2rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
