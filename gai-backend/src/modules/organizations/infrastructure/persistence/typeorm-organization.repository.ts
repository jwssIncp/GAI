import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../domain/entities/organization';
import { OrganizationStatus } from '../../domain/enums/organization-status.enum';
import {
  ListOrganizationsParams,
  OrganizationAuditEntry,
  OrganizationRepository,
} from '../../domain/ports/organization.repository.port';
import { Cnpj } from '../../domain/value-objects/cnpj';
import { OrganizationAuditLogEntity } from './organization-audit-log.entity';
import { OrganizationEntity } from './organization.entity';

@Injectable()
export class TypeOrmOrganizationRepository implements OrganizationRepository {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationAuditLogEntity)
    private readonly auditRepo: Repository<OrganizationAuditLogEntity>,
  ) {}

  async save(organization: Organization): Promise<Organization> {
    const entity = this.toEntity(organization);
    const saved = await this.orgRepo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: number): Promise<Organization | null> {
    const entity = await this.orgRepo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCnpj(cnpj: string): Promise<Organization | null> {
    const entity = await this.orgRepo.findOne({ where: { cnpj } });
    return entity ? this.toDomain(entity) : null;
  }

  async list(params: ListOrganizationsParams): Promise<{
    items: Organization[];
    total: number;
  }> {
    const qb = this.orgRepo.createQueryBuilder('org');

    if (params.status) {
      qb.andWhere('org.status = :status', { status: params.status });
    }

    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(org.legalName) LIKE :term OR LOWER(org.tradeName) LIKE :term OR org.cnpj LIKE :termRaw)',
        { term, termRaw: `%${params.search.replace(/\D/g, '')}%` },
      );
    }

    qb.orderBy('org.createdAt', 'DESC');
    qb.skip((params.page - 1) * params.pageSize);
    qb.take(params.pageSize);

    const [entities, total] = await qb.getManyAndCount();
    return {
      items: entities.map((e) => this.toDomain(e)),
      total,
    };
  }

  async saveWithAudit(
    organization: Organization,
    audit: OrganizationAuditEntry,
  ): Promise<Organization> {
    return this.orgRepo.manager.transaction(async (manager) => {
      const orgRepository = manager.getRepository(OrganizationEntity);
      const auditRepository = manager.getRepository(OrganizationAuditLogEntity);

      const entity = this.toEntity(organization);
      const saved = await orgRepository.save(entity);

      await auditRepository.save({
        organizationId: audit.organizationId || saved.id,
        operation: audit.operation,
        performedBy: audit.performedBy,
        changes: audit.changes,
      });

      return this.toDomain(saved);
    });
  }

  private toEntity(org: Organization): OrganizationEntity {
    const props = org.toProps();
    const entity = this.orgRepo.create({
      legalName: props.legalName,
      tradeName: props.tradeName,
      cnpj: props.cnpj.getValue(),
      contactEmail: props.contactEmail,
      contactPhone: props.contactPhone,
      status: props.status,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
    if (props.id > 0) {
      entity.id = props.id;
    }
    return entity;
  }

  private toDomain(entity: OrganizationEntity): Organization {
    return new Organization({
      id: Number(entity.id),
      legalName: entity.legalName,
      tradeName: entity.tradeName,
      cnpj: Cnpj.fromPersisted(entity.cnpj),
      contactEmail: entity.contactEmail,
      contactPhone: entity.contactPhone,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
