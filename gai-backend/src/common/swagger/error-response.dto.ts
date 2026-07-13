import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from './error-code.enum';

export class FieldErrorDto {
  @ApiProperty({ example: 'cnpj' })
  field!: string;

  @ApiProperty({ example: 'Invalid CNPJ check digits' })
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ enum: ErrorCode, example: ErrorCode.VALIDATION_ERROR })
  code!: ErrorCode;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiPropertyOptional({
    oneOf: [
      { type: 'array', items: { type: 'object' } },
      { type: 'object', additionalProperties: true },
    ],
  })
  details?: FieldErrorDto[] | Record<string, unknown>;
}
