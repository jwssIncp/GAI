import { DataSource, IsNull, LessThan, Not } from 'typeorm';
import { MobileRefreshTokenEntity } from '../../modules/auth/infrastructure/persistence/mobile-refresh-token.entity';
import { MobileIdempotencyKeyEntity } from '../../modules/mobile/mobile-idempotency-key.entity';

export interface MobileRetentionReport {
  apply: boolean;
  refresh_tokens: number;
  idempotency_keys: number;
  stale_idempotency_claims: number;
}

/**
 * Removes technical mobile rows that can no longer be used: refresh tokens of
 * families expired/revoked for more than `refreshDays`, idempotency keys older
 * than `keyDays`, and creation claims abandoned for more than one day. Audit
 * logs, sessions, items and expenses are never touched. Dry-run by default.
 */
export async function mobileRetention(
  db: DataSource,
  options: {
    apply: boolean;
    refreshDays?: number;
    keyDays?: number;
    now?: Date;
  },
): Promise<MobileRetentionReport> {
  const now = options.now ?? new Date();
  const days = (n: number) => new Date(now.getTime() - n * 86400000);
  const refreshCutoff = days(options.refreshDays ?? 30);
  const keyCutoff = days(options.keyDays ?? 90);
  const tokens = db.getRepository(MobileRefreshTokenEntity);
  const keys = db.getRepository(MobileIdempotencyKeyEntity);
  const tokenWhere = [
    { familyExpiresAt: LessThan(refreshCutoff) },
    { revokedAt: LessThan(refreshCutoff) },
  ];
  const keyWhere = {
    createdAt: LessThan(keyCutoff),
    resourceId: Not(IsNull()),
  };
  const claimWhere = { createdAt: LessThan(days(1)), resourceId: IsNull() };
  const report: MobileRetentionReport = {
    apply: options.apply,
    refresh_tokens: await tokens.count({ where: tokenWhere }),
    idempotency_keys: await keys.count({ where: keyWhere }),
    stale_idempotency_claims: await keys.count({ where: claimWhere }),
  };
  if (options.apply) {
    for (const where of tokenWhere) await tokens.delete(where);
    await keys.delete(keyWhere);
    await keys.delete(claimWhere);
  }
  return report;
}
