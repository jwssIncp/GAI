import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Organization } from '../../domain/entities/organization';
import { OrganizationStatus } from '../../domain/enums/organization-status.enum';

export class OrganizationResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ example: 'Empresa Exemplo Ltda' })
  legal_name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Exemplo' })
  trade_name!: string | null;

  @ApiProperty({ pattern: '^\\d{14}$', example: '11222333000181' })
  cnpj!: string;

  @ApiPropertyOptional({ format: 'email', nullable: true })
  contact_email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  contact_phone!: string | null;

  @ApiProperty({ enum: OrganizationStatus })
  status!: OrganizationStatus;

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  static fromDomain(org: Organization): OrganizationResponseDto {
    return {
      id: org.id,
      legal_name: org.legalName,
      trade_name: org.tradeName,
      cnpj: org.cnpj.getValue(),
      contact_email: org.contactEmail,
      contact_phone: org.contactPhone,
      status: org.status,
      created_at: org.createdAt.toISOString(),
      updated_at: org.updatedAt.toISOString(),
    };
  }
}

export class OrganizationListResponseDto {
  @ApiProperty({ type: [OrganizationResponseDto] })
  items!: OrganizationResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  page_size!: number;

  @ApiProperty({ minimum: 0 })
  total_items!: number;

  @ApiProperty({ minimum: 0 })
  total_pages!: number;
}
