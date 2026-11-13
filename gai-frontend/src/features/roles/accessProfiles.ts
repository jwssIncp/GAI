export const cumulativeAccess = 'Os acessos dos perfis se somam. Adicionar um perfil não remove privilégios anteriores. Ao revogar, outro perfil pode continuar concedendo o mesmo acesso.';
export const selectClass = 'min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const resources: Record<string, string> = {
  users: 'Usuários', org_roles: 'Perfis personalizados', organizations: 'Organizações',
  companies: 'Empresas', 'company-units': 'Unidades das empresas', 'project-units': 'Unidades dos projetos',
  projects: 'Projetos', 'project-preparation': 'Preparação dos projetos',
  'field-agents': 'Inventariantes', 'project-field-agents': 'Equipe dos projetos', 'field-coordination': 'Coordenação de campo',
  'inventory-items': 'Itens inventariados', 'inventory-item-images': 'Imagens dos itens', 'inventory-sessions': 'Sessões de inventário',
  'inventory-rounds': 'Rodadas de inventário', 'inventory-observations': 'Observações de campo',
  'inventory-accounting-items': 'Base contábil', 'inventory-pending-issues': 'Pendências patrimoniais',
  'catalog-assets': 'Catálogo de ativos', assets: 'Ativos (reservado para módulo futuro)',
  'asset-valuations': 'Avaliações patrimoniais', reconciliations: 'Conciliação patrimonial',
  'assisted-reconciliation': 'Conciliação assistida', consolidations: 'Consolidação de evidências', 'plate-history': 'Histórico de placas',
  payments: 'Pagamentos', expenses: 'Despesas', 'expense-accountabilities': 'Prestações de contas', 'expense-installments': 'Parcelas de despesas',
  receivables: 'Recebíveis', 'cash-flow': 'Fluxo de caixa', finance: 'Financeiro', dre: 'DRE gerencial',
  budgets: 'Orçamentos', contracts: 'Contratos', 'commercial-indicators': 'Indicadores comerciais',
  documents: 'Documentos', 'technical-reports': 'Laudos técnicos',
  'import-sessions': 'Sessões de importação', 'import-payloads': 'Dados de importação', 'import-files': 'Arquivos de importação', 'import-errors': 'Erros de importação', 'export-jobs': 'Exportações',
};
const actions: Record<string, string> = {
  read: 'Consultar', write: 'Criar e atualizar', create: 'Criar', update: 'Atualizar', edit: 'Editar',
  activate: 'Ativar', deactivate: 'Desativar', reactivate: 'Reativar', delete: 'Excluir',
  approve: 'Aprovar', reject: 'Rejeitar', cancel: 'Cancelar', archive: 'Arquivar', finish: 'Finalizar',
  pause: 'Pausar', resume: 'Retomar', block: 'Bloquear', unblock: 'Desbloquear',
  assign: 'Vincular', remove: 'Remover vínculo', import: 'Importar', export: 'Exportar', 'export-errors': 'Consultar erros da importação',
  generate: 'Gerar', ignore: 'Ignorar', resolve: 'Resolver', download: 'Baixar', retry: 'Repetir processamento',
  reprocess: 'Reprocessar', close: 'Fechar', coordinate: 'Coordenar', review: 'Revisar',
  'mark-as-paid': 'Marcar como pago', 'upload-attachment': 'Enviar comprovantes', 'download-attachment': 'Baixar comprovantes',
  reinventory: 'Solicitar reinventário', 'batch-create': 'Criar em lote', amend: 'Aditar',
  'configure-prices': 'Configurar preços', receive: 'Registrar recebimento', reverse: 'Estornar',
  classify: 'Classificar', configure: 'Configurar', adjust: 'Ajustar', periods: 'Gerenciar períodos', templates: 'Gerenciar modelos',
};
export const resourceName = (resource: string) => resources[resource] ?? 'Outras funcionalidades';
export const actionName = (action: string) => actions[action] ?? 'Ação específica';
export function permissionArea(resource: string) {
  if (['users', 'org_roles'].includes(resource)) return 'Usuários e administração';
  if (['companies', 'company-units', 'project-units'].includes(resource)) return 'Empresas e unidades';
  if (['projects', 'project-preparation', 'contracts', 'commercial-indicators', 'budgets'].includes(resource)) return 'Projetos e contratos';
  if (resource.startsWith('import-') || resource === 'export-jobs') return 'Importações e exportações';
  if (['documents', 'technical-reports'].includes(resource)) return 'Documentos e laudos';
  if (['payments', 'expenses', 'expense-accountabilities', 'expense-installments', 'receivables', 'cash-flow', 'finance', 'dre'].includes(resource)) return 'Financeiro';
  if (['field-agents', 'project-field-agents', 'field-coordination', 'inventory-items', 'inventory-item-images', 'inventory-sessions', 'inventory-rounds', 'inventory-observations'].includes(resource)) return 'Inventário e campo';
  return 'Patrimônio e avaliações';
}
export const roleName = (key: string | null | undefined, name: string) => key === 'ORG_ADMIN' ? 'Administrador da organização' : key === 'ORG_USER' ? 'Usuário da organização' : key === 'PLATFORM_ADMIN' ? 'Administrador da plataforma' : name;
