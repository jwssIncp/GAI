import type { ContractEntity } from './contract.entity';
import { cents, money } from './contract.policy';

/** Resumo comercial de um projeto para a listagem (colunas do Painel Geral). */
export interface ProjectContractSummary {
  /** Contratos não cancelados do projeto. */
  count: number;
  /** Números dos contratos, na ordem de contratação. */
  numbers: string[];
  /** Data da primeira contratação conhecida (AAAA-MM-DD). */
  contracted_on: string | null;
  /** Segmentos distintos informados. */
  segments: string[];
  /** Moeda comum; nulo quando os contratos usam moedas diferentes. */
  currency: string | null;
  /** Soma do valor vigente (original + aditivos) dos contratos com valor, na moeda comum. */
  current_value: string | null;
  /** Contratos sem valor informado (ausência não é zero). */
  missing_value: number;
  /** Soma da estimativa de bens; nula quando nenhum contrato informa. */
  estimated_assets: number | null;
  /** Verdadeiro se algum contrato é recorrente; nulo se nenhum informa. */
  recurring: boolean | null;
  /** Serviços contratados, sem repetição. */
  services: string[];
}

export function contractSummaries(
  rows: Pick<ContractEntity, 'projectId' | 'number' | 'data'>[],
): Map<number, ProjectContractSummary> {
  const byProject = new Map<number, typeof rows>();
  for (const row of rows) {
    if (row.data.status === 'cancelled') continue;
    const list = byProject.get(Number(row.projectId)) ?? [];
    list.push(row);
    byProject.set(Number(row.projectId), list);
  }
  const result = new Map<number, ProjectContractSummary>();
  for (const [projectId, list] of byProject) {
    const sorted = [...list].sort((a, b) =>
      (a.data.contracted_on ?? '9999').localeCompare(
        b.data.contracted_on ?? '9999',
      ),
    );
    const currencies = [...new Set(sorted.map((r) => r.data.currency))];
    const currency = currencies.length === 1 ? currencies[0] : null;
    const valued = sorted.filter((r) => r.data.current_value != null);
    const assets = sorted.filter((r) => r.data.estimated_assets != null);
    const recurrence = sorted.filter((r) => r.data.recurring != null);
    result.set(projectId, {
      count: sorted.length,
      numbers: sorted.map((r) => r.number),
      contracted_on:
        sorted.find((r) => r.data.contracted_on)?.data.contracted_on ?? null,
      segments: [
        ...new Set(
          sorted.flatMap((r) => (r.data.segment ? [r.data.segment] : [])),
        ),
      ],
      currency,
      current_value:
        currency && valued.length
          ? money(valued.reduce((s, r) => s + cents(r.data.current_value!), 0n))
          : null,
      missing_value: sorted.length - valued.length,
      estimated_assets: assets.length
        ? assets.reduce((s, r) => s + Number(r.data.estimated_assets), 0)
        : null,
      recurring: recurrence.length
        ? recurrence.some((r) => r.data.recurring === true)
        : null,
      services: [...new Set(sorted.flatMap((r) => r.data.services ?? []))],
    });
  }
  return result;
}
