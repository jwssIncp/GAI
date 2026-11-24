import type {
  EmailCondition,
  EmailLine,
  EmailTemplate,
  Scalar,
} from './preparationTypes';
import { ORGANIZATION_OPTION } from './preparationTypes';

// E-mail ao cliente do sistema anterior (15 tópicos + pendências), como texto do modelo da
// organização: cada empresa revisa e versiona os seus textos. Correções aplicadas:
// EPI "NÃO"/"N/A" → "Não será necessário EPI."; pendência de etiquetas só quando o fornecedor
// é a organização; linhas sem resposta são omitidas; prazo pela data da reunião.

const eq = (question_id: string, value: Scalar): EmailCondition => ({
  question_id,
  operator: 'equals',
  value,
});
const ne = (question_id: string, value: Scalar): EmailCondition => ({
  question_id,
  operator: 'not_equals',
  value,
});
const has = (question_id: string, value: Scalar[]): EmailCondition => ({
  question_id,
  operator: 'contains',
  value,
});
const missing = (question_id: string): EmailCondition => ({
  question_id,
  operator: 'not_answered',
});
const line = (text: string, ...when: EmailCondition[]): EmailLine =>
  when.length ? { text, when } : { text };

const hasOldLabels = ne('old-label-models', 0);
const supplied = (value: string) => eq('label-supplier', value);

export function kickoffEmail(): EmailTemplate {
  return {
    subject: 'Kick-off {client} — resumo do projeto',
    header: [
      {
        first: true,
        lines: [
          line('{q:project-contact.name}, {greeting}.'),
          line('Prezados, {greeting}.'),
        ],
      },
      {
        strong: true,
        lines: [
          line(
            'PARA NOSSO ACOMPANHAMENTO, SEGUE RESUMO DO PROJETO E FIQUEM À VONTADE PARA INSERIR OU ALTERAR ALGUMA INFORMAÇÃO:',
          ),
        ],
      },
    ],
    topics: [
      {
        title: 'Escopo',
        inline: true,
        empty: '—',
        lines: [
          line('{q:scope}'),
          line(
            '* Conciliação – Base contábil possui número das etiquetas.',
            has('scope', ['CONCILIAÇÃO']),
            eq('plate-match', 'SIM'),
          ),
          line(
            '* Conciliação – Base contábil não possui número das etiquetas.',
            has('scope', ['CONCILIAÇÃO']),
            eq('plate-match', 'NÃO'),
          ),
          line(
            '* Avaliação - {q:valuation-purpose}',
            has('scope', ['VIDA ÚTIL', 'VALOR JUSTO', 'IMPAIRMENT']),
            ne('valuation-purpose', 'N/A'),
          ),
        ],
      },
      {
        title: 'Quantidade Total',
        empty: '* — bens móveis',
        lines: [line('* {q:item-count} bens móveis')],
      },
      {
        title: 'Endereço Bens Móveis',
        empty: '•\t—',
        lines: [line('{addresses:unit-allocation}')],
      },
      {
        title: 'Data-Base',
        inline: true,
        empty: '—',
        lines: [line('{q:reference-date}')],
      },
      {
        title: 'Etiquetas patrimoniais autoadesivas',
        empty: '* —',
        lines: [
          line('* Não serão afixadas etiquetas.', supplied('N/A')),
          line('* Fornecidas pela {client}.', supplied('CLIENTE')),
          line(
            '* Fornecidas pela {organization}.',
            supplied(ORGANIZATION_OPTION),
          ),
          line(
            '* {q:label-quantity} unidades {q:label-model-other}.',
            eq('label-model', 'OUTROS'),
          ),
          line(
            '* {q:label-quantity} unidades {q:label-model}.',
            ne('label-model', 'OUTROS'),
          ),
          line('* {q:label-quantity} unidades.', missing('label-model')),
          line(
            '* Possuem etiquetas afixadas. Colar em ativos sem etiquetas com cola de junta de motor.',
            hasOldLabels,
          ),
          line('* Não possuem etiquetas afixadas.', eq('old-label-models', 0)),
          line(
            '* Retirar placas antigas.',
            hasOldLabels,
            eq('remove-labels', 'SIM'),
          ),
          line(
            '* Manter placas antigas.',
            hasOldLabels,
            eq('remove-labels', 'NÃO'),
          ),
        ],
      },
      {
        title: 'Perfil dos bens',
        inline: true,
        empty: '—',
        lines: [
          line('{q:asset-profile}.'),
          line(
            '* Outros: {q:asset-profile-other}.',
            has('asset-profile', ['OUTROS']),
          ),
        ],
      },
      {
        first: true,
        lines: [
          line('Não possui veículos.', eq('vehicles', 'NÃO')),
          line('Possui veículos: "{notes:vehicles}"', eq('vehicles', 'SIM')),
          line('Possui veículos.', eq('vehicles', 'SIM')),
        ],
      },
      {
        first: true,
        lines: [
          line('EPI / integração: SIM ({notes:safety}).', eq('safety', 'SIM')),
          line('EPI / integração: SIM.', eq('safety', 'SIM')),
          line('Não será necessário EPI.', {
            question_id: 'safety',
            operator: 'in',
            value: ['NÃO', 'N/A'],
          }),
        ],
      },
      {
        title: 'Prazo final do projeto com laudo',
        inline: true,
        empty: '—',
        lines: [line('{q:project-deadline}')],
      },
      {
        title: 'Horário',
        inline: true,
        empty: '—',
        first: true,
        lines: [
          line(
            'COMERCIAL. 8:30 às 18h (1 hora de almoço + 30 minutos de lanche).',
            eq('field-hours', 'COMERCIAL'),
          ),
          line(
            'ESPECIAL. {q:field-hours-detail}.',
            eq('field-hours', 'ESPECIAL'),
          ),
          line('ESPECIAL.', eq('field-hours', 'ESPECIAL')),
        ],
      },
      {
        lines: [
          line(
            'É muito importante para a qualidade do trabalho que o profissional que irá acompanhar nosso técnico em campo tenha conhecimento sobre os ativos, acesso a lugares restritos e sobre a metodologia adotada com relação a inventário de bens por complemento ou agrupados.',
          ),
        ],
      },
      {
        lines: [
          line(
            'Verificar se há galpões ou depósitos com grande quantidade de itens desorganizados para que sejam ordenados de forma a viabilizar o inventário da equipe {organization}.',
          ),
        ],
      },
      {
        title: 'Focal',
        empty: '* FOCAL PROJETO: —',
        lines: [
          line('* FOCAL PROJETO: {q:project-contact}'),
          line('* FOCAL CAMPO: {q:field-contact}'),
        ],
      },
      {
        title: 'Despesas',
        inline: true,
        empty: '—',
        lines: [line('{q:travel-guidance}')],
      },
      {
        title: 'Cronograma previsto',
        inline: true,
        empty: '—',
        lines: [line('{q:field-period.start} A {q:field-period.end}')],
      },
    ],
    footer: [
      {
        lines: [
          line('Obrigado e qualquer dúvida estou à disposição.'),
          line('Att,'),
        ],
      },
    ],
    pending_title: 'SEGUEM PENDÊNCIAS PARA INICIARMOS:',
    pendings: [
      {
        text: 'Envio da base contábil atualizada para análise das conciliações – {deadline} - ({client})',
        unless_realized: 'accounting-base',
      },
      line(
        'Aguardando aquisição de etiquetas – {deadline} - ({client})',
        supplied('CLIENTE'),
      ),
      line(
        'Aguardando compra de {q:label-quantity} etiquetas "{organization}"',
        supplied(ORGANIZATION_OPTION),
      ),
      line(
        'Aguardando compra de etiquetas "{organization}"',
        supplied(ORGANIZATION_OPTION),
        missing('label-quantity'),
      ),
      line(
        'Política de reembolso de despesas – {deadline} - ({client})',
        eq('travel-guidance', 'CLIENTE'),
      ),
      line(
        'Documentação dos veículos – {deadline} - ({client})',
        eq('vehicles', 'SIM'),
      ),
      line('Envio dos nomes dos técnicos – {deadline} - ({organization})'),
    ],
  };
}
