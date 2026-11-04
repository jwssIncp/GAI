import { BadRequestException, ConflictException } from '@nestjs/common';
import { isCivilDate } from '../../../common/validation/civil-date';
import type { CreateAssetValuationDto } from './inventory-operation.dto';
export function valuationValues(dto: CreateAssetValuationDto) {
  const source = dto.source?.trim();
  const date = dto.valuation_date;
  if (!source || source.length > 255)
    throw new BadRequestException('Informe a fonte da avaliação.');
  if (!isCivilDate(date))
    throw new BadRequestException('Informe uma data civil válida YYYY-MM-DD.');
  for (const value of [dto.new_value, dto.used_value])
    if (
      value != null &&
      (typeof value !== 'string' || !/^\d{1,13}(\.\d{1,2})?$/.test(value))
    )
      throw new BadRequestException(
        'Valor monetário inválido. Use até 13 inteiros e dois decimais.',
      );
  if (dto.new_value == null && dto.used_value == null)
    throw new ConflictException({
      code: 'VALUATION_REQUIRES_VALUE',
      message: 'At least one value is required',
    });
  if (
    dto.notes != null &&
    (typeof dto.notes !== 'string' || dto.notes.length > 4000)
  )
    throw new BadRequestException('Observações inválidas.');
  return {
    source,
    newValue: dto.new_value ?? null,
    usedValue: dto.used_value ?? null,
    valuationDate: date,
    notes: dto.notes?.trim() || null,
  };
}
export function valuationBatchLimit(value: unknown): number {
  const max = Number(value ?? 100);
  if (!Number.isInteger(max) || max < 1 || max > 500)
    throw new Error(
      'BATCH_VALUATION_MAX_ITEMS must be an integer between 1 and 500',
    );
  return max;
}
