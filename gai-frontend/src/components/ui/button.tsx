import { LoaderCircle } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft';
type Size = 'default' | 'sm' | 'lg' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

// Visual do sistema anterior: primária verde #2E7D5B; secundária/outline brancas com
// borda #C3CCD4 (hairline forte); sem sombras.
const variants: Record<Variant, string> = {
  primary: 'border border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover',
  secondary: 'border border-border-strong bg-card text-foreground hover:bg-secondary',
  ghost: 'border border-transparent text-foreground hover:bg-secondary',
  danger: 'border border-destructive bg-destructive text-destructive-foreground hover:brightness-95',
  outline: 'border border-border-strong bg-card text-foreground hover:bg-secondary',
  soft: 'border border-primary/15 bg-primary-subtle text-primary-text hover:border-primary/30',
};

const sizes: Record<Size, string> = {
  default: 'min-h-10 px-4 py-2',
  sm: 'min-h-8 px-3 py-1.5 text-xs',
  lg: 'h-11 px-5 text-[0.9375rem]',
  icon: 'size-10 px-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size, loading = false, disabled, children, ...props },
  ref,
) {
  const resolvedSize = size ?? (variant === 'ghost' && props['aria-label'] ? 'icon' : 'default');
  return (
    <button
      ref={ref}
      className={cn(
        'group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-[6px] text-[0.84375rem] font-semibold transition-colors duration-150 ease-out',
        'focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        variants[variant],
        sizes[resolvedSize],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
