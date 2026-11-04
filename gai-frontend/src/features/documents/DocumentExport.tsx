import { useState } from 'react';
import { api } from '@/api/http';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/usePermissions';
type Format = 'pdf' | 'docx';
interface Artifact { id: number; filename: string; checksum: string; version_id: number; visual_version: string; status: string }
export function DocumentExport({ endpoint, formats = ['pdf', 'docx'], allowMemory = false }: { endpoint: string; formats?: Format[]; allowMemory?: boolean }) {
  const { hasPermission } = usePermissions();
  const [state, setState] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [memory, setMemory] = useState(false), [artifact, setArtifact] = useState<Artifact>();
  async function download(format: Format) {
    setBusy(true); setError(''); setState('Preparando documento…'); setArtifact(undefined);
    try {
      setState('Gerando documento…');
      const { data } = await api.post<Artifact>(endpoint, { format, ...(allowMemory ? { include_memory: memory } : {}) }, { timeout: 45000 });
      setArtifact(data); setState('Preparando download protegido…');
      const file = await api.get<Blob>(`${endpoint}/${data.id}`, { responseType: 'blob', timeout: 45000 });
      const url = URL.createObjectURL(file.data), link = document.createElement('a');
      link.href = url; link.download = data.filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState('Documento gerado. Download iniciado.');
    } catch (e) {
      setState(''); setError((e as Error).message || 'Arquivo indisponível. Tente novamente.');
    } finally { setBusy(false); }
  }
  return <div className="grid gap-2" aria-busy={busy}>
    {allowMemory && hasPermission('budgets:configure-prices') && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={memory} disabled={busy} onChange={e => setMemory(e.target.checked)} />Incluir memória de cálculo interna neste documento</label>}
    <div className="flex flex-wrap gap-2">{formats.map(format => <Button key={format} variant="secondary" disabled={busy} onClick={() => void download(format)}>Baixar {format.toUpperCase()}</Button>)}</div>
    {state && <p role="status" className="text-sm">{state}</p>}
    {error && <p role="alert" className="text-sm text-destructive">Arquivo indisponível: {error}</p>}
    {artifact && <details className="text-xs text-muted-foreground"><summary>Consultar versão do documento</summary><p>Versão ID {artifact.version_id} · Modelo {artifact.visual_version} · {artifact.status}</p><p className="break-all">SHA-256: {artifact.checksum}</p></details>}
  </div>;
}
