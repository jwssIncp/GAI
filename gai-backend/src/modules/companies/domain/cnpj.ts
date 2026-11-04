/** Receita Federal: manual-dv-cnpj.pdf, ASCII - 48, módulo 11. */
export function normalizeCnpj(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[./\s-]/g, '');
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj))
    return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += (cnpj.charCodeAt(i) - 48) * (2 + ((length - 1 - i) % 8));
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}
