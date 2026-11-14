/**
 * Evento financeiro derivado de um módulo de origem (placas, comissões, ...),
 * no formato que o fluxo de caixa e o reconhecimento da DRE vão consumir na
 * etapa 7. Nada aqui é gravado: é calculado a partir do registro de origem,
 * então editar a origem nunca deixa um evento "órfão" (bug do INVESTOR).
 */
export interface FinancialEvent {
  /** Chave estável da origem, ex.: "asset_tag_order:12:cost". */
  key: string;
  source: 'asset_tag_order' | 'commission';
  source_id: number;
  project_id: number;
  direction: 'inflow' | 'outflow';
  /** Data civil (AAAA-MM-DD) usada no fluxo: realizada se houver, senão a prevista. */
  date: string;
  /** true = pago/recebido (data real); false = previsto. */
  realized: boolean;
  /** Valor em reais com duas casas ("123.45"). */
  amount: string;
  /** Linha da DRE onde o evento será reconhecido (doc 06 §5.3 e §6.3). */
  dre_line: 'tags' | 'commercial_commission';
  description: string;
}
