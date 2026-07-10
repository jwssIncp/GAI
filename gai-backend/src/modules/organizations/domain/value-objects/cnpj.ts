import { BadRequestException } from '@nestjs/common';

export class Cnpj {
  private constructor(private readonly value: string) {}

  static create(raw: string): Cnpj {
    const digits = raw.replace(/\D/g, '');

    if (digits.length !== 14) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'CNPJ must contain exactly 14 digits',
        details: [
          { field: 'cnpj', message: 'CNPJ must contain exactly 14 digits' },
        ],
      });
    }

    if (/^(\d)\1+$/.test(digits)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid CNPJ',
        details: [{ field: 'cnpj', message: 'Invalid CNPJ check digits' }],
      });
    }

    if (!Cnpj.isValidCheckDigits(digits)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid CNPJ',
        details: [{ field: 'cnpj', message: 'Invalid CNPJ check digits' }],
      });
    }

    return new Cnpj(digits);
  }

  static fromPersisted(digits: string): Cnpj {
    return new Cnpj(digits);
  }

  static isValid(raw: string): boolean {
    try {
      Cnpj.create(raw);
      return true;
    } catch {
      return false;
    }
  }

  private static isValidCheckDigits(digits: string): boolean {
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(digits[i], 10) * weights1[i];
    }
    const d1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (parseInt(digits[12], 10) !== d1) {
      return false;
    }

    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(digits[i], 10) * weights2[i];
    }
    const d2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return parseInt(digits[13], 10) === d2;
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Cnpj): boolean {
    return this.value === other.value;
  }
}
