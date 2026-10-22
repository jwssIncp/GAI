import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../../data-source';

config();

function assertSafeMysqlIdent(value: string, label: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error(`${label} must be alphanumeric/underscore only`);
  }
  return value;
}

/**
 * Creates/updates a limited MySQL user for DBeaver (homolog palliative).
 * Uses master DB_* credentials. Operator password from Parameter Store (release task).
 */
async function ensureDbOperator(): Promise<void> {
  const rawUser = process.env.DB_OPERATOR_USERNAME;
  const password = process.env.DB_OPERATOR_PASSWORD;
  const database = assertSafeMysqlIdent(
    process.env.DB_DATABASE ?? 'gai',
    'DB_DATABASE',
  );

  if (!rawUser || !password) {
    console.log('DB_OPERATOR_* not set, skipping DB operator user');
    return;
  }

  const username = assertSafeMysqlIdent(rawUser, 'DB_OPERATOR_USERNAME');

  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();

  try {
    const countRows = (await qr.query(
      `SELECT COUNT(*) AS n FROM mysql.user WHERE User = ? AND Host = '%'`,
      [username],
    )) as Array<{ n: number | string }>;
    const exists = Number(countRows[0]?.n ?? 0) > 0;
    const escapedPassword = password.replace(/'/g, "''");

    if (!exists) {
      await qr.query(
        `CREATE USER '${username}'@'%' IDENTIFIED BY '${escapedPassword}'`,
      );
      console.log(`Created MySQL operator user ${username}`);
    } else {
      await qr.query(
        `ALTER USER '${username}'@'%' IDENTIFIED BY '${escapedPassword}'`,
      );
      console.log(`Updated password for MySQL operator user ${username}`);
    }

    await qr.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE, SHOW VIEW ON \`${database}\`.* TO '${username}'@'%'`,
    );
    await qr.query('FLUSH PRIVILEGES');
    console.log(`Granted DML on ${database}.* to ${username}`);
  } finally {
    await qr.release();
    await dataSource.destroy();
  }
}

ensureDbOperator().catch((error) => {
  console.error(error);
  process.exit(1);
});
