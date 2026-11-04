import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '@/api/http';
import { EmptyState, ErrorState, LoadingState } from '@/components/base/States';
import paths from './brazilStatePaths.json';

import { projectStatuses } from './projectStatuses';
export function OverviewSection({ title, children }: { title: string; children: ReactNode }) {
  return <details open className="premium-panel min-w-0 p-5"><summary className="cursor-pointer font-semibold">{title}<span className="ml-3 text-xs font-normal text-muted-foreground">Recolher / expandir</span></summary><div className="mt-4">{children}</div></details>;
}

export function PortfolioStatus({ rows, selected, onSelect }: { rows: { status: string; total: number }[]; selected?: string; onSelect: (status?: string) => void }) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const colors = ['hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-1))', 'hsl(var(--chart-3))', 'hsl(var(--chart-5))'];
  const data = rows.map(row => ({ ...row, name: projectStatuses[row.status] ?? row.status }));
  return <OverviewSection title="Status da carteira">
    <p className="text-xs text-muted-foreground">Abertos seguem o critério anterior: status Ativo. Os demais status aparecem separadamente, sem serem classificados como concluídos.</p>
    {total ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="total" nameKey="name" innerRadius="55%" outerRadius="80%" isAnimationActive={false} onClick={entry => onSelect(selected === entry.status ? undefined : entry.status)}>{data.map((row, i) => <Cell key={row.status} fill={colors[i % colors.length]} />)}</Pie><Tooltip formatter={(value: number) => [`${value.toLocaleString('pt-BR')} (${(value / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)`, 'Projetos']} /><Legend /></PieChart></ResponsiveContainer></div> : <EmptyState />}
    <div className="flex flex-wrap gap-2">{data.map(row => <button key={row.status} type="button" aria-pressed={selected === row.status} className="rounded-lg border px-3 py-2 text-sm" onClick={() => onSelect(selected === row.status ? undefined : row.status)}>{row.name}: {row.total.toLocaleString('pt-BR')} ({(row.total / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</button>)}</div>
  </OverviewSection>;
}

export function OrganizationPresenceMap({ rows, unlocated, selected, onSelect }: { rows: { state: string; total: number }[]; unlocated: number; selected?: string; onSelect: (state?: string) => void }) {
  const totals = new Map(rows.map(row => [row.state, row.total]));
  const max = Math.max(1, ...rows.map(row => row.total));
  return <OverviewSection title="Mapa do Brasil — presença por estado">
    <p className="mb-4 text-xs text-muted-foreground">Presença operacional pelas UFs das unidades vinculadas. Cada projeto conta uma vez por UF; projetos multi-UF aparecem em vários estados. Sem UF válida: {unlocated.toLocaleString('pt-BR')}. Valor contratado indisponível.</p>
    <div className="grid gap-5 lg:grid-cols-[2fr_1fr]"><svg viewBox="0 0 530 530" className="mx-auto w-full max-w-xl" role="group" aria-label="Mapa geográfico do Brasil por UF">{paths.map(({ state, d }) => {
      const total = totals.get(state) ?? 0;
      return <path key={state} d={d} fill={total ? `hsl(var(--chart-2) / ${0.2 + total / max * 0.8})` : 'hsl(var(--muted))'} stroke={selected === state ? 'hsl(var(--foreground))' : 'hsl(var(--background))'} strokeWidth={selected === state ? 2 : 0.6} role="button" tabIndex={0} aria-pressed={selected === state} aria-label={`${state}: ${total} projetos`} onClick={() => onSelect(selected === state ? undefined : state)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selected === state ? undefined : state); } }} className="cursor-pointer focus:outline-none focus:stroke-foreground focus:stroke-2"><title>{state}: {total} projeto(s) · valor contratado indisponível</title></path>;
    })}{paths.map(({ state, x, y }) => <text key={state} x={x} y={y} textAnchor="middle" fontSize="8" fill="hsl(var(--foreground))" pointerEvents="none" aria-hidden="true">{state}</text>)}</svg><div><p className="font-semibold">Estados com maior presença</p>{[...rows].sort((a, b) => b.total - a.total || a.state.localeCompare(b.state)).slice(0, 8).map(row => <button className="my-1 flex w-full justify-between rounded border p-2 text-sm" key={row.state} onClick={() => onSelect(selected === row.state ? undefined : row.state)} aria-pressed={selected === row.state}><span>{row.state}</span><span>{row.total.toLocaleString('pt-BR')} projeto(s)</span></button>)}<p className="mt-4 text-xs text-muted-foreground">Sem projetos: cinza</p><div className="my-2 h-3 rounded bg-gradient-to-r from-chart-2/20 to-chart-2" /><p className="text-xs text-muted-foreground">Menor atuação → Maior atuação</p><p className="mt-4 text-xs text-muted-foreground">Malha: IBGE, incorporada localmente.</p></div></div>
    {selected ? <button className="mt-3 rounded border p-2 text-sm" onClick={() => onSelect(undefined)}>Remover filtro UF {selected}</button> : null}
  </OverviewSection>;
}

interface Page<T> { total: number; page: number; page_size: number; items: T[] }
interface ProjectRow { id: number; name: string; status: string; created_at: string; company: string | null; addresses: number; states: string | null }
const columns = { name: 'Projeto', status: 'Status', company: 'Empresa', states: 'UF das unidades', created_at: 'Criado em', addresses: 'Unidades vinculadas', stage: 'Etapa', segment: 'Segmento', contract_date: 'Data do contrato', contract_value: 'Valor contratado', contracted_items: 'Itens contratados' };
function Pagination({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (page: number) => void }) {
  return <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button><span>Página {page} de {Math.max(1, Math.ceil(total / size))} · {total.toLocaleString('pt-BR')} registro(s)</span><button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page * size >= total} onClick={() => onPage(page + 1)}>Próxima</button></div>;
}
export function OverviewTables({ filters, scope, onCompany }: { filters: Record<string, string>; scope: string; onCompany: (id: number) => void }) {
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);
  const [sort, setSort] = useState('created_at');
  const [direction, setDirection] = useState('DESC');
  const [companySort, setCompanySort] = useState('total');
  const [companyDirection, setCompanyDirection] = useState('DESC');
  const [companySearch, setCompanySearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [visible, setVisible] = useState<string[]>(['name', 'status', 'company', 'states', 'created_at', 'addresses']);
  function sortProjects(key: string) {
    setSort(key); setDirection(sort === key && direction === 'ASC' ? 'DESC' : 'ASC'); setPage(1);
  }
  const projects = useQuery({ queryKey: ['overview-projects', scope, filters, page, sort, direction], queryFn: ({ signal }) => api.get<Page<ProjectRow>>('/organization-overview/projects', { params: { ...filters, page, page_size: 10, sort, direction }, signal }).then(r => r.data), staleTime: 30000 });
  const companies = useQuery({ queryKey: ['overview-companies', scope, filters, companyPage, companySearch, companySort, companyDirection], queryFn: ({ signal }) => api.get<Page<{ id: number | null; name: string; total: number }>>('/organization-overview/companies', { params: { ...filters, page: companyPage, page_size: 10, company_search: companySearch || undefined, sort: companySort, direction: companyDirection }, signal }).then(r => r.data), staleTime: 30000 });
  return <>
    <OverviewSection title="Agrupamento por empresa">
      <form className="mb-4 flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); setCompanyPage(1); setCompanySearch(String(new FormData(event.currentTarget).get('company_search') ?? '')); }}><label className="text-sm">Pesquisar empresa <input name="company_search" className="rounded border bg-background p-2" maxLength={120} defaultValue={companySearch} /></label><button className="rounded border px-3 text-sm">Pesquisar</button></form>
      <p className="mb-3 text-xs text-muted-foreground">Empresa é distinta da organização. Sem valores contratuais, a ordem inicial usa quantidade de projetos. Logos não possuem campo definido; as iniciais identificam a empresa.</p>
      {companies.isPending ? <LoadingState /> : companies.isError ? <ErrorState onRetry={() => void companies.refetch()} /> : companies.data ? <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{[['name', 'Empresa'], ['total', 'Projetos']].map(([key, label]) => <th key={key} className="p-2" aria-sort={companySort === key ? companyDirection === 'ASC' ? 'ascending' : 'descending' : 'none'}><button onClick={() => { setCompanySort(key); setCompanyDirection(companySort === key && companyDirection === 'DESC' ? 'ASC' : 'DESC'); setCompanyPage(1); }}>{label} ↕</button></th>)}<th className="p-2">Valor contratado</th><th className="p-2">Itens contratados</th></tr></thead><tbody>{companies.data.items.map(row => <tr className="border-t" key={row.id ?? 'unlinked'}><td className="p-2"><span aria-hidden="true" className="mr-2 inline-block rounded bg-muted p-2">{row.name.slice(0, 2).toUpperCase()}</span>{row.id ? <button className="text-primary underline" onClick={() => onCompany(row.id!)}>{row.name}</button> : row.name}</td><td className="p-2">{row.total.toLocaleString('pt-BR')}</td><td className="p-2">Indisponível</td><td className="p-2">Indisponível</td></tr>)}</tbody></table></div>{!companies.data.items.length ? <EmptyState /> : null}<Pagination page={companies.data.page} total={companies.data.total} size={10} onPage={setCompanyPage} /></> : null}
    </OverviewSection>
    <OverviewSection title="Projetos filtrados">
      <div className="mb-4 flex flex-wrap gap-4 text-sm"><label>Ordenar por <select className="rounded border bg-background p-2" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="created_at">Criação</option><option value="name">Projeto</option><option value="status">Status</option><option value="id">ID</option><option value="company">Empresa</option><option value="states">UF das unidades</option><option value="addresses">Unidades vinculadas</option></select></label><button className="rounded border px-3" onClick={() => { setDirection(direction === 'ASC' ? 'DESC' : 'ASC'); setPage(1); }}>{direction === 'ASC' ? 'Crescente' : 'Decrescente'}</button><span>{selected.length} selecionado(s), sem ações em massa</span></div>
      <details className="mb-4"><summary className="cursor-pointer text-sm">Colunas visíveis</summary><div className="mt-2 flex flex-wrap gap-3">{Object.entries(columns).map(([key, label]) => <label key={key} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={visible.includes(key)} onChange={() => setVisible(visible.includes(key) ? visible.filter(v => v !== key) : [...visible, key])} />{label}</label>)}</div></details>
      {projects.isPending ? <LoadingState /> : projects.isError ? <ErrorState onRetry={() => void projects.refetch()} /> : projects.data ? <><p className="mb-3 text-xs text-muted-foreground">Exibidos {projects.data.items.length} de {projects.data.total.toLocaleString('pt-BR')}. Datas são de criação; unidades vinculadas não equivalem a endereços contratados. Campos comerciais sem fonte aparecem como indisponíveis.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Selecionar</th>{visible.map(key => <th className="whitespace-nowrap p-2" key={key} aria-sort={sort === key ? direction === 'ASC' ? 'ascending' : 'descending' : 'none'}>{['name', 'status', 'company', 'states', 'created_at', 'addresses'].includes(key) ? <button onClick={() => sortProjects(key)}>{columns[key as keyof typeof columns]} ↕</button> : columns[key as keyof typeof columns]}</th>)}</tr></thead><tbody>{projects.data.items.map(row => <tr className="border-t" key={row.id}><td className="p-2"><input type="checkbox" aria-label={`Selecionar ${row.name}`} checked={selected.includes(row.id)} onChange={() => setSelected(selected.includes(row.id) ? selected.filter(id => id !== row.id) : [...selected, row.id])} /></td>{visible.map(key => <td key={key} className="p-2">{key === 'name' ? <Link className="text-primary underline" to={`/app/projects/${row.id}/summary?${new URLSearchParams({ return_to: location.pathname + location.search })}`}>{row.name}</Link> : key === 'status' ? projectStatuses[row.status] ?? row.status : key === 'created_at' ? new Date(row.created_at).toLocaleDateString('pt-BR') : key === 'addresses' ? row.addresses.toLocaleString('pt-BR') : key === 'company' ? row.company ?? 'Sem empresa vinculada' : key === 'states' ? row.states ?? 'Sem UF vinculada' : 'Indisponível'}</td>)}</tr>)}</tbody></table></div>{!projects.data.items.length ? <EmptyState /> : null}<Pagination page={projects.data.page} total={projects.data.total} size={10} onPage={setPage} /></> : null}
    </OverviewSection>
  </>;
}
