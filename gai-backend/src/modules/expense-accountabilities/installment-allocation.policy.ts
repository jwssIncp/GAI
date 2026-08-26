export class InstallmentAllocationPolicy {
  static allocate(amount: string, count: number): string[] {
    const total = Math.round(Number(amount) * 100);
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    return Array.from({ length: count }, (_, index) =>
      ((base + (index < remainder ? 1 : 0)) / 100).toFixed(2),
    );
  }
}
