import {
  isISO8601,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export function isExplicitInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    isISO8601(value, { strict: true, strictSeparator: true })
  );
}

export function IsExplicitInstant(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) =>
    registerDecorator({
      name: 'isExplicitInstant',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: {
        validate: isExplicitInstant,
        defaultMessage: () =>
          '$property must be a valid ISO timestamp with an explicit offset or Z',
      },
    });
}
