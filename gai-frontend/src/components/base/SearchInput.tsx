import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SearchInput({ value, onChange, placeholder = 'Buscar' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="group relative w-full md:max-w-sm">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={16} />
      <Input className="pl-10 pr-10" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value ? (
        <button type="button" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={() => onChange('')} aria-label="Limpar busca">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
