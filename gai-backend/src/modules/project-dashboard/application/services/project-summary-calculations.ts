export function calculateProgressPercentage(
  evaluatedItems: number,
  totalItems: number,
): number {
  if (totalItems === 0) {
    return 0;
  }
  return Number(((evaluatedItems / totalItems) * 100).toFixed(2));
}

export function sumMoney(...values: string[]): string {
  return values
    .reduce((total, value) => total + Number(value || 0), 0)
    .toFixed(2);
}
