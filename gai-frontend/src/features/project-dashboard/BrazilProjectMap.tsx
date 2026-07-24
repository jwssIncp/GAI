import { cn } from '@/utils/cn';
import type { ProjectDashboardAnalytics } from '@/types/api';

const positions: Record<string, { column: number; row: number }> = {
  RR: { column: 2, row: 1 }, AP: { column: 5, row: 1 },
  AC: { column: 1, row: 3 }, AM: { column: 2, row: 2 }, PA: { column: 4, row: 2 },
  RO: { column: 2, row: 3 }, TO: { column: 4, row: 3 }, MA: { column: 5, row: 3 },
  PI: { column: 6, row: 3 }, CE: { column: 7, row: 3 }, RN: { column: 8, row: 3 },
  PB: { column: 8, row: 4 }, PE: { column: 7, row: 4 }, AL: { column: 8, row: 5 },
  SE: { column: 7, row: 5 }, BA: { column: 6, row: 5 }, MT: { column: 3, row: 4 },
  GO: { column: 4, row: 5 }, DF: { column: 5, row: 5 }, MS: { column: 3, row: 6 },
  MG: { column: 5, row: 6 }, ES: { column: 6, row: 6 }, RJ: { column: 5, row: 7 },
  SP: { column: 4, row: 7 }, PR: { column: 3, row: 8 }, SC: { column: 3, row: 9 },
  RS: { column: 2, row: 10 },
};

export function BrazilProjectMap({
  data,
  selectedState,
  onSelectState,
}: {
  data: ProjectDashboardAnalytics['geography'];
  selectedState?: string;
  onSelectState: (state?: string) => void;
}) {
  const points = new Map(data.map((point) => [point.state, point]));
  const maxCompletion = Math.max(1, ...data.map((point) => point.completion_percentage));
  return (
    <div>
      <div
        className="mx-auto grid max-w-3xl grid-cols-8 grid-rows-10 gap-1.5"
        role="group"
        aria-label="Cartograma do Brasil por Unidade Federativa"
      >
        {Object.entries(positions).map(([state, position]) => {
          const point = points.get(state);
          const intensity = point ? Math.max(0.16, point.completion_percentage / maxCompletion) : 0;
          const active = selectedState === state;
          return (
            <button
              key={state}
              type="button"
              className={cn(
                'group relative aspect-square min-h-9 rounded-lg border text-[0.65rem] font-black transition hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-primary ring-2 ring-primary/30' : 'border-border/70',
                point ? 'text-primary-foreground shadow-panel' : 'bg-muted/45 text-muted-foreground',
              )}
              style={{
                gridColumn: position.column,
                gridRow: position.row,
                backgroundColor: point ? `hsl(var(--primary) / ${intensity})` : undefined,
              }}
              title={
                point
                  ? `${state}: ${point.inventoried_items} de ${point.total_items} inventariados (${point.completion_percentage}%)`
                  : `${state}: sem dados vinculados`
              }
              aria-label={state}
              aria-pressed={active}
              onClick={() => onSelectState(active ? undefined : state)}
            >
              {state}
              {point ? (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-44 -translate-x-1/2 rounded-lg border border-border bg-popover p-2 text-left text-xs font-medium text-popover-foreground shadow-elevated group-hover:block group-focus:block">
                  {point.inventoried_items} de {point.total_items} itens · {point.total_units} unidades
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Menor progresso</span>
        <span className="h-2 min-w-40 flex-1 rounded-full bg-gradient-to-r from-primary/15 to-primary" aria-hidden="true" />
        <span>Maior progresso</span>
      </div>
    </div>
  );
}
