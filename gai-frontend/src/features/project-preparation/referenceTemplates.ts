import type {
  Condition,
  PreparationKind,
  PreparationQuestion,
  QuestionType,
  TemplatePayload,
} from './preparationTypes';
import { kindLabels, ORGANIZATION_OPTION } from './preparationTypes';

// Perguntas, grupos e opções do kick-off do sistema anterior (kickoff.html).
// Não importa identidades, respostas, credenciais nem cria semente automática em produção.

const YES_NO = ['SIM', 'NÃO'];
const YES_NO_NA = ['SIM', 'NÃO', 'N/A'];
const REQUESTED = ['N/A', 'SOLICITADO'];

/**
 * Marcação "Solicitar no kick-off" do sistema anterior (aparece em azul na coluna Grupo).
 * O modelo não tem um campo próprio para isso, então vale para os IDs do modelo de referência.
 */
export const requestAtKickoff = new Set([
  'trial-balance',
  'old-label-sequences',
  'weekly-report',
  'field-contact',
  'site-plan',
]);

/** Complementos exibidos na linha do item-pai ("QUAIS ERROS…", "QUAL SISTEMA?", ...). */
const inlineFollowUps = new Set([
  'prior-lessons',
  'asset-profile-other',
  'system-name',
  'plate-match-percent',
  'audit-firm',
  'label-model-other',
  'field-hours-detail',
]);

/** Grupo de cada atividade da seção VIDA ÚTIL, como na coluna "Grupo" do sistema anterior. */
export const questionGroupTags: Record<string, string> = {
  'production-calendar': 'TURNOS',
  'shift-records': 'TURNOS',
  utilization: 'TURNOS',
  maintenance: 'MANUTENÇÃO',
  manuals: 'VUE',
  'component-replacement': 'VUE',
  componentization: 'VUE',
};

export function referenceTemplate(kind: PreparationKind): TemplatePayload {
  const questions: PreparationQuestion[] = [];
  let category = 'RESUMO PROJETO';
  const add = (
    id: string,
    label: string,
    type: QuestionType = 'long_text',
    extra: Partial<PreparationQuestion> = {},
  ) => {
    questions.push({
      id,
      label,
      type,
      category,
      order: questions.length,
      required: false,
      visible: true,
      allow_not_applicable: true,
      ...extra,
    });
  };
  const select = (
    id: string,
    label: string,
    options: string[],
    extra: Partial<PreparationQuestion> = {},
  ) => add(id, label, 'select', { options, ...extra });
  const when = (question_id: string, value: string): Condition[] => [
    { question_id, operator: 'equals', value },
  ];

  // Sem resposta, como no sistema anterior: só "Realizado" e observações.
  add('participants', 'APRESENTAÇÃO PARTICIPANTES CALL', 'none');
  select('client-origin', 'ORIGEM CLIENTE', [
    'CURSO',
    'INBOUND',
    'OUTBOUND',
    'INDICAÇÃO',
    'RECORRENTE',
    'OUTROS',
  ]);
  select('objective', 'OBJETIVO DO PROJETO', [
    'CONTÁBIL',
    'GERENCIAL',
    'REGULATÓRIO',
    'OUTROS',
  ]);
  add('scope', 'ESCOPO', 'multi_select', {
    prefill: 'contract.scope',
    options: [
      'VISTORIA',
      'INVENTÁRIO',
      'CONCILIAÇÃO',
      'VIDA ÚTIL',
      'VALOR JUSTO',
      'IMPAIRMENT',
    ],
  });
  select('prior-inventory', 'JÁ FOI REALIZADO ANTERIORMENTE?', YES_NO);
  add('prior-lessons', 'QUAIS ERROS OCORRERAM? LAUDO ANTERIOR?', 'long_text', {
    enabled_when: when('prior-inventory', 'SIM'),
  });
  // Pré-preenchidos a partir do contrato e das unidades do projeto (sem sobrescrever).
  add('item-count', 'QUANTIDADE DE ITENS. COBRANÇA ITEM ADICIONAL.', 'number', {
    prefill: 'contract.estimated_assets',
  });
  add('unit-allocation', 'ENDEREÇOS', 'unit_allocations', {
    prefill: 'project.units',
  });
  select('valuation-purpose', 'AVALIAÇÃO - FINALIDADE', [
    'CONTÁBIL',
    'GERENCIAL',
    'SEGUROS',
    'N/A',
  ]);
  select('system', 'SISTEMA UTILIZADO', ['NÃO INFORMADO', 'OUTRO']);
  add('system-name', 'QUAL SISTEMA?', 'text', {
    enabled_when: when('system', 'OUTRO'),
  });
  select('cost-centers', 'CENTROS DE CUSTO', ['SIM', 'N/A']);
  select('serial-number', 'Nº SÉRIE', ['SIM', 'N/A']);
  add('asset-profile', 'PERFIL DOS BENS', 'multi_select', {
    options: [
      'MÁQUINAS E EQUIPAMENTOS',
      'MÓVEIS E UTENSÍLIOS',
      'EQUIPAMENTOS DE INFORMÁTICA',
      'VEÍCULOS',
      'FERRAMENTAS',
      'OUTROS',
    ],
  });
  // OUTROS exige dizer quais (correção do sistema anterior, que usava uma caixa de diálogo).
  add('asset-profile-other', 'QUAIS OUTROS BENS?', 'text', {
    required: true,
    enabled_when: [
      { question_id: 'asset-profile', operator: 'contains', value: 'OUTROS' },
    ],
  });
  select('vehicles', 'VEÍCULOS', YES_NO);
  add('reference-date', 'DATA-BASE', 'date');
  select('accounting-base', 'BASE CONTÁBIL COMPLETA', [
    'POSSUI',
    'NÃO POSSUI',
    'N/A',
  ]);
  select(
    'main-equipment',
    'QUAIS OS PRINCIPAIS EQUIPAMENTOS PARA VISTORIA?',
    ['N/A', 'PENDENTE'],
  );
  // Excluído da lista no sistema anterior; fica no modelo, oculto, para quem quiser reativar.
  select(
    'manufacturer-manuals',
    'QUAIS OS MANUAIS DE FABRICANTE DOS PRINCIPAIS ATIVOS?',
    ['N/A', 'PENDENTE'],
    { visible: false },
  );
  select('plate-match', 'A PLACA NA BASE CONVERSA COM A FÍSICA?', YES_NO_NA);
  add('plate-match-percent', 'QUANTIDADE ESTIMADA (%)', 'number', {
    enabled_when: when('plate-match', 'SIM'),
  });
  select(
    'trial-balance',
    'BALANCETE. O SALDO É O MESMO DO PATRIMONIAL?',
    YES_NO_NA,
  );
  select('audited', 'SÃO AUDITADOS?', YES_NO);
  add('audit-firm', 'POR QUAL?', 'text', {
    enabled_when: when('audited', 'SIM'),
  });

  category = 'ETIQUETAS';
  // A opção da organização mostra o nome da empresa dona do projeto (ex.: INVESTOR).
  select('label-supplier', 'ETIQUETAS NOVAS - FORNECEDOR', [
    ORGANIZATION_OPTION,
    'CLIENTE',
    'N/A',
  ]);
  // Como no sistema anterior: só o fornecedor "N/A" bloqueia os itens das etiquetas.
  const anyLabels: Condition[] = [
    { question_id: 'label-supplier', operator: 'not_equals', value: 'N/A' },
  ];
  add('label-quantity', 'ETIQUETAS NOVAS - QUANTIDADE', 'number', {
    enabled_when: anyLabels,
  });
  add('label-sequence', 'ETIQUETAS NOVAS - SEQUÊNCIA', 'sequence', {
    enabled_when: anyLabels,
    quantity_question_id: 'label-quantity',
  });
  select(
    'label-model',
    'ETIQUETAS NOVAS - MODELO',
    ['AÇO', 'ALUMÍNIO', 'POLICARBONATO', 'OUTROS'],
    { enabled_when: anyLabels },
  );
  add('label-model-other', 'QUAL MODELO?', 'text', {
    enabled_when: when('label-model', 'OUTROS'),
  });
  add(
    'old-label-models',
    'ETIQUETAS ANTIGAS - QUANTIDADE DE MODELOS',
    'number',
    { enabled_when: anyLabels },
  );
  // Uma sequência por modelo informado acima (contador − / +).
  add(
    'old-label-sequences',
    'ETIQUETAS ANTIGAS - SEQUÊNCIAS ANTERIORES',
    'sequence_list',
    { enabled_when: anyLabels, quantity_question_id: 'old-label-models' },
  );
  select('remove-labels', 'SERÃO RETIRADAS?', YES_NO_NA, {
    enabled_when: anyLabels,
  });

  category = 'RESUMO PROJETO';
  select(
    'safety',
    'EPI / INTEGRAÇÃO / DOC SEGURANÇA DO TRABALHO',
    YES_NO_NA,
  );
  if (kind === 'kickoff') {
    add('field-period', 'PRAZO CAMPO', 'date_range');
  }
  add('project-deadline', 'PRAZO PROJETO', 'date');
  select('field-hours', 'HORÁRIO CAMPO', ['COMERCIAL', 'ESPECIAL']);
  add('field-hours-detail', 'QUAL HORÁRIO?', 'schedule', {
    enabled_when: when('field-hours', 'ESPECIAL'),
  });
  select(
    'travel-guidance',
    'DESPESAS HOSPEDAGEM, ALIMENTAÇÃO, TRANSLADO, TRANSPORTE',
    [ORGANIZATION_OPTION, 'CLIENTE', 'N/A'],
    { prefill: 'contract.expenses_paid_by' },
  );
  select('weekly-report', 'REUNIÕES DE REPORTE SEMANAL', YES_NO_NA);
  add('project-contact', 'FOCAL PROJETO', 'contact');
  add('field-contact', 'FOCAL CAMPO', 'contact');
  select('escort', 'ACOMPANHANTE COM EXPERIÊNCIA EM ATIVOS', YES_NO);
  // Excluído da lista no sistema anterior.
  add('schedule', 'CRONOGRAMA', 'long_text', { visible: false });
  select('site-plan', 'PLANTA DO LOCAL', ['N/A', 'SOLICITADO', 'RECEBIDO']);
  add('additional-info', 'OUTRAS INFORMAÇÕES IMPORTANTES');

  category = 'VIDA ÚTIL';
  for (const [id, label] of [
    ['production-calendar', 'CALENDÁRIO DE PRODUÇÃO'],
    ['shift-records', 'REGISTRO DE TURNOS'],
    ['utilization', 'RELATÓRIO DE UTILIZAÇÃO DAS MÁQUINAS'],
    ['maintenance', 'REGISTROS DE MANUTENÇÃO OU PLANO GERAL DE MANUTENÇÃO'],
    ['manuals', 'MANUAL DO FABRICANTE'],
    [
      'component-replacement',
      'HÁ TROCA RECORRENTE DE COMPONENTES DE ALTO VALOR AGREGADO?',
    ],
    ['componentization', 'COMPONENTIZAR ITENS RELEVANTES'],
  ])
    select(id, label, REQUESTED);

  return {
    name: `${kindLabels[kind]} — referência revisável`,
    kind,
    // Complementos que o sistema anterior mostra dentro da linha do item de que dependem.
    questions: questions.map((q) =>
      inlineFollowUps.has(q.id) ? { ...q, display: 'inline' as const } : q,
    ),
  };
}
