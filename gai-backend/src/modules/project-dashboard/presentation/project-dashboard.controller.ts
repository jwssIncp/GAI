import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
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
import { ProjectActorContext } from '../../projects/application/services/project-scope.service';
import { ProjectSummaryQueryDto } from '../application/dto/project-summary-query.dto';
import { ProjectSummaryResponseDto } from '../application/dto/project-summary-response.dto';
import { ProjectSummaryService } from '../application/services/project-summary.service';
import { ProjectDashboardAnalyticsService } from '../application/services/project-dashboard-analytics.service';
import { ProjectDashboardQueryDto } from '../application/dto/project-dashboard-query.dto';
import { ProjectDashboardAnalyticsResponseDto } from '../application/dto/project-dashboard-response.dto';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('Project Dashboard')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ProjectDashboardController {
  constructor(
    private readonly summaries: ProjectSummaryService,
    private readonly analytics: ProjectDashboardAnalyticsService,
  ) {}

  @Get('summary')
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Consultar summary consolidado do project' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: ProjectSummaryResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async summary(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ProjectSummaryQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.summaries.getSummary(projectId, query, this.toActor(req));
  }

  @Get('dashboard')
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Consultar dashboard consolidado do project' })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: ProjectSummaryResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async dashboard(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ProjectSummaryQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.summaries.getSummary(projectId, query, this.toActor(req));
  }

  @Get('dashboard/analytics')
  @RequirePermissions('projects:read')
  @ApiOperation({
    summary: 'Consultar indicadores analíticos do dashboard do projeto',
    description:
      'Agrega apenas itens do projeto acessível ao usuário. O status evaluated representa item inventariado.',
  })
  @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
  @ApiOkResponse({ type: ProjectDashboardAnalyticsResponseDto })
  @ApiValidationErrorResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async dashboardAnalytics(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ProjectDashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.analytics.getDashboard(projectId, query, this.toActor(req));
  }

  private toActor(req: AuthenticatedRequest): ProjectActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}
