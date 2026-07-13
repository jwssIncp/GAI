const repeatedDigits = /^(\d)\1+$/;

export function normalizeDocument(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidDocument(value: string) {
  const digits = normalizeDocument(value);
  if (repeatedDigits.test(digits)) return false;
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
}

export function isValidPhone(value: string) {
  if (!/^\+?[\d\s()-]+$/.test(value.trim())) return false;
  return /^(?!0{2})\d{2}[1-9]\d{7,8}$/.test(normalizePhone(value));
}

export function maskDocument(value: string) {
  const digits = normalizeDocument(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value: string) {
  const digits = normalizePhone(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function isValidCpf(digits: string) {
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(digits[9]) && digit(10) === Number(digits[10]);
}

function isValidCnpj(digits: string) {
  const digit = (length: number) => {
    let weight = length - 7;
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * weight--;
      if (weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(digits[12]) && digit(13) === Number(digits[13]);
}
