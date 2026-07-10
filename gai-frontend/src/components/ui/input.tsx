import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-lg border border-input bg-background/65 px-3.5 text-sm text-foreground shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04)] outline-none transition duration-200',
        'placeholder:text-muted-foreground/75 hover:border-primary/40 hover:bg-background',
        'focus:border-ring focus:bg-background focus:ring-[3px] focus:ring-ring/15',
        'aria-[invalid=true]:border-destructive/70 aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-destructive/10',
        'disabled:cursor-not-allowed disabled:bg-muted/70 disabled:text-muted-foreground disabled:opacity-75',
        className,
      )}
      {...props}
    />
  );
});
