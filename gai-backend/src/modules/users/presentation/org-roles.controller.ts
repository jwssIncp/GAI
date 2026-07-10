import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiValidationErrorResponse,
} from '../../../common/swagger/api-error-responses';
import { UserRole } from '../../auth/domain/enums/user.enums';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { OrganizationScopeGuard } from '../../auth/presentation/guards/organization-scope.guard';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { SessionAuthGuard } from '../../auth/presentation/guards/session-auth.guard';
import { CreateOrgRoleDto } from '../application/dto/create-org-role.dto';
import { OrgRoleResponseDto } from '../application/dto/org-role-response.dto';
import { UpdateOrgRoleDto } from '../application/dto/update-org-role.dto';
import { CreateOrgRoleUseCase } from '../application/use-cases/create-org-role.use-case';
import { DeactivateOrgRoleUseCase } from '../application/use-cases/deactivate-org-role.use-case';
import { GetOrgRoleUseCase } from '../application/use-cases/get-org-role.use-case';
import { ListOrgRolesUseCase } from '../application/use-cases/list-org-roles.use-case';
import { UpdateOrgRoleUseCase } from '../application/use-cases/update-org-role.use-case';
import type { AuthenticatedUser } from '../../auth/presentation/guards/session-auth.guard';
import type { ActorContext } from '../application/services/user-scope.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('OrgRoles')
@ApiBearerAuth()
@Controller('organizations/:organizationId/roles')
@UseGuards(
  SessionAuthGuard,
  RolesGuard,
  PermissionsGuard,
  OrganizationScopeGuard,
)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN)
export class OrgRolesController {
  constructor(
    private readonly createOrgRole: CreateOrgRoleUseCase,
    private readonly listOrgRoles: ListOrgRolesUseCase,
    private readonly getOrgRole: GetOrgRoleUseCase,
    private readonly updateOrgRole: UpdateOrgRoleUseCase,
    private readonly deactivateOrgRole: DeactivateOrgRoleUseCase,
  ) {}

  @Get()
  @RequirePermissions('org_roles:read')
  @ApiOperation({ summary: 'Listar papéis customizados da organization' })
  @ApiParam({ name: 'organizationId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: OrgRoleResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async list(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Query('include_inactive', new ParseBoolPipe({ optional: true }))
    includeInactive: boolean = false,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listOrgRoles.execute(
      organizationId,
      includeInactive,
      this.toActor(req),
    );
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('org_roles:write')
  @ApiOperation({ summary: 'Criar papel customizado' })
  @ApiParam({ name: 'organizationId', type: 'integer', format: 'int64' })
  @ApiCreatedResponse({ type: OrgRoleResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Nome duplicado',
    'Org role name already exists in this organization',
  )
  async create(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: CreateOrgRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createOrgRole.execute(organizationId, dto, this.toActor(req));
  }

  @Get(':roleId')
  @RequirePermissions('org_roles:read')
  @ApiOperation({ summary: 'Consultar papel customizado' })
  @ApiParam({ name: 'organizationId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'roleId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: OrgRoleResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getById(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getOrgRole.execute(organizationId, roleId, this.toActor(req));
  }

  @Patch(':roleId')
  @RequirePermissions('org_roles:write')
  @ApiOperation({ summary: 'Atualizar papel customizado' })
  @ApiParam({ name: 'organizationId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'roleId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: OrgRoleResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Nome duplicado',
    'Org role name already exists in this organization',
  )
  async update(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: UpdateOrgRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateOrgRole.execute(
      organizationId,
      roleId,
      dto,
      this.toActor(req),
    );
  }

  @Delete(':roleId')
  @HttpCode(204)
  @RequirePermissions('org_roles:write')
  @ApiOperation({ summary: 'Desativar papel customizado' })
  @ApiParam({ name: 'organizationId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'roleId', type: 'integer', format: 'int64' })
  @ApiNoContentResponse({ description: 'Papel desativado' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Papel atribuído a usuários ativos',
    'Org role is assigned to active users',
  )
  async deactivate(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.deactivateOrgRole.execute(
      organizationId,
      roleId,
      this.toActor(req),
    );
  }

  private toActor(req: AuthenticatedRequest): ActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
