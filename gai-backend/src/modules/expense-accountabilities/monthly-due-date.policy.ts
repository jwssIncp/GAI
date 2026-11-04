import { BadRequestException } from '@nestjs/common';
// Always derive from the original date, never from a previously clamped month.
export function monthlyDueDate(origin: Date, offset: number): Date {
  const year = origin.getUTCFullYear();
  const month = origin.getUTCMonth();
  const day = origin.getUTCDate();
  const targetYear = year + Math.floor((month + offset) / 12);
  if (
    !Number.isFinite(origin.getTime()) ||
    !Number.isInteger(offset) ||
    year < 1000 ||
    targetYear < 1000 ||
    targetYear > 9999
  )
    throw new BadRequestException(
      'Installment date is outside the supported civil range',
    );
  const lastOrigin = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lastTarget = new Date(
    Date.UTC(year, month + offset + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month + offset,
      day === lastOrigin ? lastTarget : Math.min(day, lastTarget),
    ),
  );
}
