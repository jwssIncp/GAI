/**
 * Abas da DRE gerencial (caminho dentro de /app/finance/dre → rótulo). Fonte única:
 * a barra de abas (DreLayout), o título h1 de cada tela (FinanceLayout) e a trilha
 * (Topbar) usam os mesmos nomes.
 */
export const dreTabs: ReadonlyArray<readonly [path: string, label: string]> = [
  ['', 'DRE mensal'],
  ['statement', 'Demonstrativo'],
  ['entries', 'Classificações e ajustes'],
  ['accounts', 'Plano de contas'],
  ['periods', 'Competências'],
];

/** Rótulo da aba da DRE de um caminho (ex.: /app/finance/dre/entries/5 → "Classificações e ajustes"). */
export function dreTabLabel(pathname: string): string {
  const tab = pathname.split('/app/finance/dre')[1]?.split('/')[1] ?? '';
  return (dreTabs.find(([path]) => path === tab) ?? dreTabs[0])[1];
}
