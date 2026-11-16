import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

type Translator = (defaultMessage: string) => string | null;

const number = (message: string): string | null =>
  /(-?\d+(?:\.\d+)?)/.exec(message)?.[1] ?? null;

const numbers = (message: string): string[] =>
  message.match(/-?\d+(?:\.\d+)?/g) ?? [];

/**
 * Traduz as mensagens padrão do class-validator para pt-BR. Cada tradutor
 * só reconhece o texto padrão (em inglês) do seu decorator; quando o DTO
 * define uma mensagem própria, ela é mantida como está.
 */
const TRANSLATORS: Record<string, Translator> = {
  isString: (m) => (/must be a string$/.test(m) ? 'deve ser texto' : null),
  isInt: (m) =>
    /must be an integer number$/.test(m) ? 'deve ser um número inteiro' : null,
  isNumber: (m) =>
    /must be a number conforming/.test(m) ? 'deve ser um número' : null,
  isBoolean: (m) =>
    /must be a boolean value$/.test(m) ? 'deve ser verdadeiro ou falso' : null,
  isArray: (m) => (/must be an array$/.test(m) ? 'deve ser uma lista' : null),
  isObject: (m) => (/must be an object$/.test(m) ? 'deve ser um objeto' : null),
  isEmail: (m) =>
    /must be an email$/.test(m) ? 'deve ser um e-mail válido' : null,
  isNotEmpty: (m) =>
    /should not be empty$/.test(m) ? 'não pode ficar vazio' : null,
  isDefined: (m) =>
    /should not be null or undefined$/.test(m) ? 'é obrigatório' : null,
  isEnum: (m) => oneOf(m),
  isIn: (m) => oneOf(m),
  min: (m) =>
    /must not be less than/.test(m)
      ? `não pode ser menor que ${number(m.replace(/^.*less than/, ''))}`
      : null,
  max: (m) =>
    /must not be greater than/.test(m)
      ? `não pode ser maior que ${number(m.replace(/^.*greater than/, ''))}`
      : null,
  minLength: (m) =>
    /must be longer than or equal to \d+ characters$/.test(m)
      ? `deve ter pelo menos ${number(m.replace(/^.*equal to/, ''))} caracteres`
      : null,
  maxLength: (m) =>
    /must be shorter than or equal to \d+ characters$/.test(m)
      ? `deve ter no máximo ${number(m.replace(/^.*equal to/, ''))} caracteres`
      : null,
  isLength: (m) => {
    if (!/(longer|shorter) than or equal to \d+/.test(m)) return null;
    const [first, second] = numbers(m.replace(/^.*? must be /, ''));
    if (/longer than/.test(m) && /shorter than/.test(m))
      return `deve ter de ${first} a ${second} caracteres`;
    return /longer than/.test(m)
      ? `deve ter pelo menos ${first} caracteres`
      : `deve ter no máximo ${first} caracteres`;
  },
  matches: (m) =>
    /must match .* regular expression$/.test(m)
      ? 'está em formato inválido'
      : null,
  arrayMinSize: (m) =>
    /must contain at least \d+ elements$/.test(m)
      ? `deve ter pelo menos ${number(m.replace(/^.*at least/, ''))} item(ns)`
      : null,
  arrayMaxSize: (m) =>
    /must contain no more than \d+ elements$/.test(m)
      ? `deve ter no máximo ${number(m.replace(/^.*no more than/, ''))} item(ns)`
      : null,
  arrayUnique: (m) =>
    /elements must be unique$/.test(m) ? 'não pode ter itens repetidos' : null,
  equals: (m) =>
    /must be equal to /.test(m)
      ? `deve ser igual a ${m.replace(/^.*must be equal to /, '')}`
      : null,
  nestedValidation: (m) =>
    /must be either object or array$/.test(m)
      ? 'deve ser um objeto ou uma lista'
      : null,
  whitelistValidation: (m) =>
    /should not exist$/.test(m) ? 'campo não permitido' : null,
  isCivilDate: (m) =>
    /must be a valid civil date/.test(m)
      ? 'deve ser uma data válida no formato AAAA-MM-DD'
      : null,
  isExplicitInstant: (m) =>
    /must be a valid ISO timestamp/.test(m)
      ? 'deve ser data e hora no formato ISO com fuso (Z ou ±HH:MM)'
      : null,
};

function oneOf(message: string): string | null {
  const match = /must be one of the following values: (.*)$/.exec(message);
  if (match) return `deve ser um destes valores: ${match[1]}`;
  return /must be a valid enum value$/.test(message)
    ? 'deve ser um valor permitido'
    : null;
}

export function translateConstraint(
  property: string,
  constraint: string,
  message: string,
): string {
  const each = /^each value in /.test(message);
  const translated = TRANSLATORS[constraint]?.(message) ?? null;
  if (translated === null) return message;
  return `${property}: ${each ? `cada item ${translated}` : translated}`;
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    for (const [constraint, message] of Object.entries(
      error.constraints ?? {},
    )) {
      messages.push(translateConstraint(path, constraint, message));
    }
    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children, path));
    }
  }
  return messages;
}

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException(flattenValidationErrors(errors));
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    exceptionFactory: validationExceptionFactory,
  });
}
