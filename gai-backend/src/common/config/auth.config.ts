import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  invitationTtlHours: parseInt(process.env.INVITATION_TTL_HOURS ?? '48', 10),
  temporaryPasswordTtlHours: parseInt(
    process.env.TEMPORARY_PASSWORD_TTL_HOURS ?? '24',
    10,
  ),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS ?? '8', 10),
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
