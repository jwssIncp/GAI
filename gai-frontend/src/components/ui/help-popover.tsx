import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CircleHelp, X } from 'lucide-react';
import { ReactNode } from 'react';

type HelpPopoverProps = {
  label: string;
  children: ReactNode;
  title?: string;
};

export function HelpPopover({ label, children, title = 'Sobre este campo' }: HelpPopoverProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <CircleHelp size={15} aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          aria-label={title}
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="pointer-events-auto z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border/80 bg-popover p-4 pr-10 text-popover-foreground shadow-elevated outline-none data-[state=open]:animate-fade-up"
        >
          <p className="text-sm font-semibold">{title}</p>
          <div className="mt-1.5 text-xs font-normal leading-5 text-muted-foreground">{children}</div>
          <PopoverPrimitive.Close
            type="button"
            aria-label="Fechar ajuda"
            className="absolute right-2.5 top-2.5 inline-grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <X size={14} aria-hidden="true" />
          </PopoverPrimitive.Close>
          <PopoverPrimitive.Arrow className="fill-popover" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
