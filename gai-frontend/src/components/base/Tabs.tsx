import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';

export function Tabs({ tabs }: { tabs: Array<{ label: string; to: string; content?: ReactNode }> }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-sidebar-border bg-brand-navy p-1.5 shadow-panel">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => cn('inline-flex h-9 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold transition', isActive ? 'bg-primary text-primary-foreground shadow-glow' : 'text-white/65 hover:bg-white/[0.08] hover:text-white')}>
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
