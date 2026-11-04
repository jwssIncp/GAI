import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';
export const Trimmed = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
export const NormalizedIdentifier = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
export const IfProvided = () =>
  ValidateIf((_object, value: unknown) => value !== undefined);
export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,99}$/;
