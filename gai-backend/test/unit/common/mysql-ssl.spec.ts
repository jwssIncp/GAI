import { mysqlSslOptions } from '../../../src/common/persistence/mysql-ssl';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sslOptions } = require('../../../scripts/with-db-lock.cjs');

describe('MySQL TLS options (DB_SSL)', () => {
  const cases: Array<[string | undefined, unknown]> = [
    [undefined, {}],
    ['', {}],
    ['false', {}],
    ['amazon-rds', { ssl: 'Amazon RDS' }],
    [' Amazon-RDS ', { ssl: 'Amazon RDS' }],
    ['true', { ssl: { rejectUnauthorized: true } }],
  ];

  it.each(cases)('DB_SSL=%p', (value, expected) => {
    expect(mysqlSslOptions({ DB_SSL: value })).toEqual(expected);
    // The release lock script runs without dist/ and keeps its own copy of the rule.
    expect(sslOptions(value)).toEqual(expected);
  });

  it('rejects unknown values instead of silently disabling TLS', () => {
    expect(() => mysqlSslOptions({ DB_SSL: 'yes' })).toThrow('DB_SSL');
    expect(() => sslOptions('yes')).toThrow('DB_SSL');
  });
});
