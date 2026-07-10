import { User } from '../entities/user';

export interface SessionRecord {
  id: string;
  userId: number;
  organizationId: number | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastActivityAt: Date;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface SessionRepository {
  create(session: SessionRecord): Promise<SessionRecord>;
  findById(id: string): Promise<SessionRecord | null>;
  revoke(sessionId: string, revokedAt: Date): Promise<void>;
  revokeAllForUser(userId: number, revokedAt: Date): Promise<number>;
  revokeAllForOrganization(
    organizationId: number,
    revokedAt: Date,
  ): Promise<number>;
  touch(
    sessionId: string,
    lastActivityAt: Date,
    expiresAt: Date,
  ): Promise<void>;
  findActiveById(id: string, now: Date): Promise<SessionRecord | null>;
}

export interface AuthenticatedUser {
  user: User;
  session: SessionRecord;
}
