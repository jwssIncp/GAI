import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { Logger } from 'pino';
import pinoHttp from 'pino-http';
import request from 'supertest';
import {
  REDACTED_LOG_VALUE,
  SENSITIVE_LOG_REDACTION,
} from '../../../src/common/logging/sensitive-log-redaction';

interface HttpLogRecord {
  operation?: string;
  msg?: string;
  body?: Record<string, unknown>;
  error?: {
    request?: {
      body?: Record<string, unknown> | string;
    };
  };
  access_token?: string;
  refresh_token?: string;
  session_token?: string;
  authorization?: string;
  Authorization?: string;
  cookie?: string;
  'set-cookie'?: string;
  'Set-Cookie'?: string;
  req?: {
    id?: unknown;
    method?: string;
    url?: string;
    headers?: Record<string, unknown>;
  };
  res?: {
    statusCode?: number;
    headers?: Record<string, unknown>;
  };
}

function createLoggingServer(output: string[]): Server {
  const stream = {
    write(message: string): void {
      output.push(message);
    },
  };
  const httpLogger = pinoHttp(
    {
      autoLogging: true,
      customProps: () => ({ service: 'gai-backend' }),
      redact: SENSITIVE_LOG_REDACTION,
    },
    stream,
  );

  return createServer((req, res) => {
    httpLogger(req, res);

    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      const body = rawBody
        ? (JSON.parse(rawBody) as Record<string, unknown>)
        : {};
      const requestLogger = (req as IncomingMessage & { log: Logger }).log;

      requestLogger.info({
        operation: 'TEST_AUTH_LOG',
        body,
        error: { request: { body } },
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        session_token: body.session_token,
        authorization: req.headers.authorization,
        Authorization: req.headers.authorization,
        cookie: req.headers.cookie,
        'set-cookie': 'manual-set-cookie-secret',
        'Set-Cookie': 'manual-uppercase-set-cookie-secret',
      });

      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.setHeader('set-cookie', 'sid=response-cookie-secret; HttpOnly');
      res.end('{"ok":true}');
    });
  });
}

function parseLogs(output: string[]): HttpLogRecord[] {
  return output
    .flatMap((chunk) => chunk.split('\n'))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HttpLogRecord);
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe('Pino sensitive log redaction', () => {
  let output: string[];
  let server: Server;

  beforeEach(async () => {
    output = [];
    server = createLoggingServer(output);
    await listen(server);
  });

  afterEach(async () => {
    await close(server);
  });

  it('redacts Authorization, Cookie and Set-Cookie while preserving request metadata', async () => {
    const meToken = 'me-bearer-token-must-not-leak';
    const logoutToken = 'logout-bearer-token-must-not-leak';
    const cookie = 'session-cookie-must-not-leak';
    const correlationId = 'correlation-id-kept-for-observability';

    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${meToken}`)
      .set('Cookie', `sid=${cookie}`)
      .set('X-Correlation-Id', correlationId)
      .expect(200);

    await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${logoutToken}`)
      .set('X-Correlation-Id', correlationId)
      .expect(200);

    const serialized = output.join('');
    expect(serialized).not.toContain(meToken);
    expect(serialized).not.toContain(logoutToken);
    expect(serialized).not.toContain(cookie);
    expect(serialized).not.toContain('response-cookie-secret');
    expect(serialized).not.toContain('manual-set-cookie-secret');
    expect(serialized).not.toContain('manual-uppercase-set-cookie-secret');
    expect(serialized).not.toContain('Bearer ');

    const records = parseLogs(output);
    const completed = records.filter(
      (record) => record.msg === 'request completed',
    );
    expect(completed).toHaveLength(2);
    expect(completed[0]?.req?.id).toBeDefined();
    expect(completed[0]?.req).toEqual(
      expect.objectContaining({
        method: 'GET',
        url: '/api/v1/auth/me',
      }),
    );
    expect(completed[0]?.req?.headers).toEqual(
      expect.objectContaining({
        authorization: REDACTED_LOG_VALUE,
        cookie: REDACTED_LOG_VALUE,
        'x-correlation-id': correlationId,
      }),
    );
    expect(completed[0]?.res).toEqual(
      expect.objectContaining({ statusCode: 200 }),
    );
    expect(completed[0]?.res?.headers?.['set-cookie']).toBe(REDACTED_LOG_VALUE);

    const authLog = records.find(
      (record) => record.operation === 'TEST_AUTH_LOG',
    );
    expect(authLog?.authorization).toBe(REDACTED_LOG_VALUE);
    expect(authLog?.Authorization).toBe(REDACTED_LOG_VALUE);
    expect(authLog?.cookie).toBe(REDACTED_LOG_VALUE);
    expect(authLog?.['set-cookie']).toBe(REDACTED_LOG_VALUE);
    expect(authLog?.['Set-Cookie']).toBe(REDACTED_LOG_VALUE);
  });

  it('redacts login passwords and returned auth tokens from structured logs', async () => {
    const password = 'LoginPassword@123';
    const confirmation = 'LoginConfirmation@123';
    const accessToken = 'login-access-token-must-not-leak';
    const refreshToken = 'login-refresh-token-must-not-leak';

    await request(server)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'platform.admin',
        password,
        credentials: { confirm_password: confirmation },
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .expect(200);

    const serialized = output.join('');
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(confirmation);
    expect(serialized).not.toContain(accessToken);
    expect(serialized).not.toContain(refreshToken);

    const authLog = parseLogs(output).find(
      (record) => record.operation === 'TEST_AUTH_LOG',
    );
    expect(authLog?.body?.password).toBe(REDACTED_LOG_VALUE);
    expect(
      (authLog?.body?.credentials as Record<string, unknown>)?.confirm_password,
    ).toBe(REDACTED_LOG_VALUE);
    expect(authLog?.access_token).toBe(REDACTED_LOG_VALUE);
    expect(authLog?.refresh_token).toBe(REDACTED_LOG_VALUE);
    expect(authLog?.error?.request?.body).toBe(REDACTED_LOG_VALUE);
  });

  it('redacts password recovery and session tokens', async () => {
    const token = 'password-reset-token-must-not-leak';
    const resetToken = 'reset-token-alias-must-not-leak';
    const newPassword = 'NewPassword@123';
    const currentPassword = 'CurrentPassword@123';
    const sessionToken = 'session-token-must-not-leak';

    await request(server)
      .post('/api/v1/auth/password-reset/confirm')
      .send({
        token,
        reset_token: resetToken,
        new_password: newPassword,
        current_password: currentPassword,
        session_token: sessionToken,
      })
      .expect(200);

    const serialized = output.join('');
    for (const secret of [
      token,
      resetToken,
      newPassword,
      currentPassword,
      sessionToken,
    ]) {
      expect(serialized).not.toContain(secret);
    }

    const authLog = parseLogs(output).find(
      (record) => record.operation === 'TEST_AUTH_LOG',
    );
    expect(authLog?.body).toEqual(
      expect.objectContaining({
        token: REDACTED_LOG_VALUE,
        reset_token: REDACTED_LOG_VALUE,
        new_password: REDACTED_LOG_VALUE,
        current_password: REDACTED_LOG_VALUE,
        session_token: REDACTED_LOG_VALUE,
      }),
    );
    expect(authLog?.session_token).toBe(REDACTED_LOG_VALUE);
  });
});
