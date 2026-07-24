export const statusPresentation: Record<
  string,
  { label: string; color: string }
> = {
  pending: { label: 'Pendente', color: 'hsl(var(--chart-4))' },
  evaluated: { label: 'Inventariado', color: 'hsl(var(--chart-2))' },
  divergent: { label: 'Divergente', color: 'hsl(var(--warning))' },
  not_found: { label: 'Não encontrado', color: 'hsl(var(--destructive))' },
  duplicated: { label: 'Duplicado', color: 'hsl(var(--chart-3))' },
  removed: { label: 'Removido', color: 'hsl(var(--muted-foreground))' },
  inactive: { label: 'Inativo', color: 'hsl(var(--chart-5))' },
};
