import { cloneElement, isValidElement, ReactElement, ReactNode, useId } from 'react';
import { HelpPopover } from '@/components/ui/help-popover';

type FormFieldProps = {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  help?: ReactNode;
  helpTitle?: string;
  children: ReactNode;
};

export function FormField({ label, error, hint, optional, help, helpTitle, children }: FormFieldProps) {
  const fieldId = useId();
  const element = isValidElement(children) ? children as ReactElement<Record<string, unknown>> : null;
  const controlId = typeof element?.props.id === 'string' ? element.props.id : `${fieldId}-control`;
  const descriptionId = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  const control = element
    ? cloneElement(element, {
        id: controlId,
        'aria-invalid': Boolean(error) || undefined,
        'aria-describedby': descriptionId,
      })
    : children;

  return (
    <div className="group grid gap-2 text-sm font-semibold text-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <label htmlFor={controlId}>{label}</label>
          {help ? <HelpPopover label={`Ajuda sobre ${label}`} title={helpTitle}>{help}</HelpPopover> : null}
        </div>
        {optional ? <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Opcional</span> : null}
      </div>
      {control}
      {error ? <span id={descriptionId} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">{error}</span> : null}
      {!error && hint ? <span id={descriptionId} className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
