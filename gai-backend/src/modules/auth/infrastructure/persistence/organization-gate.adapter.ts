import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationStatus } from '../../../organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../../organizations/infrastructure/persistence/organization.entity';
import { OrganizationGate } from '../../domain/ports/organization-gate.port';

@Injectable()
export class OrganizationGateAdapter implements OrganizationGate {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
  ) {}

  async isActive(organizationId: number): Promise<boolean> {
    const org = await this.orgRepo.findOne({ where: { id: organizationId } });
    return org?.status === OrganizationStatus.ACTIVE;
  }
}
