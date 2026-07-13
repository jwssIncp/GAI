const REPEATED_DIGITS = /^(\d)\1+$/;
const PHONE_INPUT = /^\+?[\d\s()-]+$/;

export function normalizeBrazilianDocument(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidBrazilianDocument(value: string): boolean {
  const digits = normalizeBrazilianDocument(value);
  if (REPEATED_DIGITS.test(digits)) return false;
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function normalizeBrazilianPhone(value: string): string {
  const trimmed = value.trim();
  if (!PHONE_INPUT.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits.startsWith('55') &&
    (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;
}

export function isValidBrazilianPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!PHONE_INPUT.test(trimmed)) return false;
  const digits = normalizeBrazilianPhone(trimmed);
  return /^(?!0{2})\d{2}[1-9]\d{7,8}$/.test(digits);
}

function isValidCpf(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }
  const first = (sum * 10) % 11;
  if ((first === 10 ? 0 : first) !== Number(digits[9])) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(digits[index]) * (11 - index);
  }
  const second = (sum * 10) % 11;
  return (second === 10 ? 0 : second) === Number(digits[10]);
}

function isValidCnpj(digits: string): boolean {
  const calculate = (length: number): number => {
    let weight = length - 7;
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * weight--;
      if (weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13])
  );
}
