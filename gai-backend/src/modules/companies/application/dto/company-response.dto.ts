import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JsonRecord } from '../../domain/entities/company';
import { CompanyStatus } from '../../domain/enums/company-status.enum';
import { CompanyUnitStatus } from '../../domain/enums/company-unit-status.enum';
import { CompanyEntity } from '../../infrastructure/persistence/company.entity';
import { CompanyUnitEntity } from '../../infrastructure/persistence/company-unit.entity';
import { ProjectUnitEntity } from '../../infrastructure/persistence/project-unit.entity';

export class CompanyResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  corporate_name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  document!: string | null;

  @ApiProperty({ enum: CompanyStatus })
  status!: CompanyStatus;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata!: JsonRecord | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  created_by_id!: number | null;

  @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
  updated_by_id!: number | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromEntity(entity: CompanyEntity): CompanyResponseDto {
    return {
      id: Number(entity.id),
      organization_id: Number(entity.organizationId),
      name: entity.name,
      corporate_name: entity.corporateName,
      document: entity.document,
      status: entity.status,
      metadata: entity.metadata,
      created_by_id:
        entity.createdById === null ? null : Number(entity.createdById),
      updated_by_id:
        entity.updatedById === null ? null : Number(entity.updatedById),
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
      deleted_at: entity.deletedAt?.toISOString() ?? null,
    };
  }
}

export class CompanyListResponseDto {
  @ApiProperty({ type: [CompanyResponseDto] })
  items!: CompanyResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  page_size!: number;

  @ApiProperty()
  total_items!: number;

  @ApiProperty()
  total_pages!: number;
}

export class CompanyUnitResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  company_id!: number;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiProperty({ enum: CompanyUnitStatus })
  status!: CompanyUnitStatus;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata!: JsonRecord | null;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromEntity(entity: CompanyUnitEntity): CompanyUnitResponseDto {
    return {
      id: Number(entity.id),
      organization_id: Number(entity.organizationId),
      company_id: Number(entity.companyId),
      name: entity.name,
      code: entity.code,
      status: entity.status,
      metadata: entity.metadata,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
      deleted_at: entity.deletedAt?.toISOString() ?? null,
    };
  }
}

export class CompanyUnitListResponseDto {
  @ApiProperty({ type: [CompanyUnitResponseDto] })
  items!: CompanyUnitResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  page_size!: number;

  @ApiProperty()
  total_items!: number;

  @ApiProperty()
  total_pages!: number;
}

export class ProjectUnitResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  project_id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  company_unit_id!: number;

  @ApiProperty({ type: CompanyUnitResponseDto })
  company_unit!: CompanyUnitResponseDto;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deleted_at!: string | null;

  static fromEntity(
    entity: ProjectUnitEntity,
    companyUnit: CompanyUnitEntity,
  ): ProjectUnitResponseDto {
    return {
      id: Number(entity.id),
      organization_id: Number(entity.organizationId),
      project_id: Number(entity.projectId),
      company_unit_id: Number(entity.companyUnitId),
      company_unit: CompanyUnitResponseDto.fromEntity(companyUnit),
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
      deleted_at: entity.deletedAt?.toISOString() ?? null,
    };
  }
}

export class ProjectUnitListResponseDto {
  @ApiProperty({ type: [ProjectUnitResponseDto] })
  items!: ProjectUnitResponseDto[];
}
