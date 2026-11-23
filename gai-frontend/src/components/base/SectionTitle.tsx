import type { ReactNode } from 'react';
import { HelpPopover } from '@/components/ui/help-popover';

/**
 * Título de seção no padrão do sistema anterior: nome em Space Grotesk seguido de uma
 * linha fina até a borda; ações à direita. `as="h1"` no título da tela.
 * `help`: explicação longa da tela (no lugar da descrição embaixo do título).
 */
export function SectionTitle({ title, as: Heading = 'h2', actions, help }: {
  title: string;
  as?: 'h1' | 'h2';
  actions?: ReactNode;
  help?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Heading className="whitespace-nowrap font-display text-[1.1875rem] font-semibold leading-tight text-navy dark:text-foreground">{title}</Heading>
        {help ? <HelpPopover label={`Sobre ${title}`} title={title}>{help}</HelpPopover> : null}
      </div>
      <span aria-hidden="true" className="h-px min-w-8 flex-1 bg-border" />
      {actions ? <div className="flex flex-wrap items-center justify-end gap-2 empty:hidden">{actions}</div> : null}
    </div>
  );
}
