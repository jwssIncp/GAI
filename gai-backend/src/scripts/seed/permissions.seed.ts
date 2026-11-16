import { DRE_PERMISSIONS } from '../../modules/managerial-dre/dre.policy';
import { FINANCE_PERMISSIONS } from '../../modules/receivables/receivable.policy';
import { ASSISTED_PERMISSIONS } from '../../modules/assisted-reconciliation/matching.policy';
import { FIELD_PERMISSIONS } from '../../modules/field-coordination/field.policy';
import { DataSource } from 'typeorm';
import { PREPARATION_PERMISSIONS } from '../../modules/project-preparation/domain/preparation.types';
import { PermissionScope } from '../../modules/users/domain/enums/permission-scope.enum';
import { PermissionEntity } from '../../modules/users/infrastructure/persistence/permission.entity';

// Rótulos das ações nas descrições geradas (o que a tela de perfis exibe).
const ACTION_LABELS: Record<string, string> = {
  read: 'consultar',
  edit: 'editar',
  coordinate: 'coordenar',
  generate: 'gerar',
  review: 'revisar',
  amend: 'aditar',
  archive: 'arquivar',
  'configure-prices': 'configurar preços',
  approve: 'aprovar',
  receive: 'registrar recebimento',
  reverse: 'estornar',
  export: 'exportar',
  configure: 'configurar',
  classify: 'classificar',
  adjust: 'ajustar',
  periods: 'competências',
  templates: 'modelos',
};
const actionLabel = (action: string): string => ACTION_LABELS[action] ?? action;

export const PERMISSION_SEEDS: Array<{
  key: string;
  resource: string;
  action: string;
  scope: PermissionScope;
  description: string;
}> = [
  {
    key: 'organizations:read',
    resource: 'organizations',
    action: 'read',
    scope: PermissionScope.PLATFORM,
    description: 'Listar e consultar organizações',
  },
  {
    key: 'organizations:write',
    resource: 'organizations',
    action: 'write',
    scope: PermissionScope.PLATFORM,
    description: 'Criar e atualizar organizações',
  },
  {
    key: 'users:read',
    resource: 'users',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar e consultar usuários da organização',
  },
  {
    key: 'users:write',
    resource: 'users',
    action: 'write',
    scope: PermissionScope.ORGANIZATION,
    description: 'Criar e atualizar usuários da organização',
  },
  {
    key: 'org_roles:read',
    resource: 'org_roles',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar perfis personalizados da organização',
  },
  {
    key: 'org_roles:write',
    resource: 'org_roles',
    action: 'write',
    scope: PermissionScope.ORGANIZATION,
    description: 'Gerenciar perfis personalizados da organização',
  },
  {
    key: 'assets:read',
    resource: 'assets',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Reservado — leitura de ativos (módulo futuro)',
  },
  {
    key: 'assets:write',
    resource: 'assets',
    action: 'write',
    scope: PermissionScope.ORGANIZATION,
    description: 'Reservado — escrita de ativos (módulo futuro)',
  },
  {
    key: 'projects:create',
    resource: 'projects',
    action: 'create',
    scope: PermissionScope.ORGANIZATION,
    description: 'Criar projetos da organização',
  },
  {
    key: 'projects:read',
    resource: 'projects',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar e consultar projetos da organização',
  },
  {
    key: 'projects:update',
    resource: 'projects',
    action: 'update',
    scope: PermissionScope.ORGANIZATION,
    description: 'Atualizar projetos da organização',
  },
  {
    key: 'projects:activate',
    resource: 'projects',
    action: 'activate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Ativar projetos da organização',
  },
  {
    key: 'projects:pause',
    resource: 'projects',
    action: 'pause',
    scope: PermissionScope.ORGANIZATION,
    description: 'Pausar projetos da organização',
  },
  {
    key: 'projects:resume',
    resource: 'projects',
    action: 'resume',
    scope: PermissionScope.ORGANIZATION,
    description: 'Retomar projetos da organização',
  },
  {
    key: 'projects:deactivate',
    resource: 'projects',
    action: 'deactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Desativar projetos da organização',
  },
  {
    key: 'projects:reactivate',
    resource: 'projects',
    action: 'reactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Reativar projetos da organização',
  },
  {
    key: 'projects:finish',
    resource: 'projects',
    action: 'finish',
    scope: PermissionScope.ORGANIZATION,
    description: 'Finalizar projetos da organização',
  },
  {
    key: 'projects:cancel',
    resource: 'projects',
    action: 'cancel',
    scope: PermissionScope.ORGANIZATION,
    description: 'Cancelar projetos da organização',
  },
  {
    key: 'projects:archive',
    resource: 'projects',
    action: 'archive',
    scope: PermissionScope.ORGANIZATION,
    description: 'Arquivar projetos da organização',
  },
  {
    key: 'field-agents:create',
    resource: 'field-agents',
    action: 'create',
    scope: PermissionScope.ORGANIZATION,
    description: 'Criar inventariantes da organização',
  },
  {
    key: 'field-agents:read',
    resource: 'field-agents',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar e consultar inventariantes da organização',
  },
  {
    key: 'field-agents:update',
    resource: 'field-agents',
    action: 'update',
    scope: PermissionScope.ORGANIZATION,
    description: 'Atualizar inventariantes da organização',
  },
  {
    key: 'field-agents:deactivate',
    resource: 'field-agents',
    action: 'deactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Desativar inventariantes da organização',
  },
  {
    key: 'field-agents:reactivate',
    resource: 'field-agents',
    action: 'reactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Reativar inventariantes da organização',
  },
  {
    key: 'field-agents:block',
    resource: 'field-agents',
    action: 'block',
    scope: PermissionScope.ORGANIZATION,
    description: 'Bloquear inventariantes da organização',
  },
  {
    key: 'field-agents:unblock',
    resource: 'field-agents',
    action: 'unblock',
    scope: PermissionScope.ORGANIZATION,
    description: 'Desbloquear inventariantes da organização',
  },
  {
    key: 'field-agents:delete',
    resource: 'field-agents',
    action: 'delete',
    scope: PermissionScope.ORGANIZATION,
    description: 'Excluir inventariantes (exclusão lógica)',
  },
  {
    key: 'project-field-agents:assign',
    resource: 'project-field-agents',
    action: 'assign',
    scope: PermissionScope.ORGANIZATION,
    description: 'Vincular inventariantes a projetos',
  },
  {
    key: 'project-field-agents:read',
    resource: 'project-field-agents',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar inventariantes dos projetos',
  },
  {
    key: 'project-field-agents:update',
    resource: 'project-field-agents',
    action: 'update',
    scope: PermissionScope.ORGANIZATION,
    description: 'Atualizar vínculos de inventariantes nos projetos',
  },
  {
    key: 'project-field-agents:remove',
    resource: 'project-field-agents',
    action: 'remove',
    scope: PermissionScope.ORGANIZATION,
    description: 'Remover inventariantes dos projetos (exclusão lógica)',
  },
  {
    key: 'inventory-items:create',
    resource: 'inventory-items',
    action: 'create',
    scope: PermissionScope.ORGANIZATION,
    description: 'Criar itens inventariados da organização',
  },
  {
    key: 'inventory-items:read',
    resource: 'inventory-items',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar e consultar itens inventariados da organização',
  },
  {
    key: 'inventory-items:update',
    resource: 'inventory-items',
    action: 'update',
    scope: PermissionScope.ORGANIZATION,
    description: 'Atualizar itens inventariados da organização',
  },
  {
    key: 'inventory-items:deactivate',
    resource: 'inventory-items',
    action: 'deactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Desativar itens inventariados da organização',
  },
  {
    key: 'inventory-items:reactivate',
    resource: 'inventory-items',
    action: 'reactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Reativar itens inventariados da organização',
  },
  {
    key: 'inventory-item-images:create',
    resource: 'inventory-item-images',
    action: 'create',
    scope: PermissionScope.ORGANIZATION,
    description: 'Enviar imagens dos itens inventariados',
  },
  {
    key: 'inventory-item-images:read',
    resource: 'inventory-item-images',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar e consultar imagens dos itens inventariados',
  },
  {
    key: 'inventory-item-images:update',
    resource: 'inventory-item-images',
    action: 'update',
    scope: PermissionScope.ORGANIZATION,
    description: 'Confirmar o envio de imagens dos itens inventariados',
  },
  {
    key: 'inventory-item-images:remove',
    resource: 'inventory-item-images',
    action: 'remove',
    scope: PermissionScope.ORGANIZATION,
    description: 'Remover imagens dos itens inventariados (exclusão lógica)',
  },
  {
    key: 'inventory-item-images:download',
    resource: 'inventory-item-images',
    action: 'download',
    scope: PermissionScope.ORGANIZATION,
    description: 'Baixar imagens dos itens inventariados',
  },
  {
    key: 'inventory-accounting-items:create',
    resource: 'inventory-accounting-items',
    action: 'create',
    scope: PermissionScope.ORGANIZATION,
    description: 'Criar itens da base contábil da organização',
  },
  {
    key: 'inventory-accounting-items:read',
    resource: 'inventory-accounting-items',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar e consultar itens da base contábil da organização',
  },
  {
    key: 'inventory-accounting-items:update',
    resource: 'inventory-accounting-items',
    action: 'update',
    scope: PermissionScope.ORGANIZATION,
    description: 'Atualizar itens da base contábil da organização',
  },
  {
    key: 'inventory-accounting-items:deactivate',
    resource: 'inventory-accounting-items',
    action: 'deactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Desativar itens da base contábil da organização',
  },
  {
    key: 'inventory-accounting-items:reactivate',
    resource: 'inventory-accounting-items',
    action: 'reactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Reativar itens da base contábil da organização',
  },
  {
    key: 'inventory-accounting-items:import',
    resource: 'inventory-accounting-items',
    action: 'import',
    scope: PermissionScope.ORGANIZATION,
    description: 'Importar planilhas da base contábil da organização',
  },
  {
    key: 'inventory-accounting-items:export-errors',
    resource: 'inventory-accounting-items',
    action: 'export-errors',
    scope: PermissionScope.ORGANIZATION,
    description: 'Consultar relatórios de erro da importação contábil',
  },
  {
    key: 'inventory-pending-issues:create',
    resource: 'inventory-pending-issues',
    action: 'create',
    scope: PermissionScope.ORGANIZATION,
    description: 'Criar pendências patrimoniais da organização',
  },
  {
    key: 'inventory-pending-issues:read',
    resource: 'inventory-pending-issues',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar e consultar pendências patrimoniais da organização',
  },
  {
    key: 'inventory-pending-issues:update',
    resource: 'inventory-pending-issues',
    action: 'update',
    scope: PermissionScope.ORGANIZATION,
    description: 'Atualizar pendências patrimoniais da organização',
  },
  {
    key: 'inventory-pending-issues:resolve',
    resource: 'inventory-pending-issues',
    action: 'resolve',
    scope: PermissionScope.ORGANIZATION,
    description: 'Resolver pendências patrimoniais da organização',
  },
  {
    key: 'inventory-pending-issues:ignore',
    resource: 'inventory-pending-issues',
    action: 'ignore',
    scope: PermissionScope.ORGANIZATION,
    description: 'Ignorar pendências patrimoniais da organização',
  },
  {
    key: 'inventory-pending-issues:cancel',
    resource: 'inventory-pending-issues',
    action: 'cancel',
    scope: PermissionScope.ORGANIZATION,
    description: 'Cancelar pendências patrimoniais da organização',
  },
  {
    key: 'inventory-pending-issues:generate',
    resource: 'inventory-pending-issues',
    action: 'generate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Gerar pendências patrimoniais automaticamente',
  },
  ...[
    [
      'expense-accountabilities:create',
      'expense-accountabilities',
      'create',
      'Abrir prestações de contas',
    ],
    [
      'expense-accountabilities:read',
      'expense-accountabilities',
      'read',
      'Consultar prestações de contas',
    ],
    [
      'expense-accountabilities:update',
      'expense-accountabilities',
      'update',
      'Vincular despesas a prestações',
    ],
    [
      'expense-accountabilities:close',
      'expense-accountabilities',
      'close',
      'Fechar prestações de contas',
    ],
    [
      'expense-installments:create',
      'expense-installments',
      'create',
      'Gerar parcelas de despesas',
    ],
    [
      'expense-installments:read',
      'expense-installments',
      'read',
      'Consultar parcelas de despesas',
    ],
  ].map(([key, resource, action, description]) => ({
    key,
    resource,
    action,
    scope: PermissionScope.ORGANIZATION,
    description,
  })),
  ...[
    [
      'inventory-sessions:create',
      'inventory-sessions',
      'create',
      'Criar sessões de inventário',
    ],
    [
      'inventory-sessions:read',
      'inventory-sessions',
      'read',
      'Consultar sessões e histórico de inventário',
    ],
    [
      'inventory-sessions:update',
      'inventory-sessions',
      'update',
      'Iniciar e finalizar sessões e rodadas',
    ],
    [
      'inventory-rounds:reinventory',
      'inventory-rounds',
      'reinventory',
      'Solicitar reinventário preservando histórico',
    ],
    [
      'inventory-observations:create',
      'inventory-observations',
      'create',
      'Registrar observações de campo',
    ],
    [
      'reconciliations:create',
      'reconciliations',
      'create',
      'Executar conciliação físico-contábil',
    ],
    [
      'reconciliations:read',
      'reconciliations',
      'read',
      'Consultar conciliações',
    ],
    [
      'consolidations:create',
      'consolidations',
      'create',
      'Consolidar evidências de conciliação',
    ],
    [
      'asset-valuations:create',
      'asset-valuations',
      'create',
      'Registrar avaliação manual',
    ],
    [
      'asset-valuations:read',
      'asset-valuations',
      'read',
      'Consultar histórico de avaliações',
    ],
    [
      'plate-history:read',
      'plate-history',
      'read',
      'Consultar histórico e fontes de placas',
    ],
  ].map(([key, resource, action, description]) => ({
    key,
    resource,
    action,
    scope: PermissionScope.ORGANIZATION,
    description,
  })),
  ...[
    [
      'payments:create',
      'payments',
      'create',
      'Criar pagamentos de inventariantes',
    ],
    ['payments:read', 'payments', 'read', 'Listar e consultar pagamentos'],
    ['payments:update', 'payments', 'update', 'Atualizar pagamentos'],
    ['payments:approve', 'payments', 'approve', 'Aprovar pagamentos'],
    [
      'payments:mark-as-paid',
      'payments',
      'mark-as-paid',
      'Marcar pagamentos como pagos',
    ],
    ['payments:cancel', 'payments', 'cancel', 'Cancelar pagamentos'],
    ['payments:export', 'payments', 'export', 'Exportar pagamentos'],
    ['expenses:create', 'expenses', 'create', 'Criar despesas'],
    ['expenses:read', 'expenses', 'read', 'Listar e consultar despesas'],
    ['expenses:update', 'expenses', 'update', 'Atualizar despesas'],
    ['expenses:approve', 'expenses', 'approve', 'Aprovar despesas'],
    ['expenses:reject', 'expenses', 'reject', 'Rejeitar despesas'],
    [
      'expenses:mark-as-paid',
      'expenses',
      'mark-as-paid',
      'Marcar despesas como pagas',
    ],
    ['expenses:cancel', 'expenses', 'cancel', 'Cancelar despesas'],
    [
      'expenses:upload-attachment',
      'expenses',
      'upload-attachment',
      'Criar e confirmar comprovantes de despesas',
    ],
    [
      'expenses:download-attachment',
      'expenses',
      'download-attachment',
      'Baixar comprovantes de despesas',
    ],
  ].map(([key, resource, action, description]) => ({
    key,
    resource,
    action,
    scope: PermissionScope.ORGANIZATION,
    description,
  })),
  ...[
    [
      'import-sessions:create',
      'import-sessions',
      'create',
      'Criar sessões de importação',
    ],
    [
      'import-sessions:read',
      'import-sessions',
      'read',
      'Listar e consultar sessões de importação',
    ],
    [
      'import-sessions:finish',
      'import-sessions',
      'finish',
      'Finalizar sessões de importação',
    ],
    [
      'import-sessions:cancel',
      'import-sessions',
      'cancel',
      'Cancelar sessões de importação',
    ],
    [
      'import-sessions:retry',
      'import-sessions',
      'retry',
      'Reprocessar sessões com falha',
    ],
    [
      'import-payloads:create',
      'import-payloads',
      'create',
      'Receber pacotes de importação',
    ],
    [
      'import-payloads:read',
      'import-payloads',
      'read',
      'Listar e consultar pacotes de importação',
    ],
    [
      'import-payloads:reprocess',
      'import-payloads',
      'reprocess',
      'Reprocessar pacotes com falha',
    ],
    [
      'import-errors:read',
      'import-errors',
      'read',
      'Consultar erros de importação',
    ],
    [
      'import-files:create',
      'import-files',
      'create',
      'Criar e confirmar arquivos de importação',
    ],
    [
      'import-files:read',
      'import-files',
      'read',
      'Listar arquivos de importação',
    ],
    [
      'import-files:download',
      'import-files',
      'download',
      'Baixar arquivos de importação',
    ],
  ].map(([key, resource, action, description]) => ({
    key,
    resource,
    action,
    scope: PermissionScope.ORGANIZATION,
    description,
  })),
  {
    key: 'catalog-assets:create',
    resource: 'catalog-assets',
    action: 'create',
    scope: PermissionScope.ORGANIZATION,
    description: 'Criar itens do catálogo da organização',
  },
  {
    key: 'catalog-assets:read',
    resource: 'catalog-assets',
    action: 'read',
    scope: PermissionScope.ORGANIZATION,
    description: 'Listar e consultar itens do catálogo da organização',
  },
  {
    key: 'catalog-assets:update',
    resource: 'catalog-assets',
    action: 'update',
    scope: PermissionScope.ORGANIZATION,
    description: 'Atualizar itens do catálogo da organização',
  },
  {
    key: 'catalog-assets:deactivate',
    resource: 'catalog-assets',
    action: 'deactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Desativar itens do catálogo da organização',
  },
  {
    key: 'catalog-assets:reactivate',
    resource: 'catalog-assets',
    action: 'reactivate',
    scope: PermissionScope.ORGANIZATION,
    description: 'Reativar itens do catálogo da organização',
  },
  ...[
    ['export-jobs:create', 'create', 'Solicitar exportações de projetos'],
    ['export-jobs:read', 'read', 'Listar e consultar exportações de projetos'],
    ['export-jobs:download', 'download', 'Baixar exportações de projetos'],
    ['export-jobs:cancel', 'cancel', 'Cancelar exportações de projetos'],
    ['export-jobs:retry', 'retry', 'Repetir exportações de projetos'],
  ].map(([key, action, description]) => ({
    key,
    resource: 'export-jobs',
    action,
    scope: PermissionScope.ORGANIZATION,
    description,
  })),
  ...[
    [
      'companies:create',
      'companies',
      'create',
      'Cadastrar clientes da organização',
    ],
    ['companies:read', 'companies', 'read', 'Listar e consultar clientes'],
    ['companies:update', 'companies', 'update', 'Atualizar clientes'],
    ['companies:deactivate', 'companies', 'deactivate', 'Desativar clientes'],
    ['companies:reactivate', 'companies', 'reactivate', 'Reativar clientes'],
    [
      'company-units:create',
      'company-units',
      'create',
      'Cadastrar unidades de clientes',
    ],
    [
      'company-units:read',
      'company-units',
      'read',
      'Listar e consultar unidades de clientes',
    ],
    [
      'company-units:update',
      'company-units',
      'update',
      'Atualizar unidades de clientes',
    ],
    [
      'company-units:deactivate',
      'company-units',
      'deactivate',
      'Desativar unidades de clientes',
    ],
    [
      'company-units:reactivate',
      'company-units',
      'reactivate',
      'Reativar unidades de clientes',
    ],
    [
      'project-units:assign',
      'project-units',
      'assign',
      'Vincular unidades a projetos',
    ],
    [
      'project-units:read',
      'project-units',
      'read',
      'Listar unidades dos projetos',
    ],
    [
      'project-units:remove',
      'project-units',
      'remove',
      'Remover unidades dos projetos',
    ],
  ].map(([key, resource, action, description]) => ({
    key,
    resource,
    action,
    scope: PermissionScope.ORGANIZATION,
    description,
  })),
  ...PREPARATION_PERMISSIONS.map((permission) => ({
    ...permission,
    resource: 'project-preparation',
    scope: PermissionScope.ORGANIZATION,
  })),
];

for (const key of FIELD_PERMISSIONS)
  PERMISSION_SEEDS.push({
    key,
    resource: 'field-coordination',
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description: 'Coordenação de campo: ' + actionLabel(key.split(':')[1]),
  });

for (const key of ASSISTED_PERMISSIONS)
  PERMISSION_SEEDS.push({
    key,
    resource: 'assisted-reconciliation',
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description: 'Conciliação assistida: ' + actionLabel(key.split(':')[1]),
  });
PERMISSION_SEEDS.push({
  key: 'asset-valuations:batch-create',
  resource: 'asset-valuations',
  action: 'batch-create',
  scope: PermissionScope.ORGANIZATION,
  description: 'Registrar avaliações patrimoniais em lote',
});
for (const key of [
  'contracts:read',
  'contracts:edit',
  'contracts:amend',
  'contracts:archive',
  'commercial-indicators:read',
]) {
  const [resource, action] = key.split(':');
  PERMISSION_SEEDS.push({
    key,
    resource,
    action,
    scope: PermissionScope.ORGANIZATION,
    description:
      resource === 'commercial-indicators'
        ? 'Indicadores comerciais: consultar'
        : 'Gestão contratual: ' + actionLabel(action),
  });
}
for (const action of ['read', 'edit', 'configure-prices', 'approve']) {
  PERMISSION_SEEDS.push({
    key: 'budgets:' + action,
    resource: 'budgets',
    action,
    scope: PermissionScope.ORGANIZATION,
    description: 'Orçamentos: ' + actionLabel(action),
  });
}
for (const key of FINANCE_PERMISSIONS) {
  const [resource, action] = key.split(':');
  PERMISSION_SEEDS.push({
    key,
    resource,
    action,
    scope: PermissionScope.ORGANIZATION,
    description: 'Financeiro: ' + actionLabel(action),
  });
}
for (const key of DRE_PERMISSIONS) {
  PERMISSION_SEEDS.push({
    key,
    resource: 'dre',
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description: 'DRE gerencial: ' + actionLabel(key.split(':')[1]),
  });
}
for (const key of ['budgets:export', 'documents:templates'])
  PERMISSION_SEEDS.push({
    key,
    resource: key.split(':')[0],
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description:
      key === 'budgets:export'
        ? 'Documentos profissionais: exportar orçamento'
        : 'Documentos profissionais: gerenciar modelos',
  });
/**
 * Sincroniza o catálogo de permissões (roda no release, depois das migrations).
 * Só ACRESCENTA as chaves que faltam, com a descrição do seed no momento da
 * criação. Nunca altera nem remove chaves existentes (nem descrição, nem
 * escopo) e nunca toca em perfis, vínculos perfil×permissão ou atribuições de
 * usuário: chave nova não é concedida a ninguém automaticamente. Rodar de novo
 * não muda nenhuma linha. Devolve as chaves criadas.
 */
export async function seedPermissions(
  dataSource: DataSource,
): Promise<string[]> {
  const repo = dataSource.getRepository(PermissionEntity);
  const existing = new Set(
    (await repo.find({ select: { key: true } })).map(({ key }) => key),
  );
  const created: string[] = [];

  for (const seed of PERMISSION_SEEDS) {
    if (existing.has(seed.key)) continue;
    await repo.insert(repo.create(seed));
    existing.add(seed.key);
    created.push(seed.key);
  }
  return created;
}

for (const key of [
  'technical-reports:read',
  'technical-reports:edit',
  'technical-reports:templates',
  'technical-reports:approve',
  'technical-reports:export',
])
  PERMISSION_SEEDS.push({
    key,
    resource: 'technical-reports',
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description: 'Laudos técnicos: ' + actionLabel(key.split(':')[1]),
  });

// Paridade financeira, etapa 2: Remuneração (excluir e reabrir lançamento).
for (const [key, description] of [
  ['payments:delete', 'Remuneração: excluir lançamento (exclusão lógica)'],
  ['payments:reopen', 'Remuneração: reabrir lançamento aprovado para edição'],
  [
    'payments:revert-payment',
    'Pagamento de inventariantes: voltar pago para em aberto',
  ],
  [
    'payments:reschedule',
    'Pagamento de inventariantes: alterar data prevista ou de pagamento',
  ],
])
  PERMISSION_SEEDS.push({
    key,
    resource: 'payments',
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description,
  });

// Paridade financeira, etapa 9: importar planilha da DRE mensal.
PERMISSION_SEEDS.push({
  key: 'dre:import',
  resource: 'dre',
  action: 'import',
  scope: PermissionScope.ORGANIZATION,
  description: 'DRE: importar planilha do ano (com pré-visualização)',
});

// Paridade financeira, etapa 8: simular venda nos indicadores do fluxo de caixa.
PERMISSION_SEEDS.push({
  key: 'cash-flow:simulate',
  resource: 'cash-flow',
  action: 'simulate',
  scope: PermissionScope.ORGANIZATION,
  description: 'Fluxo de caixa: simular venda nos indicadores',
});

// Paridade financeira, etapa 7: fluxo de caixa (reprogramar parcela de recebível).
PERMISSION_SEEDS.push({
  key: 'receivables:reschedule',
  resource: 'receivables',
  action: 'reschedule',
  scope: PermissionScope.ORGANIZATION,
  description: 'Recebíveis: reprogramar a data prevista de uma parcela',
});

// Paridade financeira, etapa 6: comissões e parceiros.
for (const [key, description] of [
  ['commissions:read', 'Comissões: consultar comissões e parceiros'],
  ['commissions:edit', 'Comissões: lançar, editar e excluir'],
  ['commission-partners:edit', 'Parceiros de comissão: cadastrar e excluir'],
])
  PERMISSION_SEEDS.push({
    key,
    resource: key.split(':')[0],
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description,
  });

// Paridade financeira, etapa 5: placas de patrimônio.
for (const [key, description] of [
  ['asset-tag-orders:read', 'Placas de patrimônio: consultar'],
  ['asset-tag-orders:edit', 'Placas de patrimônio: lançar, editar e excluir'],
])
  PERMISSION_SEEDS.push({
    key,
    resource: 'asset-tag-orders',
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description,
  });

// Paridade financeira, etapa 4: despesas, adiantamentos, lotes de reembolso e conclusão.
for (const [key, description] of [
  ['expenses:delete', 'Despesas: excluir lançamento (exclusão lógica)'],
  ['expenses:import', 'Despesas: importar lista (Excel/CSV)'],
  ['expenses:export-zip', 'Despesas: exportar ZIP com comprovantes'],
  ['expenses:reopen', 'Despesas: reabrir lançamento aprovado para edição'],
  ['expense-advances:read', 'Adiantamentos: consultar'],
  ['expense-advances:create', 'Adiantamentos: lançar'],
  ['expense-advances:update', 'Adiantamentos: editar'],
  ['expense-advances:delete', 'Adiantamentos: excluir'],
  ['reimbursement-batches:read', 'Lotes de reembolso: consultar'],
  [
    'reimbursement-batches:create',
    'Lotes de reembolso: criar e incluir despesas (prestar conta)',
  ],
  ['reimbursement-batches:close', 'Lotes de reembolso: faturar ao cliente'],
  ['reimbursement-batches:reopen', 'Lotes de reembolso: reabrir ou cancelar'],
  ['project-finance:close', 'Financeiro do projeto: concluir'],
  ['project-finance:reopen', 'Financeiro do projeto: reabrir'],
])
  PERMISSION_SEEDS.push({
    key,
    resource: key.split(':')[0],
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description,
  });

// Paridade financeira, etapa 1: parâmetros financeiros e cadastro de inventariantes.
for (const [key, description] of [
  ['finance-settings:read', 'Parâmetros financeiros: consultar'],
  ['finance-settings:update', 'Parâmetros financeiros: criar nova versão'],
  ['field-agents:export', 'Exportar inventariantes'],
  [
    'field-agent-documents:read',
    'Documentos do inventariante: consultar e baixar',
  ],
  ['field-agent-documents:upload', 'Documentos do inventariante: anexar'],
  ['field-agent-documents:remove', 'Documentos do inventariante: remover'],
])
  PERMISSION_SEEDS.push({
    key,
    resource: key.split(':')[0],
    action: key.split(':')[1],
    scope: PermissionScope.ORGANIZATION,
    description,
  });
