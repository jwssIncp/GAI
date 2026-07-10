import { BadRequestException } from '@nestjs/common';

export class Password {
  private static readonly MIN_LENGTH = 8;
  private static readonly POLICY =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  private constructor(private readonly value: string) {}

  static create(raw: string): Password {
    if (raw.length < Password.MIN_LENGTH) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters',
      });
    }

    if (!Password.POLICY.test(raw)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Password must include uppercase, lowercase, number and special character',
      });
    }

    return new Password(raw);
  }

  getValue(): string {
    return this.value;
  }
}
