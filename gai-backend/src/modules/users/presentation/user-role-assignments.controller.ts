import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
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
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { SessionAuthGuard } from '../../auth/presentation/guards/session-auth.guard';
import type { AuthenticatedUser } from '../../auth/presentation/guards/session-auth.guard';
import { AssignUserRoleDto } from '../application/dto/assign-user-role.dto';
import { RoleAssignmentResponseDto } from '../application/dto/user-response.dto';
import { AssignUserRoleUseCase } from '../application/use-cases/assign-user-role.use-case';
import { ListUserRoleAssignmentsUseCase } from '../application/use-cases/list-user-role-assignments.use-case';
import { RevokeUserRoleAssignmentUseCase } from '../application/use-cases/revoke-user-role-assignment.use-case';
import type { ActorContext } from '../application/services/user-scope.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('User Role Assignments')
@ApiBearerAuth()
@Controller('users/:userId/role-assignments')
@UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN)
export class UserRoleAssignmentsController {
  constructor(
    private readonly assignRole: AssignUserRoleUseCase,
    private readonly listAssignments: ListUserRoleAssignmentsUseCase,
    private readonly revokeAssignment: RevokeUserRoleAssignmentUseCase,
  ) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Listar papéis atribuídos ao usuário' })
  @ApiParam({ name: 'userId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: RoleAssignmentResponseDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async list(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listAssignments.execute(userId, this.toActor(req));
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Atribuir papel ao usuário' })
  @ApiParam({ name: 'userId', type: 'integer', format: 'int64' })
  @ApiCreatedResponse({ type: RoleAssignmentResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async assign(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignUserRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assignRole.execute(userId, dto, this.toActor(req));
  }

  @Delete(':assignmentId')
  @HttpCode(204)
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Revogar atribuição de papel' })
  @ApiParam({ name: 'userId', type: 'integer', format: 'int64' })
  @ApiParam({ name: 'assignmentId', type: 'integer', format: 'int64' })
  @ApiNoContentResponse({ description: 'Atribuição revogada' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Último PLATFORM_ADMIN',
    'Cannot revoke the last active PLATFORM_ADMIN assignment',
  )
  async revoke(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.revokeAssignment.execute(
      userId,
      assignmentId,
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
