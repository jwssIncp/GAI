import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Descrições do catálogo de permissões em pt-BR (revisão geral, item 60).
 *
 * Só altera o TEXTO (coluna description), por chave, e só quando ele ainda é
 * um dos textos antigos conhecidos (o gravado pelas migrations ou o do seed
 * anterior). Descrições editadas à mão não são tocadas. Não muda schema, não
 * cria nem remove permissões e não mexe em perfis ou atribuições.
 *
 * down: volta ao texto antigo só nas linhas que ainda estão com o texto novo.
 * Quando há dois textos antigos (8 chaves), volta ao das migrations, que é o
 * de um banco criado do zero.
 */
// [chave, textos antigos aceitos, texto novo, texto restaurado no down]
export const PERMISSION_DESCRIPTIONS_PT_BR: Array<
  [string, string[], string, string]
> = [
  [
    'organizations:read',
    ['Listar e consultar organizations'],
    'Listar e consultar organizações',
    'Listar e consultar organizations',
  ],
  [
    'organizations:write',
    ['Criar e atualizar organizations'],
    'Criar e atualizar organizações',
    'Criar e atualizar organizations',
  ],
  [
    'users:read',
    ['Listar e consultar usuários da organization'],
    'Listar e consultar usuários da organização',
    'Listar e consultar usuários da organization',
  ],
  [
    'users:write',
    ['Criar e atualizar usuários da organization'],
    'Criar e atualizar usuários da organização',
    'Criar e atualizar usuários da organization',
  ],
  [
    'org_roles:read',
    ['Listar papéis customizados da organization'],
    'Listar perfis personalizados da organização',
    'Listar papéis customizados da organization',
  ],
  [
    'org_roles:write',
    ['Gerenciar papéis customizados da organization'],
    'Gerenciar perfis personalizados da organização',
    'Gerenciar papéis customizados da organization',
  ],
  [
    'projects:create',
    ['Criar projects da organization'],
    'Criar projetos da organização',
    'Criar projects da organization',
  ],
  [
    'projects:read',
    ['Listar e consultar projects da organization'],
    'Listar e consultar projetos da organização',
    'Listar e consultar projects da organization',
  ],
  [
    'projects:update',
    ['Atualizar projects da organization'],
    'Atualizar projetos da organização',
    'Atualizar projects da organization',
  ],
  [
    'projects:activate',
    ['Ativar projects da organization'],
    'Ativar projetos da organização',
    'Ativar projects da organization',
  ],
  [
    'projects:pause',
    ['Pausar projects da organization'],
    'Pausar projetos da organização',
    'Pausar projects da organization',
  ],
  [
    'projects:resume',
    ['Retomar projects da organization'],
    'Retomar projetos da organização',
    'Retomar projects da organization',
  ],
  [
    'projects:deactivate',
    ['Desativar projects da organization'],
    'Desativar projetos da organização',
    'Desativar projects da organization',
  ],
  [
    'projects:reactivate',
    ['Reativar projects da organization'],
    'Reativar projetos da organização',
    'Reativar projects da organization',
  ],
  [
    'projects:finish',
    ['Finalizar projects da organization'],
    'Finalizar projetos da organização',
    'Finalizar projects da organization',
  ],
  [
    'projects:cancel',
    ['Cancelar projects da organization'],
    'Cancelar projetos da organização',
    'Cancelar projects da organization',
  ],
  [
    'projects:archive',
    ['Arquivar projects da organization'],
    'Arquivar projetos da organização',
    'Arquivar projects da organization',
  ],
  [
    'field-agents:create',
    ['Criar inventariantes da organization'],
    'Criar inventariantes da organização',
    'Criar inventariantes da organization',
  ],
  [
    'field-agents:read',
    ['Listar e consultar inventariantes da organization'],
    'Listar e consultar inventariantes da organização',
    'Listar e consultar inventariantes da organization',
  ],
  [
    'field-agents:update',
    ['Atualizar inventariantes da organization'],
    'Atualizar inventariantes da organização',
    'Atualizar inventariantes da organization',
  ],
  [
    'field-agents:deactivate',
    ['Desativar inventariantes da organization'],
    'Desativar inventariantes da organização',
    'Desativar inventariantes da organization',
  ],
  [
    'field-agents:reactivate',
    ['Reativar inventariantes da organization'],
    'Reativar inventariantes da organização',
    'Reativar inventariantes da organization',
  ],
  [
    'field-agents:block',
    ['Bloquear inventariantes da organization'],
    'Bloquear inventariantes da organização',
    'Bloquear inventariantes da organization',
  ],
  [
    'field-agents:unblock',
    ['Desbloquear inventariantes da organization'],
    'Desbloquear inventariantes da organização',
    'Desbloquear inventariantes da organization',
  ],
  [
    'field-agents:delete',
    ['Excluir inventariantes logicamente'],
    'Excluir inventariantes (exclusão lógica)',
    'Excluir inventariantes logicamente',
  ],
  [
    'project-field-agents:assign',
    ['Vincular inventariantes a projects'],
    'Vincular inventariantes a projetos',
    'Vincular inventariantes a projects',
  ],
  [
    'project-field-agents:read',
    ['Listar inventariantes de projects'],
    'Listar inventariantes dos projetos',
    'Listar inventariantes de projects',
  ],
  [
    'project-field-agents:update',
    ['Atualizar vinculos de inventariantes em projects'],
    'Atualizar vínculos de inventariantes nos projetos',
    'Atualizar vinculos de inventariantes em projects',
  ],
  [
    'project-field-agents:remove',
    ['Remover logicamente inventariantes de projects'],
    'Remover inventariantes dos projetos (exclusão lógica)',
    'Remover logicamente inventariantes de projects',
  ],
  [
    'inventory-items:create',
    ['Criar itens inventariados da organization'],
    'Criar itens inventariados da organização',
    'Criar itens inventariados da organization',
  ],
  [
    'inventory-items:read',
    ['Listar e consultar itens inventariados da organization'],
    'Listar e consultar itens inventariados da organização',
    'Listar e consultar itens inventariados da organization',
  ],
  [
    'inventory-items:update',
    ['Atualizar itens inventariados da organization'],
    'Atualizar itens inventariados da organização',
    'Atualizar itens inventariados da organization',
  ],
  [
    'inventory-items:deactivate',
    ['Desativar itens inventariados da organization'],
    'Desativar itens inventariados da organização',
    'Desativar itens inventariados da organization',
  ],
  [
    'inventory-items:reactivate',
    ['Reativar itens inventariados da organization'],
    'Reativar itens inventariados da organização',
    'Reativar itens inventariados da organization',
  ],
  [
    'inventory-item-images:create',
    ['Criar URLs de upload de imagens dos itens inventariados'],
    'Enviar imagens dos itens inventariados',
    'Criar URLs de upload de imagens dos itens inventariados',
  ],
  [
    'inventory-item-images:update',
    ['Confirmar upload de imagens dos itens inventariados'],
    'Confirmar o envio de imagens dos itens inventariados',
    'Confirmar upload de imagens dos itens inventariados',
  ],
  [
    'inventory-item-images:remove',
    ['Remover logicamente imagens dos itens inventariados'],
    'Remover imagens dos itens inventariados (exclusão lógica)',
    'Remover logicamente imagens dos itens inventariados',
  ],
  [
    'inventory-item-images:download',
    ['Gerar URLs de download de imagens dos itens inventariados'],
    'Baixar imagens dos itens inventariados',
    'Gerar URLs de download de imagens dos itens inventariados',
  ],
  [
    'inventory-accounting-items:create',
    ['Criar itens da base contabil da organization'],
    'Criar itens da base contábil da organização',
    'Criar itens da base contabil da organization',
  ],
  [
    'inventory-accounting-items:read',
    ['Listar e consultar itens da base contabil da organization'],
    'Listar e consultar itens da base contábil da organização',
    'Listar e consultar itens da base contabil da organization',
  ],
  [
    'inventory-accounting-items:update',
    ['Atualizar itens da base contabil da organization'],
    'Atualizar itens da base contábil da organização',
    'Atualizar itens da base contabil da organization',
  ],
  [
    'inventory-accounting-items:deactivate',
    ['Desativar itens da base contabil da organization'],
    'Desativar itens da base contábil da organização',
    'Desativar itens da base contabil da organization',
  ],
  [
    'inventory-accounting-items:reactivate',
    ['Reativar itens da base contabil da organization'],
    'Reativar itens da base contábil da organização',
    'Reativar itens da base contabil da organization',
  ],
  [
    'inventory-accounting-items:import',
    ['Importar planilhas da base contabil da organization'],
    'Importar planilhas da base contábil da organização',
    'Importar planilhas da base contabil da organization',
  ],
  [
    'inventory-accounting-items:export-errors',
    ['Consultar relatorios de erro da importacao contabil'],
    'Consultar relatórios de erro da importação contábil',
    'Consultar relatorios de erro da importacao contabil',
  ],
  [
    'inventory-pending-issues:create',
    ['Criar pendencias patrimoniais da organization'],
    'Criar pendências patrimoniais da organização',
    'Criar pendencias patrimoniais da organization',
  ],
  [
    'inventory-pending-issues:read',
    ['Listar e consultar pendencias patrimoniais da organization'],
    'Listar e consultar pendências patrimoniais da organização',
    'Listar e consultar pendencias patrimoniais da organization',
  ],
  [
    'inventory-pending-issues:update',
    ['Atualizar pendencias patrimoniais da organization'],
    'Atualizar pendências patrimoniais da organização',
    'Atualizar pendencias patrimoniais da organization',
  ],
  [
    'inventory-pending-issues:resolve',
    ['Resolver pendencias patrimoniais da organization'],
    'Resolver pendências patrimoniais da organização',
    'Resolver pendencias patrimoniais da organization',
  ],
  [
    'inventory-pending-issues:ignore',
    ['Ignorar pendencias patrimoniais da organization'],
    'Ignorar pendências patrimoniais da organização',
    'Ignorar pendencias patrimoniais da organization',
  ],
  [
    'inventory-pending-issues:cancel',
    ['Cancelar pendencias patrimoniais da organization'],
    'Cancelar pendências patrimoniais da organização',
    'Cancelar pendencias patrimoniais da organization',
  ],
  [
    'inventory-pending-issues:generate',
    ['Gerar pendencias patrimoniais automaticamente'],
    'Gerar pendências patrimoniais automaticamente',
    'Gerar pendencias patrimoniais automaticamente',
  ],
  [
    'expense-accountabilities:create',
    ['Abrir prestacoes de contas'],
    'Abrir prestações de contas',
    'Abrir prestacoes de contas',
  ],
  [
    'expense-accountabilities:read',
    ['Consultar prestacoes de contas'],
    'Consultar prestações de contas',
    'Consultar prestacoes de contas',
  ],
  [
    'expense-accountabilities:update',
    ['Vincular despesas a prestacoes'],
    'Vincular despesas a prestações',
    'Vincular despesas a prestacoes',
  ],
  [
    'expense-accountabilities:close',
    ['Fechar prestacoes de contas'],
    'Fechar prestações de contas',
    'Fechar prestacoes de contas',
  ],
  [
    'inventory-sessions:create',
    ['Criar sessoes de inventario'],
    'Criar sessões de inventário',
    'Criar sessoes de inventario',
  ],
  [
    'inventory-sessions:read',
    ['Consultar sessoes e historico de inventario'],
    'Consultar sessões e histórico de inventário',
    'Consultar sessoes e historico de inventario',
  ],
  [
    'inventory-sessions:update',
    ['Iniciar e finalizar sessoes e rodadas'],
    'Iniciar e finalizar sessões e rodadas',
    'Iniciar e finalizar sessoes e rodadas',
  ],
  [
    'inventory-rounds:reinventory',
    ['Solicitar reinventario preservando historico'],
    'Solicitar reinventário preservando histórico',
    'Solicitar reinventario preservando historico',
  ],
  [
    'inventory-observations:create',
    ['Registrar observacoes de campo'],
    'Registrar observações de campo',
    'Registrar observacoes de campo',
  ],
  [
    'reconciliations:create',
    ['Executar conciliacao fisico-contabil'],
    'Executar conciliação físico-contábil',
    'Executar conciliacao fisico-contabil',
  ],
  [
    'reconciliations:read',
    ['Consultar conciliacoes'],
    'Consultar conciliações',
    'Consultar conciliacoes',
  ],
  [
    'consolidations:create',
    ['Consolidar evidencias de conciliacao'],
    'Consolidar evidências de conciliação',
    'Consolidar evidencias de conciliacao',
  ],
  [
    'asset-valuations:create',
    ['Registrar avaliacao manual'],
    'Registrar avaliação manual',
    'Registrar avaliacao manual',
  ],
  [
    'asset-valuations:read',
    ['Consultar historico de avaliacoes'],
    'Consultar histórico de avaliações',
    'Consultar historico de avaliacoes',
  ],
  [
    'plate-history:read',
    ['Consultar historico e fontes de placas'],
    'Consultar histórico e fontes de placas',
    'Consultar historico e fontes de placas',
  ],
  [
    'import-sessions:create',
    ['Criar sessoes de importacao'],
    'Criar sessões de importação',
    'Criar sessoes de importacao',
  ],
  [
    'import-sessions:read',
    ['Listar e consultar sessoes de importacao'],
    'Listar e consultar sessões de importação',
    'Listar e consultar sessoes de importacao',
  ],
  [
    'import-sessions:finish',
    ['Finalizar sessoes de importacao'],
    'Finalizar sessões de importação',
    'Finalizar sessoes de importacao',
  ],
  [
    'import-sessions:cancel',
    ['Cancelar sessoes de importacao'],
    'Cancelar sessões de importação',
    'Cancelar sessoes de importacao',
  ],
  [
    'import-sessions:retry',
    ['Reprocessar sessoes com falha'],
    'Reprocessar sessões com falha',
    'Reprocessar sessoes com falha',
  ],
  [
    'import-payloads:create',
    ['Receber payloads de importacao'],
    'Receber pacotes de importação',
    'Receber payloads de importacao',
  ],
  [
    'import-payloads:read',
    ['Listar e consultar payloads de importacao'],
    'Listar e consultar pacotes de importação',
    'Listar e consultar payloads de importacao',
  ],
  [
    'import-payloads:reprocess',
    ['Reprocessar payloads com falha'],
    'Reprocessar pacotes com falha',
    'Reprocessar payloads com falha',
  ],
  [
    'import-errors:read',
    ['Consultar erros de importacao'],
    'Consultar erros de importação',
    'Consultar erros de importacao',
  ],
  [
    'import-files:create',
    ['Criar e confirmar arquivos de importacao'],
    'Criar e confirmar arquivos de importação',
    'Criar e confirmar arquivos de importacao',
  ],
  [
    'import-files:read',
    ['Listar arquivos de importacao'],
    'Listar arquivos de importação',
    'Listar arquivos de importacao',
  ],
  [
    'import-files:download',
    ['Baixar arquivos de importacao'],
    'Baixar arquivos de importação',
    'Baixar arquivos de importacao',
  ],
  [
    'catalog-assets:create',
    ['Criar ativos do catalogo da organization'],
    'Criar itens do catálogo da organização',
    'Criar ativos do catalogo da organization',
  ],
  [
    'catalog-assets:read',
    ['Listar e consultar ativos do catalogo da organization'],
    'Listar e consultar itens do catálogo da organização',
    'Listar e consultar ativos do catalogo da organization',
  ],
  [
    'catalog-assets:update',
    ['Atualizar ativos do catalogo da organization'],
    'Atualizar itens do catálogo da organização',
    'Atualizar ativos do catalogo da organization',
  ],
  [
    'catalog-assets:deactivate',
    ['Desativar ativos do catalogo da organization'],
    'Desativar itens do catálogo da organização',
    'Desativar ativos do catalogo da organization',
  ],
  [
    'catalog-assets:reactivate',
    ['Reativar ativos do catalogo da organization'],
    'Reativar itens do catálogo da organização',
    'Reativar ativos do catalogo da organization',
  ],
  [
    'export-jobs:create',
    ['Solicitar exportacoes de projects'],
    'Solicitar exportações de projetos',
    'Solicitar exportacoes de projects',
  ],
  [
    'export-jobs:read',
    ['Listar e consultar exportacoes de projects'],
    'Listar e consultar exportações de projetos',
    'Listar e consultar exportacoes de projects',
  ],
  [
    'export-jobs:download',
    ['Baixar exportacoes de projects'],
    'Baixar exportações de projetos',
    'Baixar exportacoes de projects',
  ],
  [
    'export-jobs:cancel',
    ['Cancelar exportacoes de projects'],
    'Cancelar exportações de projetos',
    'Cancelar exportacoes de projects',
  ],
  [
    'export-jobs:retry',
    ['Repetir exportacoes de projects'],
    'Repetir exportações de projetos',
    'Repetir exportacoes de projects',
  ],
  [
    'companies:create',
    ['Criar companies da organization'],
    'Cadastrar clientes da organização',
    'Criar companies da organization',
  ],
  [
    'companies:read',
    ['Listar e consultar companies'],
    'Listar e consultar clientes',
    'Listar e consultar companies',
  ],
  [
    'companies:update',
    ['Atualizar companies'],
    'Atualizar clientes',
    'Atualizar companies',
  ],
  [
    'companies:deactivate',
    ['Desativar companies'],
    'Desativar clientes',
    'Desativar companies',
  ],
  [
    'companies:reactivate',
    ['Reativar companies'],
    'Reativar clientes',
    'Reativar companies',
  ],
  [
    'company-units:create',
    ['Criar unidades de companies'],
    'Cadastrar unidades de clientes',
    'Criar unidades de companies',
  ],
  [
    'company-units:read',
    ['Listar e consultar unidades de companies'],
    'Listar e consultar unidades de clientes',
    'Listar e consultar unidades de companies',
  ],
  [
    'company-units:update',
    ['Atualizar unidades de companies'],
    'Atualizar unidades de clientes',
    'Atualizar unidades de companies',
  ],
  [
    'company-units:deactivate',
    ['Desativar unidades de companies'],
    'Desativar unidades de clientes',
    'Desativar unidades de companies',
  ],
  [
    'company-units:reactivate',
    ['Reativar unidades de companies'],
    'Reativar unidades de clientes',
    'Reativar unidades de companies',
  ],
  [
    'project-units:assign',
    ['Vincular unidades a projects'],
    'Vincular unidades a projetos',
    'Vincular unidades a projects',
  ],
  [
    'project-units:read',
    ['Listar unidades de projects'],
    'Listar unidades dos projetos',
    'Listar unidades de projects',
  ],
  [
    'project-units:remove',
    ['Remover unidades de projects'],
    'Remover unidades dos projetos',
    'Remover unidades de projects',
  ],
  [
    'project-preparation:read',
    ['Consultar preparação, modelos e comunicação'],
    'Consultar preparação, modelos, histórico e prévias de comunicação',
    'Consultar preparação, modelos e comunicação',
  ],
  [
    'project-preparation:edit',
    ['Gerenciar modelos e respostas de preparação'],
    'Gerenciar modelos e preencher preparação dos projetos',
    'Gerenciar modelos e respostas de preparação',
  ],
  [
    'project-preparation:approve',
    ['Aprovar e reabrir preparação de projetos'],
    'Aprovar e reabrir preparação dos projetos',
    'Aprovar e reabrir preparação de projetos',
  ],
  [
    'field-coordination:read',
    ['Coordenação de campo: read'],
    'Coordenação de campo: consultar',
    'Coordenação de campo: read',
  ],
  [
    'field-coordination:edit',
    ['Coordenação de campo: edit'],
    'Coordenação de campo: editar',
    'Coordenação de campo: edit',
  ],
  [
    'field-coordination:coordinate',
    ['Coordenação de campo: coordinate'],
    'Coordenação de campo: coordenar',
    'Coordenação de campo: coordinate',
  ],
  [
    'assisted-reconciliation:read',
    ['Conciliação assistida: read'],
    'Conciliação assistida: consultar',
    'Conciliação assistida: read',
  ],
  [
    'assisted-reconciliation:generate',
    ['Conciliação assistida: generate'],
    'Conciliação assistida: gerar',
    'Conciliação assistida: generate',
  ],
  [
    'assisted-reconciliation:review',
    ['Conciliação assistida: review'],
    'Conciliação assistida: revisar',
    'Conciliação assistida: review',
  ],
  [
    'contracts:read',
    ['Gestão contratual: read'],
    'Gestão contratual: consultar',
    'Gestão contratual: read',
  ],
  [
    'contracts:edit',
    ['Gestão contratual: edit'],
    'Gestão contratual: editar',
    'Gestão contratual: edit',
  ],
  [
    'contracts:amend',
    ['Gestão contratual: amend'],
    'Gestão contratual: aditar',
    'Gestão contratual: amend',
  ],
  [
    'contracts:archive',
    ['Gestão contratual: archive'],
    'Gestão contratual: arquivar',
    'Gestão contratual: archive',
  ],
  [
    'commercial-indicators:read',
    ['Gestão contratual: read'],
    'Indicadores comerciais: consultar',
    'Gestão contratual: read',
  ],
  [
    'budgets:read',
    ['Orçamentos: read'],
    'Orçamentos: consultar',
    'Orçamentos: read',
  ],
  [
    'budgets:edit',
    ['Orçamentos: edit'],
    'Orçamentos: editar',
    'Orçamentos: edit',
  ],
  [
    'budgets:configure-prices',
    ['Orçamentos: configure-prices'],
    'Orçamentos: configurar preços',
    'Orçamentos: configure-prices',
  ],
  [
    'budgets:approve',
    ['Orçamentos: approve'],
    'Orçamentos: aprovar',
    'Orçamentos: approve',
  ],
  [
    'receivables:read',
    ['Financeiro: read'],
    'Financeiro: consultar',
    'Financeiro: read',
  ],
  [
    'receivables:edit',
    ['Financeiro: edit'],
    'Financeiro: editar',
    'Financeiro: edit',
  ],
  [
    'receivables:receive',
    ['Financeiro: receive'],
    'Financeiro: registrar recebimento',
    'Financeiro: receive',
  ],
  [
    'receivables:reverse',
    ['Financeiro: reverse'],
    'Financeiro: estornar',
    'Financeiro: reverse',
  ],
  [
    'cash-flow:read',
    ['Financeiro: read'],
    'Financeiro: consultar',
    'Financeiro: read',
  ],
  [
    'finance:export',
    ['Financeiro: export'],
    'Financeiro: exportar',
    'Financeiro: export',
  ],
  [
    'dre:read',
    ['DRE gerencial: read'],
    'DRE gerencial: consultar',
    'DRE gerencial: read',
  ],
  [
    'dre:configure',
    ['DRE gerencial: configure'],
    'DRE gerencial: configurar',
    'DRE gerencial: configure',
  ],
  [
    'dre:classify',
    ['DRE gerencial: classify'],
    'DRE gerencial: classificar',
    'DRE gerencial: classify',
  ],
  [
    'dre:adjust',
    ['DRE gerencial: adjust'],
    'DRE gerencial: ajustar',
    'DRE gerencial: adjust',
  ],
  [
    'dre:periods',
    ['DRE gerencial: periods'],
    'DRE gerencial: competências',
    'DRE gerencial: periods',
  ],
  [
    'dre:export',
    ['DRE gerencial: export'],
    'DRE gerencial: exportar',
    'DRE gerencial: export',
  ],
  [
    'budgets:export',
    ['Documentos profissionais: budgets:export'],
    'Documentos profissionais: exportar orçamento',
    'Documentos profissionais: budgets:export',
  ],
  [
    'documents:templates',
    ['Documentos profissionais: documents:templates'],
    'Documentos profissionais: gerenciar modelos',
    'Documentos profissionais: documents:templates',
  ],
  [
    'technical-reports:read',
    ['Laudos técnicos: read', 'Laudos tecnicos: read'],
    'Laudos técnicos: consultar',
    'Laudos técnicos: read',
  ],
  [
    'technical-reports:edit',
    ['Laudos técnicos: edit', 'Laudos tecnicos: edit'],
    'Laudos técnicos: editar',
    'Laudos técnicos: edit',
  ],
  [
    'technical-reports:templates',
    ['Laudos técnicos: templates', 'Laudos tecnicos: templates'],
    'Laudos técnicos: modelos',
    'Laudos técnicos: templates',
  ],
  [
    'technical-reports:approve',
    ['Laudos técnicos: approve', 'Laudos tecnicos: approve'],
    'Laudos técnicos: aprovar',
    'Laudos técnicos: approve',
  ],
  [
    'technical-reports:export',
    ['Laudos técnicos: export', 'Laudos tecnicos: export'],
    'Laudos técnicos: exportar',
    'Laudos técnicos: export',
  ],
];

export class PermissionDescriptionsPtBr1795700000001 implements MigrationInterface {
  name = 'PermissionDescriptionsPtBr1795700000001';

  async up(q: QueryRunner): Promise<void> {
    for (const [key, from, to] of PERMISSION_DESCRIPTIONS_PT_BR) {
      const placeholders = from.map(() => '?').join(', ');
      await q.query(
        'UPDATE permissions SET description = ? WHERE `key` = ? AND description IN (' +
          placeholders +
          ')',
        [to, key, ...from],
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const [key, , to, restore] of PERMISSION_DESCRIPTIONS_PT_BR)
      await q.query(
        'UPDATE permissions SET description = ? WHERE `key` = ? AND description = ?',
        [restore, key, to],
      );
  }
}
