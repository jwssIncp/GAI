import type { Definition, TaskDefinition } from "./fieldApi";

// "Check list - Campo" do sistema anterior (pendencias_campo.html): 4 seções numeradas e
// 23 sub atividades. Os nomes de pessoas do sistema anterior não são importados; o
// responsável de cada tarefa é definido no próprio projeto.
const SECTIONS: Array<[string, string, string[]]> = [
  [
    "project_coordination",
    "COORDENAÇÃO PROJETO",
    [
      "REUNIÃO KICK-OFF COM O CLIENTE",
      "E-MAIL AO CLIENTE DA ATA DE KICK-OFF",
      "CRIAR GRUPO WHATSAPP PROJETO",
    ],
  ],
  [
    "field_coordination",
    "COORDENAÇÃO CAMPO",
    [
      "PASSAR INFORMAÇÕES DO PROJETO PADRÃO VIA WHATSAPP",
      "MONITORAR ETIQUETAS E ENVIO AO COORDENADOR (ATENÇÃO AO PRAZO DOS CORREIOS)",
      "ENVIAR VERSÃO ATUALIZADA DO APLICATIVO / CRIAR PROJETO NO SISTEMA",
      "CONFIRMAR INÍCIO COM CLIENTE",
      "INFORMAR SEQUÊNCIA DE ETIQUETAS RECEBIDAS",
    ],
  ],
  [
    "field_team",
    "COORDENAÇÃO CAMPO - EQUIPE",
    [
      "CONTATO PADRÃO VIA WHATSAPP COM INVENTARIANTE",
      "SOLICITAR PREENCHIMENTO DA FICHA CADASTRAL E SALVAR NO DIRETÓRIO PÚBLICO",
      "PROVIDENCIAR DOCUMENTOS DE SEGURANÇA DO TRABALHO",
      "ENVIAR UNIFORME / CRACHÁ / CELULARES / LEITOR / COLA AO COORDENADOR (ATENÇÃO AO PRAZO)",
      "CADASTRAR PAGAMENTO",
    ],
  ],
  [
    "daily_priority",
    "PRIORIDADE DIÁRIA",
    [
      "VERIFICAR QUANTIDADE SINCRONIZADA",
      "PLACA ANTIGA: POSSUI DUPLICADA",
      "PLACA ANTIGA: TODAS AFIXADAS",
      "PLACA NOVA: FURO DE PLACA",
      "PLACA NOVA: DUPLICADA",
      "LOCALIZAÇÃO: PADRONIZADA",
      "NÚMERO DE SÉRIE: DUPLICADO E FOTO LEGÍVEL",
      "CENTRO DE CUSTO: PREENCHIMENTO",
      "DEVOLUÇÃO DAS PLACAS",
      "DESCRIÇÃO: PADRONIZADA (PODE SER AO FINAL)",
    ],
  ],
];

export const fieldReferenceName = "Check list - Campo — referência revisável";
export const fieldReferenceDescription =
  "4 seções e 23 sub atividades do check list de campo do sistema anterior.";

export function fieldReferenceDefinition(): Definition {
  const tasks: TaskDefinition[] = [];
  const groups = SECTIONS.map(([id, title, items], order) => {
    items.forEach((item, index) =>
      tasks.push({
        id: `${id}_${String(index + 1).padStart(2, "0")}`,
        group_id: id,
        title: item,
        order: tasks.length,
        required: true,
        allow_not_applicable: true,
        requires_responsible: false,
        requires_due_date: false,
        requires_notes: false,
        requires_approval: false,
        requires_issue_resolved: false,
      }),
    );
    return { id, title, order, required: true };
  });
  return { groups, tasks };
}
