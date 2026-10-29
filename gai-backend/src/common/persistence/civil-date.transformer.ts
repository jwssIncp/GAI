import { BadRequestException } from '@nestjs/common';
import type { ValueTransformer } from 'typeorm';
import { isCivilDate } from '../validation/civil-date';

// TypeORM formats Date values for DATE columns with local getters before the
// mysql2 driver sees them. Supply the civil string first, avoiding a day shift.
export const CIVIL_DATE_TRANSFORMER: ValueTransformer = {
  to(value: unknown) {
    if (value === null || value === undefined) return value;
    const day =
      value instanceof Date && Number.isFinite(value.getTime())
        ? value.toISOString().slice(0, 10)
        : value;
    if (!isCivilDate(day))
      throw new BadRequestException('Invalid civil date column value');
    return day;
  },
  // Do not reinterpret or rewrite existing civil values on read.
  from(value: unknown) {
    return value;
  },
};
