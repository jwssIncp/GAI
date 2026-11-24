/**
 * Classificação manual da sobra contábil ("Alterar status ▾" do sistema anterior).
 * As quatro fixas aparecem sempre no topo; o usuário também pode informar um texto livre.
 * Fica num campo próprio, separado do status de conciliação, e sobrevive a novas execuções.
 */
export const FIXED_SURPLUS_CLASSIFICATIONS = [
  'NPI - COMPLEMENTO',
  'NPI - SOFTWARE',
  'NPI - EDIFICAÇÕES E TERRENOS',
  'ABRIR NF',
] as const;

export const SURPLUS_CLASSIFICATION_MAX_LENGTH = 120;
