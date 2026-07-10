import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  SessionRecord,
  SessionRepository,
} from '../../domain/ports/session.repository.port';
import { SessionEntity } from './session.entity';

@Injectable()
export class TypeOrmSessionRepository implements SessionRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly repo: Repository<SessionEntity>,
  ) {}

  async create(session: SessionRecord): Promise<SessionRecord> {
    const saved = await this.repo.save(session);
    return saved;
  }

  async findById(id: string): Promise<SessionRecord | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findActiveById(id: string, now: Date): Promise<SessionRecord | null> {
    return this.repo.findOne({
      where: {
        id,
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });
  }

  async revoke(sessionId: string, revokedAt: Date): Promise<void> {
    await this.repo.update({ id: sessionId }, { revokedAt });
  }

  async revokeAllForUser(userId: number, revokedAt: Date): Promise<number> {
    const result = await this.repo.update(
      { userId, revokedAt: IsNull(), expiresAt: MoreThan(revokedAt) },
      { revokedAt },
    );
    return result.affected ?? 0;
  }

  async revokeAllForOrganization(
    organizationId: number,
    revokedAt: Date,
  ): Promise<number> {
    const result = await this.repo.update(
      {
        organizationId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(revokedAt),
      },
      { revokedAt },
    );
    return result.affected ?? 0;
  }

  async touch(
    sessionId: string,
    lastActivityAt: Date,
    expiresAt: Date,
  ): Promise<void> {
    await this.repo.update({ id: sessionId }, { lastActivityAt, expiresAt });
  }
}
