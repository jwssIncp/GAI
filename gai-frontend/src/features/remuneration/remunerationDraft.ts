import {
  computeRemuneration,
  daysInclusive,
  normalizeMoney,
  type RemunerationInput,
} from "./remunerationApi";

export type Draft = {
  field_agent_id: string;
  state: string;
  start_date: string;
  end_date: string;
  expected_payment_date: string;
  daily_rate: string;
  additional_amount: string;
  total_manual: boolean;
  total_amount: string;
  discount_amount: string;
  notes: string;
};

/** Valida tudo no cliente e devolve o payload; nada é enviado com campo faltando. */
export function validateDraft(draft: Draft): { payload?: RemunerationInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!draft.field_agent_id) errors.field_agent_id = "Escolha um inventariante vinculado ao projeto.";
  if (!draft.start_date) errors.start_date = "Informe a data inicial.";
  if (!draft.end_date) errors.end_date = "Informe a data final.";
  if (draft.start_date && draft.end_date && draft.end_date < draft.start_date)
    errors.end_date = "A data final não pode ser anterior à inicial.";
  if (!draft.expected_payment_date) errors.expected_payment_date = "Informe a data prevista de pagamento.";
  else if (draft.start_date && draft.expected_payment_date < draft.start_date)
    errors.expected_payment_date = "A data prevista não pode ser anterior à data inicial.";
  const rate = normalizeMoney(draft.daily_rate);
  const additional = normalizeMoney(draft.additional_amount);
  const discount = normalizeMoney(draft.discount_amount);
  const manual = draft.total_manual ? normalizeMoney(draft.total_amount) : null;
  if (!draft.daily_rate.trim() || rate === null) errors.daily_rate = "Informe a diária (ex.: 185,00).";
  if (additional === null) errors.additional_amount = "Valor inválido.";
  if (discount === null) errors.discount_amount = "Valor inválido.";
  if (draft.total_manual && (!draft.total_amount.trim() || manual === null))
    errors.total_amount = "Informe o total manual.";
  if (Object.keys(errors).length) return { errors };
  const result = computeRemuneration({
    days: daysInclusive(draft.start_date, draft.end_date),
    dailyRate: rate!,
    additional: additional!,
    discount: discount!,
    manualTotal: manual,
  });
  if (result.negative) return { errors: { discount_amount: "Os descontos não podem ser maiores que o total." } };
  return {
    errors,
    payload: {
      field_agent_id: Number(draft.field_agent_id),
      state: draft.state || null,
      start_date: draft.start_date,
      end_date: draft.end_date,
      expected_payment_date: draft.expected_payment_date,
      daily_rate: rate!,
      additional_amount: additional!,
      total_manual: draft.total_manual,
      total_amount: draft.total_manual ? manual : null,
      discount_amount: discount!,
      notes: draft.notes.trim() || null,
    },
  };
}
