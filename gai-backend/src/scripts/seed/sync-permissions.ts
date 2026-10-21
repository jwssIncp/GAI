import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../../data-source';
import { seedPermissions } from './permissions.seed';

config();

async function syncPermissions(): Promise<void> {
  await dataSource.initialize();
  await seedPermissions(dataSource);
  await dataSource.destroy();
  console.log('Permission catalog synced');
}

syncPermissions().catch((error) => {
  console.error(error);
  process.exit(1);
});
