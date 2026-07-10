import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  PasswordResetTokenRecord,
  PasswordResetTokenRepository,
} from '../../domain/ports/password-reset-token.repository.port';
import { PasswordResetTokenEntity } from './password-reset-token.entity';

@Injectable()
export class TypeOrmPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(
    @InjectRepository(PasswordResetTokenEntity)
    private readonly repo: Repository<PasswordResetTokenEntity>,
  ) {}

  async create(
    token: PasswordResetTokenRecord,
  ): Promise<PasswordResetTokenRecord> {
    return this.repo.save(token);
  }

  async findValidByHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null> {
    return this.repo.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
    });
  }

  async markUsed(id: number, usedAt: Date): Promise<void> {
    await this.repo.update({ id }, { usedAt });
  }

  async invalidateAllForUser(userId: number): Promise<void> {
    await this.repo.update(
      { userId, usedAt: IsNull() },
      { usedAt: new Date() },
    );
  }
}
