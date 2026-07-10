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
import { UserRole } from '../../auth/domain/enums/user.enums';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { SessionAuthGuard } from '../../auth/presentation/guards/session-auth.guard';
import { CreateOrganizationDto } from '../application/dto/create-organization.dto';
import { ListOrganizationsQueryDto } from '../application/dto/list-organizations-query.dto';
import {
  OrganizationListResponseDto,
  OrganizationResponseDto,
} from '../application/dto/organization-response.dto';
import { UpdateOrganizationDto } from '../application/dto/update-organization.dto';
import { ActivateOrganizationUseCase } from '../application/use-cases/activate-organization.use-case';
import { CreateOrganizationUseCase } from '../application/use-cases/create-organization.use-case';
import { DeactivateOrganizationUseCase } from '../application/use-cases/deactivate-organization.use-case';
import { GetOrganizationUseCase } from '../application/use-cases/get-organization.use-case';
import { ListOrganizationsUseCase } from '../application/use-cases/list-organizations.use-case';
import { UpdateOrganizationUseCase } from '../application/use-cases/update-organization.use-case';

interface AuthenticatedRequest extends Request {
  user?: { id: number };
}

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class OrganizationsController {
  constructor(
    private readonly createOrganization: CreateOrganizationUseCase,
    private readonly listOrganizations: ListOrganizationsUseCase,
    private readonly getOrganization: GetOrganizationUseCase,
    private readonly updateOrganization: UpdateOrganizationUseCase,
    private readonly deactivateOrganization: DeactivateOrganizationUseCase,
    private readonly activateOrganization: ActivateOrganizationUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Cadastrar organization',
    description:
      'Fluxos: 201 sucesso | 400 validação | 401 não autenticado | 403 sem PLATFORM_ADMIN | 409 CNPJ duplicado',
  })
  @ApiCreatedResponse({
    type: OrganizationResponseDto,
    description: 'Organization criada',
  })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse(
    'CNPJ já cadastrado',
    'Organization with this CNPJ already exists',
  )
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createOrganization.execute(dto, req.user?.id ?? null);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar organizations (paginado)',
    description:
      'Fluxos: 200 com resultados ou vazio | 400 page_size inválido | 401 | 403',
  })
  @ApiOkResponse({ type: OrganizationListResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async list(@Query() query: ListOrganizationsQueryDto) {
    return this.listOrganizations.execute(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar organization por ID',
    description: 'Fluxos: 200 encontrada | 401 | 403 | 404 inexistente',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.getOrganization.execute(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar organization',
    description:
      'Fluxos: 200 atualizada/no-op | 400 CNPJ imutável ou inválido | 401 | 403 | 404',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.updateOrganization.execute(id, dto, req.user?.id ?? null);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Desativar organization',
    description: 'Fluxos: 200 desativada | 401 | 403 | 404 | 409 já inativa',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Organization já inativa',
    'Organization is already inactive',
  )
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deactivateOrganization.execute(id, req.user?.id ?? null);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reativar organization',
    description: 'Fluxos: 200 reativada | 401 | 403 | 404 | 409 já ativa',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse(
    'Organization já ativa',
    'Organization is already active',
  )
  async activate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.activateOrganization.execute(id, req.user?.id ?? null);
  }
}
