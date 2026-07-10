const useIntegerIds =
  process.env.NODE_ENV === 'test' || process.env.DB_TYPE === 'sqlite';

export const PRIMARY_KEY_COLUMN = useIntegerIds
  ? { type: 'integer' as const }
  : { type: 'bigint' as const, unsigned: true as const };

export const FOREIGN_KEY_COLUMN = useIntegerIds
  ? { type: 'integer' as const }
  : { type: 'bigint' as const, unsigned: true as const };
