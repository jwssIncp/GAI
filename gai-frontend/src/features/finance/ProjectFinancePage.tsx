import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/base/PageContainer';

import { ProjectExpensesPage } from '@/features/expenses/ProjectExpensesPage';
import { useProjectLabel } from '@/features/projects/useProjectLabel';

/**
 * Projeto › Financeiro › Despesas (etapa 4 da paridade, doc 06 §3.2). A remuneração
 * (diárias) tem aba própria; o endereço antigo ?tab=payments redireciona.
 */
export function ProjectFinancePage() {
  const projectId = Number(useParams().projectId);
  const projectLabel = useProjectLabel(projectId);
  const [searchParams] = useSearchParams();
  if (searchParams.get('tab') === 'payments')
    return <Navigate to={`/app/projects/${projectId}/finance/remuneration`} replace />;

  return (
    <PageContainer>
      {/* o cabeçalho (com as ações) fica em ProjectExpensesPage, que tem o estado dos diálogos */}
      <ProjectExpensesPage
        projectId={projectId}
        description={`${projectLabel}. Despesas, adiantamentos, prestação de contas (lotes de reembolso ao cliente) e comprovantes.`}
      />
    </PageContainer>
  );
}
