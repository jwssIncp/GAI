export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol(
  'PASSWORD_RESET_TOKEN_REPOSITORY',
);

export interface PasswordResetTokenRecord {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetTokenRepository {
  create(token: PasswordResetTokenRecord): Promise<PasswordResetTokenRecord>;
  findValidByHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null>;
  markUsed(id: number, usedAt: Date): Promise<void>;
  invalidateAllForUser(userId: number): Promise<void>;
}
