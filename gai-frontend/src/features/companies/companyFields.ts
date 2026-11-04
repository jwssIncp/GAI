export const companySections = [
  { title: 'Dados da empresa', description: 'Identificação e inscrições empresariais.', fields: [
    ['name', 'Nome da empresa', 255], ['corporate_name', 'Razão social', 255],
    ['document', 'CNPJ', 18], ['state_registration', 'Inscrição estadual', 50],
    ['municipal_registration', 'Inscrição municipal', 50],
  ] },
  { title: 'Contato', description: 'Canais para falar com a empresa.', fields: [
    ['email', 'E-mail', 255], ['phone', 'Telefone', 20],
  ] },
  { title: 'Endereço', description: 'Consulte o CEP ou preencha o endereço manualmente.', fields: [
    ['country', 'País', 80], ['zipcode', 'CEP', 20], ['address', 'Logradouro', 255],
    ['number', 'Número', 50], ['complement', 'Complemento', 255],
    ['district', 'Bairro', 120], ['city', 'Cidade', 120], ['state', 'Estado', 50],
  ] },
] as const;

export type CompanyField = typeof companySections[number]['fields'][number][0];
export const companyFieldNames = companySections.flatMap((section) => section.fields.map(([name]) => name));
export const companyStatusLabels = { active: 'Ativa', inactive: 'Desativada', blocked: 'Bloqueada' };

export function normalizeCnpj(value: string) {
  return value.trim().toUpperCase().replace(/[./\s-]/g, '');
}

export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += (cnpj.charCodeAt(i) - 48) * (2 + ((length - 1 - i) % 8));
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function maskCnpj(value: string) {
  return normalizeCnpj(value).replace(/^(.{2})(.)/, '$1.$2').replace(/^(.{6})(.)/, '$1.$2')
    .replace(/^(.{10})(.)/, '$1/$2').replace(/^(.{15})(.)/, '$1-$2');
}

export function maskZipcode(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

export function companyListReturn(search: string) {
  return `/app/companies${search}`;
}
