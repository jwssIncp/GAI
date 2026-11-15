import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { indicatorsApi, indicatorsKeys, type BoardQuery, type SaleSimulationInput } from "./cashFlowBoardApi";

/** Consulta dos indicadores (com a simulação, quando houver): uma só para a barra, os cards e o painel. */
export function useCashFlowIndicators(query: BoardQuery, sim: SaleSimulationInput | null) {
  return useQuery({ queryKey: indicatorsKeys.get(query, sim), queryFn: () => indicatorsApi.get(query, sim), placeholderData: keepPreviousData });
}
