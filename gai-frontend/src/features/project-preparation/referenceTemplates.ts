import type {
  PreparationKind,
  PreparationQuestion,
  QuestionType,
  TemplatePayload,
} from './preparationTypes';
import { kindLabels } from './preparationTypes';
// Suggestions reconstructed from the audited HTMLs. No legacy identities,
// responses, credentials or automatic production seed are imported.
export function referenceTemplate(kind: PreparationKind): TemplatePayload {
  const questions: PreparationQuestion[] = [];
  const add = (
    id: string,
    label: string,
    type: QuestionType = 'long_text',
    category = 'Resumo do projeto',
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
  add('participants', 'Participantes da reunião');
  add('client-origin', 'Origem do cliente', 'text');
  add('objective', 'Objetivo do projeto');
  add('scope', 'Escopo e entregas');
  add(
    'prior-inventory',
    'Já foi realizado inventário anteriormente?',
    'boolean',
  );
  add(
    'prior-lessons',
    'Erros anteriores e laudo disponível',
    'long_text',
    undefined,
    {
      enabled_when: [
        { question_id: 'prior-inventory', operator: 'equals', value: true },
      ],
    },
  );
  add(
    'item-count',
    'Quantidade de itens e cobrança de itens adicionais',
    'number',
  );
  add(
    'unit-allocation',
    'Endereços, quantidades e participação por unidade',
    'unit_allocations',
  );
  add('valuation-purpose', 'Finalidade da avaliação');
  add('system', 'Sistema utilizado', 'text');
  add('cost-centers', 'Centros de custo');
  add('serial-number', 'Identificação por número de série', 'boolean');
  add('asset-profile', 'Perfil dos bens');
  add('vehicles', 'Veículos no escopo', 'boolean');
  add('reference-date', 'Data-base', 'date');
  add('accounting-base', 'Base contábil completa disponível', 'boolean');
  add('main-equipment', 'Principais equipamentos para vistoria');
  add('manufacturer-manuals', 'Manuais dos principais ativos');
  add('plate-match', 'Placa da base corresponde à física?', 'boolean');
  add('trial-balance', 'Conferência de balancete e saldo patrimonial');
  add('audited', 'A empresa é auditada?', 'boolean');
  add('audit-firm', 'Auditoria responsável', 'text', undefined, {
    enabled_when: [{ question_id: 'audited', operator: 'equals', value: true }],
  });
  add(
    'label-supplier',
    'Fornecedor de novas etiquetas',
    'select',
    'Etiquetas',
    { options: ['GAI', 'Cliente', 'Não aplicável'] },
  );
  const labelCondition = [
    {
      question_id: 'label-supplier',
      operator: 'not_equals' as const,
      value: 'Não aplicável',
    },
  ];
  add(
    'label-quantity',
    'Quantidade de novas etiquetas',
    'number',
    'Etiquetas',
    { enabled_when: labelCondition },
  );
  add(
    'label-sequence',
    'Sequência de novas etiquetas',
    'sequence',
    'Etiquetas',
    { enabled_when: labelCondition, quantity_question_id: 'label-quantity' },
  );
  add('label-model', 'Modelo das novas etiquetas', 'text', 'Etiquetas', {
    enabled_when: labelCondition,
  });
  add(
    'old-label-models',
    'Quantidade de modelos de etiquetas antigas',
    'number',
    'Etiquetas',
    { enabled_when: labelCondition },
  );
  add(
    'old-label-sequences',
    'Sequências anteriores por modelo',
    'long_text',
    'Etiquetas',
    { enabled_when: labelCondition },
  );
  add(
    'remove-labels',
    'Etiquetas antigas serão retiradas?',
    'boolean',
    'Etiquetas',
    { enabled_when: labelCondition },
  );
  add(
    'safety',
    'EPI, integração e documentos de segurança',
    'long_text',
    'Operação',
  );
  add('project-deadline', 'Prazo do projeto', 'date', 'Operação');
  add('field-hours', 'Horário de campo', 'text', 'Operação');
  add(
    'travel-guidance',
    'Orientações de hospedagem, alimentação e transporte',
    'long_text',
    'Operação',
  );
  add('weekly-report', 'Reuniões de reporte semanal', 'long_text', 'Operação');
  add('project-contact', 'Focal do projeto e contato', 'text', 'Operação');
  add('field-contact', 'Focal de campo e contato', 'text', 'Operação');
  add(
    'escort',
    'Acompanhante com experiência nos ativos',
    'long_text',
    'Operação',
  );
  add('schedule', 'Cronograma', 'long_text', 'Operação');
  add('site-plan', 'Disponibilidade da planta do local', 'boolean', 'Operação');
  add(
    'additional-info',
    'Outras informações importantes',
    'long_text',
    'Operação',
  );
  if (kind === 'kickoff') {
    add('field-start', 'Início previsto de campo', 'date', 'Operação');
    add('field-end', 'Fim previsto de campo', 'date', 'Operação');
  }
  for (const [id, label] of [
    ['production-calendar', 'Calendário de produção'],
    ['shift-records', 'Registro de turnos'],
    ['utilization', 'Relatório de utilização das máquinas'],
    ['maintenance', 'Registros e plano de manutenção'],
    ['manuals', 'Manual do fabricante'],
    ['component-replacement', 'Troca recorrente de componentes relevantes'],
    ['componentization', 'Componentização de itens relevantes'],
  ])
    add(id, label, 'long_text', 'Vida útil');
  return {
    name: `${kindLabels[kind]} — referência revisável`,
    kind,
    questions,
  };
}
