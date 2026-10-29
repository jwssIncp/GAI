import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navigationHref } from '@/features/projects/navigationContext';
import { cn } from '@/utils/cn';

export function Tabs({ tabs }: { tabs: Array<{ label: string; to: string; content?: ReactNode }> }) {
  const location = useLocation();
  return (
    <nav aria-label="Navegação da seção" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-panel">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={navigationHref(tab.to, location.search)} className={({ isActive }) => cn('inline-flex min-h-11 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold transition', isActive ? 'bg-primary-subtle text-primary-text shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
