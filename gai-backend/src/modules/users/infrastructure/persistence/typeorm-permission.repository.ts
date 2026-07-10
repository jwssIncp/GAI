import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PermissionScope } from '../../domain/enums/permission-scope.enum';
import {
  PermissionRecord,
  PermissionRepository,
} from '../../domain/ports/permission.repository.port';
import { PermissionEntity } from './permission.entity';

@Injectable()
export class TypeOrmPermissionRepository implements PermissionRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repo: Repository<PermissionEntity>,
  ) {}

  async findAll(scope?: PermissionScope): Promise<PermissionRecord[]> {
    const where = scope ? { scope } : {};
    const entities = await this.repo.find({
      where,
      order: { resource: 'ASC', action: 'ASC' },
    });
    return entities.map((entity) => this.toRecord(entity));
  }

  async findByIds(ids: number[]): Promise<PermissionRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const entities = await this.repo.find({ where: { id: In(ids) } });
    return entities.map((entity) => this.toRecord(entity));
  }

  async findByKeys(keys: string[]): Promise<PermissionRecord[]> {
    if (keys.length === 0) {
      return [];
    }
    const entities = await this.repo.find({ where: { key: In(keys) } });
    return entities.map((entity) => this.toRecord(entity));
  }

  private toRecord(entity: PermissionEntity): PermissionRecord {
    return {
      id: Number(entity.id),
      key: entity.key,
      resource: entity.resource,
      action: entity.action,
      scope: entity.scope,
      description: entity.description,
    };
  }
}
