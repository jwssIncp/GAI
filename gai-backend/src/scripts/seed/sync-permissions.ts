import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../../data-source';
import { seedPermissions } from './permissions.seed';

config();

async function syncPermissions(): Promise<void> {
  await dataSource.initialize();
  const created = await seedPermissions(dataSource);
  await dataSource.destroy();
  console.log(
    created.length
      ? `Catálogo de permissões: ${created.length} chave(s) criada(s): ${created.join(', ')}`
      : 'Catálogo de permissões: nada a criar (já sincronizado)',
  );
}

syncPermissions().catch((error) => {
  console.error(error);
  process.exit(1);
});
