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
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import {
  AssignProjectUnitDto,
  CreateCompanyDto,
  CreateCompanyUnitDto,
  UpdateCompanyDto,
  UpdateCompanyUnitDto,
} from '../application/dto/company-inputs.dto';
import {
  ListCompaniesQueryDto,
  ListCompanyUnitsQueryDto,
} from '../application/dto/company-query.dto';
import {
  CompanyListResponseDto,
  CompanyResponseDto,
  CompanyUnitListResponseDto,
  CompanyUnitResponseDto,
  ProjectUnitListResponseDto,
  ProjectUnitResponseDto,
} from '../application/dto/company-response.dto';
import { CompanyActorContext } from '../application/services/company-scope.service';
import { CompaniesService } from '../application/services/companies.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Companies')
@ApiBearerAuth()
@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Post('companies')
  @HttpCode(201)
  @RequirePermissions('companies:create')
  @ApiOperation({ summary: 'Criar company' })
  @ApiCreatedResponse({ type: CompanyResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse('Conflito', 'Company document already exists')
  createCompany(
    @Body() dto: CreateCompanyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.createCompany(dto, this.toActor(req));
  }

  @Get('companies')
  @RequirePermissions('companies:read')
  @ApiOperation({ summary: 'Listar companies (paginado)' })
  @ApiOkResponse({ type: CompanyListResponseDto })
  listCompanies(
    @Query() query: ListCompaniesQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.listCompanies(query, this.toActor(req));
  }

  @Get('companies/:id')
  @RequirePermissions('companies:read')
  @ApiOperation({ summary: 'Consultar company por ID' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: CompanyResponseDto })
  @ApiNotFoundResponse()
  getCompany(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.getCompany(id, this.toActor(req));
  }

  @Patch('companies/:id')
  @RequirePermissions('companies:update')
  @ApiOperation({ summary: 'Atualizar company' })
  @ApiParam({ name: 'id', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: CompanyResponseDto })
  updateCompany(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.updateCompany(id, dto, this.toActor(req));
  }

  @Post('companies/:id/deactivate')
  @HttpCode(200)
  @RequirePermissions('companies:deactivate')
  @ApiOperation({ summary: 'Desativar company' })
  @ApiOkResponse({ type: CompanyResponseDto })
  deactivateCompany(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.changeCompanyStatus(
      id,
      'deactivate',
      this.toActor(req),
    );
  }

  @Post('companies/:id/reactivate')
  @HttpCode(200)
  @RequirePermissions('companies:reactivate')
  @ApiOperation({ summary: 'Reativar company' })
  @ApiOkResponse({ type: CompanyResponseDto })
  reactivateCompany(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.changeCompanyStatus(
      id,
      'reactivate',
      this.toActor(req),
    );
  }

  @Post('companies/:companyId/units')
  @HttpCode(201)
  @RequirePermissions('company-units:create')
  @ApiOperation({ summary: 'Criar company unit' })
  @ApiCreatedResponse({ type: CompanyUnitResponseDto })
  createUnit(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateCompanyUnitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.createUnit(companyId, dto, this.toActor(req));
  }

  @Get('companies/:companyId/units')
  @RequirePermissions('company-units:read')
  @ApiOperation({ summary: 'Listar company units' })
  @ApiOkResponse({ type: CompanyUnitListResponseDto })
  listUnits(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: ListCompanyUnitsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.listUnits(companyId, query, this.toActor(req));
  }

  @Get('companies/:companyId/units/:unitId')
  @RequirePermissions('company-units:read')
  @ApiOperation({ summary: 'Consultar company unit por ID' })
  @ApiOkResponse({ type: CompanyUnitResponseDto })
  getUnit(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.getUnit(companyId, unitId, this.toActor(req));
  }

  @Patch('companies/:companyId/units/:unitId')
  @RequirePermissions('company-units:update')
  @ApiOperation({ summary: 'Atualizar company unit' })
  @ApiOkResponse({ type: CompanyUnitResponseDto })
  updateUnit(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Body() dto: UpdateCompanyUnitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.updateUnit(companyId, unitId, dto, this.toActor(req));
  }

  @Post('companies/:companyId/units/:unitId/deactivate')
  @HttpCode(200)
  @RequirePermissions('company-units:deactivate')
  @ApiOperation({ summary: 'Desativar company unit' })
  @ApiOkResponse({ type: CompanyUnitResponseDto })
  deactivateUnit(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.changeUnitStatus(
      companyId,
      unitId,
      'deactivate',
      this.toActor(req),
    );
  }

  @Post('companies/:companyId/units/:unitId/reactivate')
  @HttpCode(200)
  @RequirePermissions('company-units:reactivate')
  @ApiOperation({ summary: 'Reativar company unit' })
  @ApiOkResponse({ type: CompanyUnitResponseDto })
  reactivateUnit(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.changeUnitStatus(
      companyId,
      unitId,
      'reactivate',
      this.toActor(req),
    );
  }

  @Post('projects/:projectId/units')
  @HttpCode(201)
  @RequirePermissions('project-units:assign')
  @ApiOperation({ summary: 'Vincular company unit a project' })
  @ApiCreatedResponse({ type: ProjectUnitResponseDto })
  assignProjectUnit(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: AssignProjectUnitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.assignProjectUnit(projectId, dto, this.toActor(req));
  }

  @Get('projects/:projectId/units')
  @RequirePermissions('project-units:read')
  @ApiOperation({ summary: 'Listar units vinculadas ao project' })
  @ApiOkResponse({ type: ProjectUnitListResponseDto })
  listProjectUnits(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.listProjectUnits(projectId, this.toActor(req));
  }

  @Post('projects/:projectId/units/:unitId/remove')
  @HttpCode(200)
  @RequirePermissions('project-units:remove')
  @ApiOperation({ summary: 'Remover unit do project' })
  @ApiOkResponse({ type: ProjectUnitResponseDto })
  removeProjectUnit(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.companies.removeProjectUnit(
      projectId,
      unitId,
      this.toActor(req),
    );
  }

  private toActor(req: AuthenticatedRequest): CompanyActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
