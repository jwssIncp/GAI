import { PermissionScope } from '../enums/permission-scope.enum';

export interface PermissionRecord {
  id: number;
  key: string;
  resource: string;
  action: string;
  scope: PermissionScope;
  description: string;
}

export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY');

export interface PermissionRepository {
  findAll(scope?: PermissionScope): Promise<PermissionRecord[]>;
  findByIds(ids: number[]): Promise<PermissionRecord[]>;
  findByKeys(keys: string[]): Promise<PermissionRecord[]>;
}
