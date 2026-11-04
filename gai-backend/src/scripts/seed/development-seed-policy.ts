import { Password } from '../../modules/auth/domain/value-objects/password';
export function assertDevelopmentSeedEnvironment(env: NodeJS.ProcessEnv): void {
  if (
    !['local', 'development', 'test'].includes(env.NODE_ENV ?? '') ||
    !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST ?? '')
  ) {
    throw new Error(
      'Development bootstrap requires an explicit development environment and loopback database.',
    );
  }
}
export function developmentSeedPassword(
  env: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = env[name];
  if (!value)
    throw new Error(
      `Set ${name} explicitly to provision a missing development account.`,
    );
  return Password.create(value).getValue();
}
