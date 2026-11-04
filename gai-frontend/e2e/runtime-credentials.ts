// Authentication credentials are supplied by the execution environment only.
export function runtimePassword(login = 'org.admin'): string {
  const key = login === 'test.user'
    ? 'SEED_TEST_USER_PASSWORD'
    : login === 'org.admin' && process.env.SEED_ORG_ADMIN_PASSWORD
      ? 'SEED_ORG_ADMIN_PASSWORD'
      : 'SEED_ADMIN_PASSWORD';
  const value = process.env[key];
  if (!value) throw new Error(`Missing browser authentication credential: ${key}`);
  return value;
}

export function configureBrowserCredentials(): void {
  runtimePassword('platform.admin');
  runtimePassword('org.admin');
  runtimePassword('test.user');
  process.env.GAI_TEST_BROWSER_FIXTURES = '1';
}
