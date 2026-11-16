import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from './error-code.enum';

export class FieldErrorDto {
  @ApiProperty({ example: 'cnpj' })
  field!: string;

  @ApiProperty({ example: 'CNPJ com dígitos verificadores inválidos.' })
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ enum: ErrorCode, example: ErrorCode.VALIDATION_ERROR })
  code!: ErrorCode;

  @ApiProperty({
    example: 'Dados inválidos.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiPropertyOptional({
    oneOf: [
      { type: 'array', items: { type: 'object' } },
      { type: 'object', additionalProperties: true },
    ],
  })
  details?: FieldErrorDto[] | Record<string, unknown>;
}
