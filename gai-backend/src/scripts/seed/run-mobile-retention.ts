import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../../data-source';
import { mobileRetention } from './mobile-retention';

config();

// Operator-triggered (e.g. scheduled task); dry-run unless --apply.
async function run(): Promise<void> {
  await dataSource.initialize();
  const report = await mobileRetention(dataSource, {
    apply: process.argv.includes('--apply'),
  });
  await dataSource.destroy();
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
