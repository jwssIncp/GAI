export class PaymentStateConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = PaymentStateConflict.name;
  }
}
