import { BadRequestException } from '@nestjs/common';
export class Password {
  static readonly MIN_LENGTH = 15;
  static readonly MAX_LENGTH = 128;
  private constructor(private readonly value: string) {}
  static create(raw: string): Password {
    if (
      typeof raw !== 'string' ||
      [...raw].length < this.MIN_LENGTH ||
      [...raw].length > this.MAX_LENGTH ||
      !raw.trim()
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'A senha deve ter de 15 a 128 caracteres. Você pode usar uma frase, espaços e colar do gerenciador de senhas.',
      });
    }
    return new Password(raw);
  }
  getValue(): string {
    return this.value;
  }
}
