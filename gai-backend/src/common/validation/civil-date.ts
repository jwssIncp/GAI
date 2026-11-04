import { registerDecorator, ValidationOptions } from 'class-validator';

// Gregorian civil dates accepted by MySQL DATE. This predicate never parses a
// timestamp, normalizes overflow or depends on the Node/browser timezone.
export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1000 || year > 9999 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

export function IsCivilDate(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) =>
    registerDecorator({
      name: 'isCivilDate',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: {
        validate: isCivilDate,
        defaultMessage: () =>
          '$property must be a valid civil date YYYY-MM-DD (1000-01-01 to 9999-12-31)',
      },
    });
}
