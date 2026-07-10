import { ApiProperty } from '@nestjs/swagger';
import { PermissionScope } from '../../domain/enums/permission-scope.enum';
import type { PermissionRecord } from '../../domain/ports/permission.repository.port';
import type { PermissionRef } from '../../domain/entities/org-role';

export class PermissionResponseDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  id!: number;

  @ApiProperty({ example: 'users:read' })
  key!: string;

  @ApiProperty()
  resource!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty({ enum: PermissionScope })
  scope!: PermissionScope;

  @ApiProperty()
  description!: string;

  static fromRecord(
    permission: PermissionRecord | PermissionRef,
  ): PermissionResponseDto {
    return {
      id: permission.id,
      key: permission.key,
      resource: permission.resource,
      action: permission.action,
      scope: permission.scope,
      description: permission.description,
    };
  }
}
