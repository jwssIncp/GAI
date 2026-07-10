import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';

export function Tabs({ tabs }: { tabs: Array<{ label: string; to: string; content?: ReactNode }> }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-1.5 shadow-inner">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => cn('inline-flex h-9 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold transition', isActive ? 'bg-card text-foreground shadow-panel' : 'text-muted-foreground hover:bg-card/55 hover:text-foreground')}>
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
