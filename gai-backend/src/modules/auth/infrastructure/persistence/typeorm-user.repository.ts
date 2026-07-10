import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user';
import { UserRepository } from '../../domain/ports/user.repository.port';
import { UserEntity } from './user.entity';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findById(id: number): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByLoginOrEmail(identifier: string): Promise<User | null> {
    const entity = await this.repo.findOne({
      where: [{ login: identifier }, { email: identifier }],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(user: User): Promise<User> {
    const props = user.toProps();

    if (props.id > 0) {
      const existing = await this.repo.findOne({ where: { id: props.id } });
      if (!existing) {
        throw new Error(`User ${props.id} not found`);
      }
      const entity = this.repo.merge(existing, {
        organizationId: props.organizationId,
        login: props.login,
        email: props.email,
        passwordHash: props.passwordHash,
        status: props.status,
        failedLoginAttempts: props.failedLoginAttempts,
        lockedUntil: props.lockedUntil,
        passwordChangedAt: props.passwordChangedAt,
        updatedAt: props.updatedAt,
      });
      const saved = await this.repo.save(entity);
      return this.toDomain(saved);
    }

    const entity = this.repo.create({
      organizationId: props.organizationId,
      login: props.login,
      email: props.email,
      passwordHash: props.passwordHash,
      status: props.status,
      failedLoginAttempts: props.failedLoginAttempts,
      lockedUntil: props.lockedUntil,
      passwordChangedAt: props.passwordChangedAt,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  private toDomain(entity: UserEntity): User {
    return new User({
      id: Number(entity.id),
      organizationId: entity.organizationId,
      login: entity.login,
      email: entity.email,
      passwordHash: entity.passwordHash,
      status: entity.status,
      failedLoginAttempts: entity.failedLoginAttempts,
      lockedUntil: entity.lockedUntil,
      passwordChangedAt: entity.passwordChangedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
