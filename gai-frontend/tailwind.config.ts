import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['"Space Grotesk"', '"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        nav: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        steel: {
          DEFAULT: 'hsl(var(--steel))',
          dark: 'hsl(var(--steel-dark))',
          tint: 'hsl(var(--steel-tint))',
        },
        brass: 'hsl(var(--brass))',
        navy: 'hsl(var(--navy))',
        rose: 'hsl(var(--rose))',
        'border-strong': 'hsl(var(--border-strong))',
        'table-head': 'hsl(var(--table-head))',
        nav: {
          DEFAULT: 'hsl(var(--nav))',
          border: 'hsl(var(--nav-border))',
          ink: 'hsl(var(--nav-ink))',
          muted: 'hsl(var(--nav-muted))',
          accent: 'hsl(var(--nav-accent))',
        },
        subnav: {
          DEFAULT: 'hsl(var(--subnav))',
          hover: 'hsl(var(--subnav-hover))',
        },
        kpi: {
          month: 'hsl(var(--kpi-month))',
          'month-bg': 'hsl(var(--kpi-month-bg))',
          next: 'hsl(var(--kpi-next))',
          'next-bg': 'hsl(var(--kpi-next-bg))',
          year: 'hsl(var(--kpi-year))',
          'year-bg': 'hsl(var(--kpi-year-bg))',
          indicators: 'hsl(var(--kpi-indicators))',
          'indicators-bg': 'hsl(var(--kpi-indicators-bg))',
        },
        brand: {
          ink: 'hsl(var(--brand-ink))',
          navy: 'hsl(var(--brand-navy))',
          green: 'hsl(var(--brand-green))',
          'green-deep': 'hsl(var(--brand-green-deep))',
          teal: 'hsl(var(--brand-teal))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          elevated: 'hsl(var(--surface-elevated))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          subtle: 'hsl(var(--primary-subtle))',
          hover: 'hsl(var(--primary-hover))',
          text: 'hsl(var(--primary-text))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          text: 'hsl(var(--destructive-text))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          subtle: 'hsl(var(--success-subtle))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          text: 'hsl(var(--warning-text))',
          foreground: 'hsl(var(--warning-foreground))',
          subtle: 'hsl(var(--warning-subtle))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          subtle: 'hsl(var(--info-subtle))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          muted: 'hsl(var(--sidebar-muted))',
          accent: 'hsl(var(--sidebar-accent))',
          border: 'hsl(var(--sidebar-border))',
        },
        topbar: {
          DEFAULT: 'hsl(var(--topbar))',
          foreground: 'hsl(var(--topbar-foreground))',
          muted: 'hsl(var(--topbar-muted))',
          border: 'hsl(var(--topbar-border))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 6px)',
        md: 'calc(var(--radius) - 3px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 10px)',
      },
      boxShadow: {
        // Sistema anterior: cards com borda fina e quase sem sombra; só menus e
        // diálogos flutuantes têm sombra perceptível. Nomes mantidos (usados nas telas).
        panel: '0 1px 2px hsl(var(--shadow-color) / 0.05)',
        elevated: '0 12px 30px hsl(var(--shadow-color) / 0.18)',
        glow: 'none',
        'inner-highlight': 'none',
      },
      backgroundImage: {
        // Cores sólidas no lugar dos degradês (nomes mantidos por compatibilidade).
        'premium-gradient': 'linear-gradient(hsl(var(--primary)), hsl(var(--primary)))',
        'brand-hero': 'linear-gradient(hsl(var(--steel-dark)), hsl(var(--steel-dark)))',
        'card-sheen': 'linear-gradient(hsl(var(--card)), hsl(var(--card)))',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 360ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 2.2s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
