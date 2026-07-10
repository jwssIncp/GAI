import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { Input } from './input';
import { cn } from '@/utils/cn';

type IconInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: ReactNode;
  endAdornment?: ReactNode;
};

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { icon, endAdornment, className, ...props },
  ref,
) {
  return (
    <span className="group/input relative block">
      <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within/input:text-primary" aria-hidden="true">
        {icon}
      </span>
      <Input ref={ref} className={cn('pl-11', endAdornment && 'pr-11', className)} {...props} />
      {endAdornment ? <span className="absolute right-2 top-1/2 z-10 -translate-y-1/2">{endAdornment}</span> : null}
    </span>
  );
});
