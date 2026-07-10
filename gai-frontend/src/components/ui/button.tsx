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

const variants: Record<Variant, string> = {
  primary: 'border border-primary/20 bg-premium-gradient text-primary-foreground shadow-glow hover:brightness-110',
  secondary: 'border border-border/80 bg-card/80 text-foreground shadow-panel hover:border-primary/25 hover:bg-card',
  ghost: 'border border-transparent text-foreground hover:border-border/60 hover:bg-muted/75',
  danger: 'border border-destructive/20 bg-destructive text-destructive-foreground shadow-[0_12px_30px_-16px_hsl(var(--destructive)/0.7)] hover:brightness-110',
  outline: 'border border-primary/30 bg-transparent text-primary hover:bg-primary-subtle',
  soft: 'border border-primary/10 bg-primary-subtle text-primary hover:border-primary/20 hover:bg-primary/10',
};

const sizes: Record<Size, string> = {
  default: 'h-10 px-4',
  sm: 'h-8 rounded-md px-3 text-xs',
  lg: 'h-12 px-5 text-[0.9375rem]',
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
        'group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-lg text-sm font-semibold tracking-[-0.01em] transition duration-200 ease-out',
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
