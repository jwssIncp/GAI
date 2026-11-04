import { Throttle } from '@nestjs/throttler';
import { UserLifecycleService } from '../application/services/user-lifecycle.service';
import { AdministrativePasswordDto } from '../../auth/application/dto/credential-actions.dto';
import { UserStatus } from '../../auth/domain/enums/user.enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
import type { AuthenticatedUser } from '../../auth/presentation/guards/session-auth.guard';
import { UserRole } from '../../auth/domain/enums/user.enums';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { SessionAuthGuard } from '../../auth/presentation/guards/session-auth.guard';
import { CreateUserDto } from '../application/dto/create-user.dto';
import { ListUsersQueryDto } from '../application/dto/list-users-query.dto';
import { UpdateUserDto } from '../application/dto/update-user.dto';
import {
  UserListResponseDto,
  UserResponseDto,
} from '../application/dto/user-response.dto';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { GetUserUseCase } from '../application/use-cases/get-user.use-case';
import { ListUsersUseCase } from '../application/use-cases/list-users.use-case';
import { UpdateUserUseCase } from '../application/use-cases/update-user.use-case';
import type { ActorContext } from '../application/services/user-scope.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.PLATFORM_ADMIN, UserRole.ORG_ADMIN)
export class UsersController {
  constructor(
    private readonly lifecycle: UserLifecycleService,
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Cadastrar usuário' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse(
    'Login ou email duplicado',
    'Login or email already exists',
  )
  async create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.createUser.execute(dto, this.toActor(req));
  }

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Listar usuários (paginado)' })
  @ApiOkResponse({ type: UserListResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async list(
    @Query() query: ListUsersQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listUsers.execute(query, this.toActor(req));
  }

  @Get('form-options')
  @RequirePermissions('users:write')
  options() {
    return this.lifecycle.options();
  }

  @Post(':id/password-reset')
  @HttpCode(200)
  @RequirePermissions('users:write')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdministrativePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lifecycle.resetPassword(id, dto.password, this.toActor(req));
  }

  @Post(':id/invitation/resend')
  @HttpCode(200)
  @RequirePermissions('users:write')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendInvitation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lifecycle.resend(id, this.toActor(req));
  }

  @Post(':id/block')
  @HttpCode(200)
  @RequirePermissions('users:write')
  block(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lifecycle.setStatus(id, UserStatus.BLOCKED, this.toActor(req));
  }

  @Post(':id/unblock')
  @HttpCode(200)
  @RequirePermissions('users:write')
  unblock(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lifecycle.setStatus(id, UserStatus.ACTIVE, this.toActor(req));
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Consultar usuário por ID' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getUser.execute(id, this.toActor(req));
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Atualizar usuário' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Login ou email duplicado',
    'Login or email already exists',
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateUser.execute(id, dto, this.toActor(req));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Desativar usuário' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Último PLATFORM_ADMIN ativo',
    'Cannot deactivate the last active PLATFORM_ADMIN',
  )
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lifecycle.setStatus(id, UserStatus.INACTIVE, this.toActor(req));
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Reativar usuário' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async activate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.lifecycle.setStatus(id, UserStatus.ACTIVE, this.toActor(req));
  }

  private toActor(req: AuthenticatedRequest): ActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
