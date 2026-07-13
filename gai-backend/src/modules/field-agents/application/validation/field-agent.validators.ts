import { Transform } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';
import {
  isValidBrazilianDocument,
  isValidBrazilianPhone,
  normalizeBrazilianDocument,
  normalizeBrazilianPhone,
} from '../../domain/validation/brazilian-contact';

export const NormalizeOptionalEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || null : value,
  );

export const NormalizeOptionalDocument = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed ? normalizeBrazilianDocument(trimmed) : null;
  });

export const NormalizeOptionalPhone = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed ? normalizeBrazilianPhone(trimmed) : null;
  });

export function IsBrazilianDocument(options?: ValidationOptions) {
  return (target: object, propertyName: string): void => {
    registerDecorator({
      name: 'isBrazilianDocument',
      target: target.constructor,
      propertyName,
      options: { message: 'CPF ou CNPJ inválido', ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidBrazilianDocument(value),
      },
    });
  };
}

export function IsBrazilianPhone(options?: ValidationOptions) {
  return (target: object, propertyName: string): void => {
    registerDecorator({
      name: 'isBrazilianPhone',
      target: target.constructor,
      propertyName,
      options: { message: 'Telefone brasileiro inválido', ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidBrazilianPhone(value),
      },
    });
  };
}
