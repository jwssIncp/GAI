import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm shadow-panel backdrop-blur">
      <span className="text-xs font-medium text-muted-foreground sm:text-sm">
        Pagina <strong className="text-foreground">{page}</strong> de <strong className="text-foreground">{Math.max(totalPages, 1)}</strong>
      </span>
      <div className="flex gap-1.5">
        <Button variant="secondary" size="icon" className="size-9" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Pagina anterior">
          <ChevronLeft size={16} />
        </Button>
        <Button variant="secondary" size="icon" className="size-9" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Proxima pagina">
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
