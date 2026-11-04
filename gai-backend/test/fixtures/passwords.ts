// Synthetic fixtures for disposable test databases. Never reuse local seed values.
// Browser authentication receives its credentials exclusively from the runner.
const browserFixture = process.env.GAI_TEST_BROWSER_FIXTURES === '1';

function fixturePassword(key: string, synthetic: string): string {
  if (!browserFixture) return synthetic;
  const value = process.env[key];
  if (!value) throw new Error(`Missing browser fixture credential: ${key}`);
  return value;
}

export const fixturePasswords = {
  admin: fixturePassword(
    'SEED_ADMIN_PASSWORD',
    'Isolated administrator fixture 2026!',
  ),
  orgAdmin: fixturePassword(
    process.env.SEED_ORG_ADMIN_PASSWORD
      ? 'SEED_ORG_ADMIN_PASSWORD'
      : 'SEED_ADMIN_PASSWORD',
    'Isolated administrator fixture 2026!',
  ),
  user: fixturePassword(
    'SEED_TEST_USER_PASSWORD',
    'Isolated reader fixture 2026!',
  ),
};
