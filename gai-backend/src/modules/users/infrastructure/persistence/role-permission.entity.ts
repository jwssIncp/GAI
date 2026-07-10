import { Entity, PrimaryColumn } from 'typeorm';
import { FOREIGN_KEY_COLUMN } from '../../../../common/persistence/entity-id.columns';

@Entity('role_permissions')
export class RolePermissionEntity {
  @PrimaryColumn({ name: 'role_id', ...FOREIGN_KEY_COLUMN })
  roleId!: number;

  @PrimaryColumn({ name: 'permission_id', ...FOREIGN_KEY_COLUMN })
  permissionId!: number;
}
