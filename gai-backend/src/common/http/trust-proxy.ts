import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Number of reverse-proxy hops in front of the API whose X-Forwarded-For
 * entries are trusted (counted from the socket). AWS: CloudFront -> ALB -> ECS
 * gives 2, and the ALB only accepts the CloudFront prefix list, so the hops are
 * authorized proxies. Unset/0 trusts nobody: req.ip is the socket address and
 * client-supplied X-Forwarded-For is ignored. Never use `true`: it would make
 * the left-most (client-controlled) entry the client IP.
 */
export function resolveTrustProxy(
  env: NodeJS.ProcessEnv = process.env,
): number | false {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (!raw) return false;
  const hops = Number(raw);
  if (!/^\d+$/.test(raw) || hops > 5)
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5');
  return hops === 0 ? false : hops;
}

export function applyTrustProxy(
  app: INestApplication,
  env: NodeJS.ProcessEnv = process.env,
): number | false {
  const trust = resolveTrustProxy(env);
  (app as NestExpressApplication).set('trust proxy', trust);
  return trust;
}

/** Global throttling window; overridable per environment. */
export function resolveThrottleDefaults(env: NodeJS.ProcessEnv = process.env): {
  ttl: number;
  limit: number;
} {
  const positive = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    ttl: positive(env.THROTTLE_TTL_MS, 60000),
    limit: positive(env.THROTTLE_LIMIT, 100),
  };
}
