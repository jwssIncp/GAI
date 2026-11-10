import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import request from 'supertest';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import {
  applyTrustProxy,
  resolveThrottleDefaults,
  resolveTrustProxy,
} from '../../../src/common/http/trust-proxy';

@Controller('ping')
class PingController {
  @Get()
  ping(@Req() req: Request) {
    return { ip: req.ip };
  }
}

async function appWith(env: NodeJS.ProcessEnv): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 2 }])],
    controllers: [PingController],
    providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  applyTrustProxy(app, env);
  await app.init();
  return app;
}

describe('trusted proxy hops and per-client throttling', () => {
  it('validates TRUST_PROXY_HOPS strictly and never trusts every hop', () => {
    expect(resolveTrustProxy({})).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY_HOPS: '0' })).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY_HOPS: '2' })).toBe(2);
    for (const bad of ['true', '-1', '1.5', '6', 'loopback'])
      expect(() => resolveTrustProxy({ TRUST_PROXY_HOPS: bad })).toThrow();
    expect(resolveThrottleDefaults({})).toEqual({ ttl: 60000, limit: 100 });
    expect(
      resolveThrottleDefaults({ THROTTLE_LIMIT: '300', THROTTLE_TTL_MS: 'x' }),
    ).toEqual({ ttl: 60000, limit: 300 });
  });

  it('behind CloudFront+ALB limits each viewer individually and ignores spoofed left-most entries', async () => {
    const app = await appWith({ TRUST_PROXY_HOPS: '2' });
    const ping = (xff: string) =>
      request(app.getHttpServer()).get('/ping').set('X-Forwarded-For', xff);
    try {
      // "<viewer>, <cloudfront edge>" as appended by CloudFront and the ALB.
      await ping('198.51.100.7, 10.0.0.9')
        .expect(200)
        .expect((r) => expect(r.body.ip).toBe('198.51.100.7'));
      await ping('198.51.100.7, 10.0.0.9').expect(200);
      // A forged left-most value must not open a new bucket for the same viewer.
      await ping('203.0.113.1, 198.51.100.7, 10.0.0.9')
        .expect(429)
        .expect((r) => expect(r.body.code).toBe('TOO_MANY_REQUESTS'));
      // Another viewer has its own budget.
      await ping('198.51.100.8, 10.0.0.9')
        .expect(200)
        .expect((r) => expect(r.body.ip).toBe('198.51.100.8'));
    } finally {
      await app.close();
    }
  });

  it('without trusted hops ignores X-Forwarded-For entirely', async () => {
    const app = await appWith({});
    const ping = (xff: string) =>
      request(app.getHttpServer()).get('/ping').set('X-Forwarded-For', xff);
    try {
      await ping('198.51.100.1')
        .expect(200)
        .expect((r) => expect(r.body.ip).not.toBe('198.51.100.1'));
      await ping('198.51.100.2').expect(200);
      await ping('198.51.100.3').expect(429);
    } finally {
      await app.close();
    }
  });
});
