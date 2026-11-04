import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../auth/domain/enums/user.enums';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import {
  SessionAuthGuard,
  AuthenticatedUser,
} from '../../auth/presentation/guards/session-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { AccessProfilesService } from '../application/services/access-profiles.service';

class AccessProfilesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organization_id?: number;
}

@ApiTags('Access profiles')
@ApiBearerAuth()
@Controller('access-profiles')
@UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN)
export class AccessProfilesController {
  constructor(private readonly profiles: AccessProfilesService) {}

  @Get()
  @RequirePermissions('org_roles:read')
  @ApiOperation({
    summary: 'Listar somente perfis concedíveis no contexto ativo',
  })
  list(
    @Query() query: AccessProfilesQuery,
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.profiles.list(
      {
        id: req.user.id,
        systemRoles: req.user.systemRoles,
        organizationId: req.user.organizationId,
      },
      query.organization_id,
    );
  }
}
