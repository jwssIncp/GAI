import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthAuditEntry,
  AuthAuditRepository,
} from '../../domain/ports/auth-audit.repository.port';
import { AuthAuditLogEntity } from './auth-audit-log.entity';

@Injectable()
export class TypeOrmAuthAuditRepository implements AuthAuditRepository {
  constructor(
    @InjectRepository(AuthAuditLogEntity)
    private readonly repo: Repository<AuthAuditLogEntity>,
  ) {}

  async save(entry: AuthAuditEntry): Promise<void> {
    await this.repo.save({
      userId: entry.userId,
      operation: entry.operation,
      ipAddress: entry.ipAddress,
      result: entry.result,
      metadata: entry.metadata ?? null,
    });
  }
}
