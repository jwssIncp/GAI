// TLS for MySQL connections, controlled by DB_SSL:
// - unset/empty/"false": no TLS (local development and disposable test databases);
// - "amazon-rds": verify the server against the Amazon RDS CA bundle shipped with mysql2;
// - "true": verify the server against the system CA store.
// RDS for MySQL 8.4 users authenticate with caching_sha2_password; mysql2 supports it with or without TLS.
export type MysqlSslOption = { ssl?: string | { rejectUnauthorized: true } };

export function mysqlSslOptions(
  env: NodeJS.ProcessEnv = process.env,
): MysqlSslOption {
  const mode = (env.DB_SSL ?? '').trim().toLowerCase();
  if (mode === '' || mode === 'false') return {};
  if (mode === 'amazon-rds') return { ssl: 'Amazon RDS' };
  if (mode === 'true') return { ssl: { rejectUnauthorized: true } };
  throw new Error('DB_SSL must be empty, "false", "true" or "amazon-rds"');
}
