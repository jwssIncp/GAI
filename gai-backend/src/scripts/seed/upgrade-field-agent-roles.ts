import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../../data-source';
import { upgradeFieldAgentRoles } from './field-agent-roles-upgrade';

config();

// Operator-triggered only (not in release:prod). Dry-run unless --apply.
async function run(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await dataSource.initialize();
  const roles = await upgradeFieldAgentRoles(dataSource, apply);
  await dataSource.destroy();
  console.log(JSON.stringify({ apply, roles }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
