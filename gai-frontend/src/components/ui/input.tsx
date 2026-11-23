import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-[6px] border border-input bg-card px-3 text-[0.84375rem] text-foreground outline-none transition duration-150',
        'placeholder:text-muted-foreground hover:border-steel/70',
        'focus:border-steel focus:ring-[3px] focus:ring-steel-tint',
        'aria-[invalid=true]:border-destructive/70 aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-destructive/10',
        'disabled:cursor-not-allowed disabled:bg-muted/70 disabled:text-muted-foreground disabled:opacity-75',
        className,
      )}
      {...props}
    />
  );
});
