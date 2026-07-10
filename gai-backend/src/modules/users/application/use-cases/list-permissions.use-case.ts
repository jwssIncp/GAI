import { Inject, Injectable } from '@nestjs/common';
import {
  PERMISSION_REPOSITORY,
  type PermissionRepository,
} from '../../domain/ports/permission.repository.port';
import { PermissionResponseDto } from '../dto/permission-response.dto';
import { PermissionScope } from '../../domain/enums/permission-scope.enum';

@Injectable()
export class ListPermissionsUseCase {
  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly repository: PermissionRepository,
  ) {}

  async execute(scope?: PermissionScope): Promise<PermissionResponseDto[]> {
    const permissions = await this.repository.findAll(scope);
    return permissions.map((permission) =>
      PermissionResponseDto.fromRecord(permission),
    );
  }
}
