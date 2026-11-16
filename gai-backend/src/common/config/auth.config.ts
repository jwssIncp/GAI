import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  invitationTtlHours: parseInt(process.env.INVITATION_TTL_HOURS ?? '48', 10),
  temporaryPasswordTtlHours: parseInt(
    process.env.TEMPORARY_PASSWORD_TTL_HOURS ?? '24',
    10,
  ),
  // Senha temporária emitida para inventariante (rotas de field-agents).
  // Vazio, 0 ou inválido = sem expiração; a troca no 1º acesso continua.
  fieldAgentTemporaryPasswordTtlHours: Math.max(
    0,
    parseInt(process.env.FIELD_AGENT_TEMPORARY_PASSWORD_TTL_HOURS || '0', 10) ||
      0,
  ),
  // Tamanho da senha temporária gerada (limitado à política de Password).
  fieldAgentTemporaryPasswordLength: parseInt(
    process.env.FIELD_AGENT_TEMPORARY_PASSWORD_LENGTH || '12',
    10,
  ),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS ?? '8', 10),
  // Mobile: short non-sliding access sessions, rotating refresh tokens bounded
  // by an idle window and an absolute session lifetime.
  mobileAccessTtlMinutes: parseInt(
    process.env.MOBILE_ACCESS_TTL_MINUTES ?? '15',
    10,
  ),
  mobileRefreshIdleDays: parseInt(
    process.env.MOBILE_REFRESH_IDLE_DAYS ?? '14',
    10,
  ),
  mobileSessionMaxDays: parseInt(
    process.env.MOBILE_SESSION_MAX_DAYS ?? '30',
    10,
  ),
  mobileRefreshReuseGraceSeconds: parseInt(
    process.env.MOBILE_REFRESH_REUSE_GRACE_SECONDS ?? '30',
    10,
  ),
  lockoutMaxAttempts: parseInt(process.env.LOCKOUT_MAX_ATTEMPTS ?? '5', 10),
  lockoutDurationMinutes: parseInt(
    process.env.LOCKOUT_DURATION_MINUTES ?? '30',
    10,
  ),
  passwordResetTtlHours: parseInt(
    process.env.PASSWORD_RESET_TTL_HOURS ?? '1',
    10,
  ),
  useMockEmail: process.env.USE_MOCK_EMAIL !== 'false',
  sesFromEmail: process.env.SES_FROM_EMAIL ?? 'noreply@example.com',
  awsRegion: process.env.AWS_REGION ?? 'us-east-1',
}));
