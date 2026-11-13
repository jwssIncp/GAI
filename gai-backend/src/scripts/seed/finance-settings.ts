import 'reflect-metadata';
import { config } from 'dotenv';
import dataSource from '../../../data-source';
import {
  civilToday,
  defaultFinanceSettingsValues,
} from '../../modules/finance-settings/finance-settings.policy';

config();

/**
 * Cria a primeira versão dos parâmetros financeiros (valores padrão) para as
 * organizações que ainda não têm nenhuma. Não altera versões existentes.
 * Uso: npm run seed:finance-settings [-- --dry-run] [-- --valid-from=AAAA-MM-DD]
 */
async function seedFinanceSettings(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const validFrom =
    process.argv
      .find((arg) => arg.startsWith('--valid-from='))
      ?.split('=')[1] ?? civilToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom))
    throw new Error('--valid-from precisa estar no formato AAAA-MM-DD');
  await dataSource.initialize();
  try {
    const organizations = await dataSource.query<
      { id: string; name: string }[]
    >(
      'SELECT o.id, o.name FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM finance_settings_versions v WHERE v.organization_id = o.id) ORDER BY o.id',
    );
    for (const organization of organizations) {
      if (!dryRun)
        await dataSource.query(
          'INSERT INTO finance_settings_versions (organization_id, version, valid_from, `values`, reason, actor_id, recorded_at) VALUES (?, 1, ?, ?, ?, NULL, CURRENT_TIMESTAMP(3))',
          [
            organization.id,
            validFrom,
            JSON.stringify(defaultFinanceSettingsValues()),
            'Versão inicial com os valores padrão (seed)',
          ],
        );
      console.log(
        `${dryRun ? '[simulação] ' : ''}organização #${organization.id}: versão 1 a partir de ${validFrom}`,
      );
    }
    console.log(
      `${organizations.length} organização(ões) sem parâmetros ${dryRun ? 'seriam configuradas' : 'configuradas'}.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

seedFinanceSettings().catch((error) => {
  console.error(error);
  process.exit(1);
});
