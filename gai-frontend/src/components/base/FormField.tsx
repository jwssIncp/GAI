import { cloneElement, isValidElement, ReactElement, ReactNode, useId } from 'react';

export function FormField({ label, error, hint, optional, children }: { label: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
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
      <label htmlFor={controlId} className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {optional ? <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Opcional</span> : null}
      </label>
      {control}
      {error ? <span id={descriptionId} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">{error}</span> : null}
      {!error && hint ? <span id={descriptionId} className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
