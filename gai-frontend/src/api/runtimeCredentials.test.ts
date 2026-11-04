import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureBrowserCredentials, runtimePassword } from '../../e2e/runtime-credentials';

afterEach(() => vi.unstubAllEnvs());

describe('browser runtime credentials', () => {
  it('refuses authentication when the runner did not supply a credential', () => {
    vi.stubEnv('SEED_ADMIN_PASSWORD', '');
    vi.stubEnv('SEED_ORG_ADMIN_PASSWORD', '');
    expect(() => runtimePassword()).toThrow('Missing browser authentication credential: SEED_ADMIN_PASSWORD');
  });

  it('keeps platform, organization and reader credentials separate', () => {
    vi.stubEnv('SEED_ADMIN_PASSWORD', 'Synthetic platform runtime fixture!');
    vi.stubEnv('SEED_ORG_ADMIN_PASSWORD', 'Synthetic organization runtime fixture!');
    vi.stubEnv('SEED_TEST_USER_PASSWORD', 'Synthetic reader runtime fixture!');
    expect(runtimePassword('platform.admin')).toBe(process.env.SEED_ADMIN_PASSWORD);
    expect(runtimePassword('org.admin')).toBe(process.env.SEED_ORG_ADMIN_PASSWORD);
    expect(runtimePassword('test.user')).toBe(process.env.SEED_TEST_USER_PASSWORD);
  });

  it('configures disposable browser seeding only after credentials are present', () => {
    vi.stubEnv('SEED_ADMIN_PASSWORD', 'Synthetic platform runtime fixture!');
    vi.stubEnv('SEED_ORG_ADMIN_PASSWORD', '');
    vi.stubEnv('SEED_TEST_USER_PASSWORD', '');
    vi.stubEnv('GAI_TEST_BROWSER_FIXTURES', '');
    expect(() => configureBrowserCredentials()).toThrow('SEED_TEST_USER_PASSWORD');
    expect(process.env.GAI_TEST_BROWSER_FIXTURES).toBe('');
    vi.stubEnv('SEED_TEST_USER_PASSWORD', 'Synthetic reader runtime fixture!');
    configureBrowserCredentials();
    expect(process.env.GAI_TEST_BROWSER_FIXTURES).toBe('1');
  });
});
