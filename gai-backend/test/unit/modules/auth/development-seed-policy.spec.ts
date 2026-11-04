import {
  assertDevelopmentSeedEnvironment,
  developmentSeedPassword,
} from '../../../../src/scripts/seed/development-seed-policy';
describe('Development seed isolation', () => {
  it.each([
    { NODE_ENV: 'production', DB_HOST: 'localhost' },
    { NODE_ENV: 'local', DB_HOST: 'remote.example' },
    {},
  ])('rejects unsafe destination %j', (env) =>
    expect(() => assertDevelopmentSeedEnvironment(env)).toThrow(),
  );
  it('permits an explicitly local destination', () =>
    expect(() =>
      assertDevelopmentSeedEnvironment({
        NODE_ENV: 'local',
        DB_HOST: '127.0.0.1',
      }),
    ).not.toThrow());
  it('requires explicit, policy-compliant credentials for missing accounts', () => {
    expect(() => developmentSeedPassword({}, 'TEST_SEED_PASSWORD')).toThrow();
    expect(() =>
      developmentSeedPassword(
        { TEST_SEED_PASSWORD: 'short' },
        'TEST_SEED_PASSWORD',
      ),
    ).toThrow();
    expect(
      developmentSeedPassword(
        { TEST_SEED_PASSWORD: 'A synthetic long passphrase' },
        'TEST_SEED_PASSWORD',
      ),
    ).toBe('A synthetic long passphrase');
  });
});
