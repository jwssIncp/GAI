import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '../../../common/swagger/api-error-responses';
import { UserRole } from '../../auth/domain/enums/user.enums';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { SessionAuthGuard } from '../../auth/presentation/guards/session-auth.guard';
import { PermissionResponseDto } from '../application/dto/permission-response.dto';
import { ListPermissionsUseCase } from '../application/use-cases/list-permissions.use-case';
import { PermissionScope } from '../domain/enums/permission-scope.enum';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN)
export class PermissionsController {
  constructor(private readonly listPermissions: ListPermissionsUseCase) {}

  @Get()
  @RequirePermissions('org_roles:read')
  @ApiOperation({ summary: 'Listar catálogo de permissões' })
  @ApiQuery({ name: 'scope', enum: PermissionScope, required: false })
  @ApiOkResponse({ type: PermissionResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async list(@Query('scope') scope?: PermissionScope) {
    return this.listPermissions.execute(scope);
  }
}
