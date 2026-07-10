import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgRole } from '../../domain/entities/org-role';
import { PermissionResponseDto } from './permission-response.dto';

export class OrgRoleResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ type: 'integer', format: 'int64' })
  organization_id!: number;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  is_active!: boolean;

  @ApiProperty({ type: [PermissionResponseDto] })
  permissions!: PermissionResponseDto[];

  @ApiProperty({ format: 'date-time' })
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  updated_at!: string;

  static fromDomain(role: OrgRole): OrgRoleResponseDto {
    return {
      id: role.id,
      organization_id: role.organizationId,
      name: role.name,
      description: role.description,
      is_active: role.isActive,
      permissions: role.permissions.map((permission) =>
        PermissionResponseDto.fromRecord(permission),
      ),
      created_at: role.createdAt.toISOString(),
      updated_at: role.updatedAt.toISOString(),
    };
  }
}
