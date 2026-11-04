import { DataSource, EntityManager } from 'typeorm';

const sqliteQueues = new WeakMap<DataSource, Promise<void>>();
/** SQLite has one connection; overlapping transactions otherwise become nested
 * savepoints. MySQL continues to use real independent transactions and row locks. */
export async function identityTransaction<T>(
  db: DataSource,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  if (db.options.type !== 'sqlite') return db.transaction(work);
  const previous = sqliteQueues.get(db) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  sqliteQueues.set(db, current);
  await previous;
  try {
    return await db.transaction(work);
  } finally {
    release();
    if (sqliteQueues.get(db) === current) sqliteQueues.delete(db);
  }
}
