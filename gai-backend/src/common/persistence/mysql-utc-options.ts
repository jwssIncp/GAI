import * as mysql from 'mysql2';
import type { PoolOptions } from 'mysql2';

// Use the supported TypeORM connector option, keeping mysql2's public API.
// mysql2 queues this statement before handing a new connection to its borrower.
const utcConnector = {
  ...mysql,
  createPool(options: PoolOptions) {
    const pool = mysql.createPool(options);
    pool.on('connection', (connection) => {
      connection.query("SET SESSION time_zone = '+00:00'", (error) => {
        if (error) connection.destroy();
      });
    });
    return pool;
  },
};

export const MYSQL_UTC_OPTIONS = {
  connectorPackage: 'mysql2' as const,
  driver: utcConnector,
  timezone: 'Z',
  dateStrings: ['DATE'],
};
