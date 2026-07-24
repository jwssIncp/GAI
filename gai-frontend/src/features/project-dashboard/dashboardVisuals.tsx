import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProjectDashboardAnalytics, ProjectDashboardUnit } from '@/types/api';
import { statusPresentation } from './statusPresentation';

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 14px 40px -20px hsl(var(--foreground) / .4)',
};

export function InventoryTimelineChart({
  data,
}: {
  data: ProjectDashboardAnalytics['timeline'];
}) {
  if (!data.length) return <ChartEmpty message="Sem itens inventariados no período selecionado." />;
  return (
    <div className="h-80 w-full" role="img" aria-label="Itens inventariados por período, média móvel e acumulado">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: -12 }}>
          <defs>
            <linearGradient id="inventoryArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Area
            type="monotone"
            dataKey="inventoried_items"
            name="Inventariados"
            fill="url(#inventoryArea)"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="moving_average"
            name="Média móvel"
            stroke="hsl(var(--chart-4))"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CumulativeProgressChart({
  data,
}: {
  data: ProjectDashboardAnalytics['timeline'];
}) {
  if (!data.length) return <ChartEmpty message="A evolução acumulada aparecerá após a primeira atividade." />;
  return (
    <div className="h-80 w-full" role="img" aria-label="Evolução acumulada do inventário">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: -12 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Area
            type="monotone"
            dataKey="cumulative_inventoried_items"
            name="Inventariado acumulado"
            fill="hsl(var(--chart-2) / .16)"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2.5}
          />
          <Line
            type="monotone"
            dataKey="total_items_reference"
            name="Total no filtro"
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="6 5"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDistributionChart({
  data,
}: {
  data: ProjectDashboardAnalytics['status_distribution'];
}) {
  if (!data.length) return <ChartEmpty message="Nenhum status encontrado com os filtros atuais." />;
  const chartData = data.map((item) => ({
    ...item,
    label: statusPresentation[item.status]?.label ?? item.status,
  }));
  return (
    <div className="h-80 w-full" role="img" aria-label="Distribuição dos itens por status">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="total_items"
            nameKey="label"
            innerRadius={64}
            outerRadius={102}
            paddingAngle={2}
          >
            {chartData.map((item) => (
              <Cell
                key={item.status}
                fill={statusPresentation[item.status]?.color ?? 'hsl(var(--chart-5))'}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UnitsChart({ data }: { data: ProjectDashboardUnit[] }) {
  if (!data.length) return <ChartEmpty message="Nenhuma unidade textual encontrada." />;
  const visible = data.slice(0, 12).map((item) => ({
    ...item,
    label: item.unit || 'Sem unidade',
  }));
  return (
    <div className="h-[26rem] w-full" role="img" aria-label="Itens inventariados e pendentes por unidade">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={visible} layout="vertical" margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
          <YAxis type="category" dataKey="label" width={112} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Bar dataKey="inventoried_items" name="Inventariados" stackId="items" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
          <Bar dataKey="pending_items" name="Não inventariados" stackId="items" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-muted/25 p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
