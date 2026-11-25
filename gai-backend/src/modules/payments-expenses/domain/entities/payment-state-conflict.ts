export class PaymentStateConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = PaymentStateConflict.name;
  }
}

/** Período de diárias que cruza outro lançamento (não cancelado) do mesmo inventariante no projeto. */
export class PaymentPeriodOverlap extends PaymentStateConflict {
  constructor(
    readonly overlapping: { id: number; startDate: string; endDate: string },
  ) {
    const civil = (value: string) => value.split('-').reverse().join('/');
    super(
      `O período cruza outro lançamento deste inventariante no projeto (${civil(overlapping.startDate)} a ${civil(overlapping.endDate)}). Ajuste as datas para não pagar o mesmo dia duas vezes.`,
    );
    this.name = PaymentPeriodOverlap.name;
  }
}
