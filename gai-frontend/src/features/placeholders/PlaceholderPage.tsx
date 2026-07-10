import { PageContainer } from '@/components/base/PageContainer';
import { PageHeader } from '@/components/base/PageHeader';
import { EmptyState } from '@/components/base/States';

export function PlaceholderPage({ title, dependency }: { title: string; dependency?: string }) {
  return (
    <PageContainer>
      <PageHeader title={title} description="Modulo preparado para proxima rodada." />
      <EmptyState title="Modulo preparado para proxima rodada" description={dependency ?? 'A rota esta reservada, mas nenhuma chamada ficticia foi adicionada ao produto.'} />
    </PageContainer>
  );
}
