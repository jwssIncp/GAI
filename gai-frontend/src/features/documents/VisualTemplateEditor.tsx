import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/http';
import { Button } from '@/components/ui/button';
interface Visual { version: string; organization_name: string; institutional: string; primary_color: string; header: string; footer: string; font: 'Roboto' | 'Times'; cover: boolean; logo_png: string | null }
const defaults: Visual = { version: 'gai-a4-v1', organization_name: 'GAI · Gestão Patrimonial', institutional: '', primary_color: '#16324F', header: 'GAI · Documentos', footer: 'Gestão do Ativo Imobilizado', font: 'Roboto', cover: true, logo_png: null };
export function VisualTemplateEditor({ organizationId }: { organizationId: number }) {
  const endpoint = `/organizations/${organizationId}/document-templates`, cache = useQueryClient();
  const query = useQuery({ queryKey: ['document-visuals', organizationId], queryFn: () => api.get<{ id: number; data: Visual }[]>(endpoint).then(r => r.data) });
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  return <details className="premium-panel p-4"><summary className="cursor-pointer font-semibold">Identidade visual de PDF e DOCX</summary>
    <p className="my-3 text-sm">Cada publicação cria uma versão. Novas aprovações de laudos e novas versões de orçamentos usam o modelo vigente. Documentos anteriores preservam sua identidade.</p>
    {query.isPending ? <p>Carregando modelo…</p> : query.error ? <p role="alert">{query.error.message}</p> : <VisualForm key={query.data?.[0]?.id ?? 0} initial={query.data?.[0]?.data ?? defaults} busy={busy} save={async data => {
      setBusy(true); setMessage(''); try { await api.post(endpoint, data); await cache.invalidateQueries({ queryKey: ['document-visuals', organizationId] }); setMessage('Nova versão visual publicada.'); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); }
    }} />}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <p className="mt-3 text-xs">Versões publicadas: {query.data?.map(v => v.data.version).join(', ') || 'GAI padrão v1'}</p>
  </details>;
}
function VisualForm({ initial, busy, save }: { initial: Visual; busy: boolean; save: (data: Omit<Visual, 'version'>) => Promise<void> }) {
  const [logo, setLogo] = useState(initial.logo_png), [error, setError] = useState('');
  const cls = 'w-full rounded-md border bg-background p-2';
  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const text = (k: string) => String(f.get(k) ?? ''); void save({ organization_name: text('organization_name'), institutional: text('institutional'), header: text('header'), footer: text('footer'), primary_color: text('primary_color'), font: text('font') as Visual['font'], cover: f.has('cover'), logo_png: logo }); }}>
    {(['organization_name', 'institutional', 'header', 'footer'] as const).map((name, i) => <label className="grid gap-1 text-sm" key={name}>{['Nome da organização', 'Informações institucionais', 'Cabeçalho', 'Rodapé'][i]}<input className={cls} name={name} required={i === 0} maxLength={[180, 1500, 120, 120][i]} defaultValue={initial[name]} /></label>)}
    <label className="grid gap-1 text-sm">Cor principal<input type="color" name="primary_color" defaultValue={initial.primary_color} /></label>
    <label className="grid gap-1 text-sm">Tipografia<select className={cls} name="font" defaultValue={initial.font}><option value="Roboto">Sem serifa</option><option value="Times">Serifada</option></select></label>
    <label className="text-sm"><input type="checkbox" name="cover" defaultChecked={initial.cover} /> Incluir capa</label>
    <label className="grid gap-1 text-sm">Logotipo PNG (128 KB, até 1024 × 1024)<input type="file" accept="image/png" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 128 * 1024 || file.type !== 'image/png') { setError('Selecione PNG de até 128 KB.'); return; } const reader = new FileReader(); reader.onload = () => { setLogo(String(reader.result)); setError(''); }; reader.readAsDataURL(file); }} /></label>
    {logo && <div><img src={logo} alt="Logotipo selecionado" className="max-h-16 max-w-40 object-contain" /><Button type="button" variant="ghost" onClick={() => setLogo(null)}>Remover logotipo</Button></div>}
    {error && <p role="alert">{error}</p>}
    <div><Button disabled={busy || !!error}>Publicar nova versão visual</Button></div>
  </form>;
}
