import { ReactNode } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { navigationSectionFor, sectionLabel } from '@/constants/navigation';
import { SectionTitle } from './SectionTitle';

function Eyebrow({ label }: { label: string | null }) {
  return label ? <div className="eyebrow mb-1.5"><span className="size-1.5 rounded-full bg-primary" /> {label}</div> : null;
}

/** Rótulo do módulo da rota atual: os mesmos nomes das áreas do menu superior. */
function RouteEyebrow() {
  const section = navigationSectionFor(useLocation().pathname);
  return <Eyebrow label={section ? sectionLabel(section) : null} />;
}

/**
 * Cabeçalho da tela no padrão do sistema anterior: rótulo do módulo (eyebrow, discreto),
 * título (h1 — um por página) com uma linha fina até as ações e a descrição em texto
 * pequeno logo abaixo. O rótulo vem da rota (área do menu); a prop `eyebrow` substitui
 * (texto) ou oculta (null) esse rótulo.
 */
export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: string; action?: ReactNode; eyebrow?: string | null }) {
  const inRouter = useInRouterContext();
  return (
    <div className="grid gap-1">
      {eyebrow !== undefined ? <Eyebrow label={eyebrow} /> : inRouter ? <RouteEyebrow /> : null}
      <SectionTitle as="h1" title={title} actions={action} />
      {description ? <p className="max-w-4xl text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
