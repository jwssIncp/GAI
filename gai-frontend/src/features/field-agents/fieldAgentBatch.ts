import type { FieldAgentFinancialUsage } from "@/types/api";

/** Aviso antes de excluir: quantos lançamentos ficam ligados aos cadastros excluídos. */
export function batchDescription(count: number, usage: FieldAgentFinancialUsage[]) {
  const withEntries = usage.filter((item) => item.payments + item.expenses > 0);
  const base = `Excluir ${count} inventariante(s)? A exclusão é lógica: o cadastro pode ser restaurado e o histórico é preservado.`;
  if (!withEntries.length) return `${base} Nenhum deles tem diárias ou despesas lançadas.`;
  const detail = withEntries
    .map(
      (item) =>
        `${item.name}: ${item.payments} diária(s) e ${item.expenses} despesa(s)`,
    )
    .join("; ");
  return `${base} Atenção: ${withEntries.length} deles têm lançamentos, que continuam nos projetos (${detail}).`;
}
