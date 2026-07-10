export const REDACTED_LOG_VALUE = '[Redacted]';

const SENSITIVE_FIELD_NAMES = [
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'password',
  'password_hash',
  'passwordHash',
  'current_password',
  'currentPassword',
  'new_password',
  'newPassword',
  'confirm_password',
  'confirmPassword',
  'token',
  'token_hash',
  'tokenHash',
  'session_token',
  'sessionToken',
  'reset_token',
  'resetToken',
  'password_reset_token',
  'passwordResetToken',
  'client_secret',
  'clientSecret',
  'api_key',
  'apiKey',
  'secret',
] as const;

function buildSensitiveLogPaths(): string[] {
  const paths = new Set<string>([
    'req.headers.authorization',
    'req.headers.Authorization',
    'req.headers.cookie',
    'req.headers.Cookie',
    'request.headers.authorization',
    'request.headers.Authorization',
    'request.headers.cookie',
    'request.headers.Cookie',
    'headers.authorization',
    'headers.Authorization',
    'headers.cookie',
    'headers.Cookie',
    'res.headers["set-cookie"]',
    'res.headers["Set-Cookie"]',
    'response.headers["set-cookie"]',
    'response.headers["Set-Cookie"]',
    'headers["set-cookie"]',
    'headers["Set-Cookie"]',
    '["set-cookie"]',
    '["Set-Cookie"]',
    'error.request.body',
    'error.req.body',
    'err.request.body',
    'err.req.body',
    'exception.request.body',
    'exception.req.body',
  ]);

  for (const field of SENSITIVE_FIELD_NAMES) {
    paths.add(field);
    paths.add(`*.${field}`);
    paths.add(`*.*.${field}`);
    paths.add(`*.*.*.${field}`);
  }

  return [...paths];
}

export const SENSITIVE_LOG_REDACTION = {
  paths: buildSensitiveLogPaths(),
  censor: REDACTED_LOG_VALUE,
  remove: false,
};
