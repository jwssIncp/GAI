import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import { RemunerationProjectsQueryDto } from '../application/dto/payments-expenses-inputs';
import { RemunerationService } from '../application/services/remuneration.service';

/** Tela A da Remuneração: lista de projetos da organização (doc 06 §2.1). */
@Controller('remuneration')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class RemunerationController {
  constructor(private readonly remuneration: RemunerationService) {}

  @Get('projects')
  @RequirePermissions('payments:read')
  projects(
    @Query() query: RemunerationProjectsQueryDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ) {
    return this.remuneration.projects(
      {
        search: query.search,
        only_open: query.only_open === 'true',
        year: query.year,
      },
      {
        id: req.user!.id,
        systemRoles: req.user!.systemRoles,
        organizationId: req.user!.organizationId,
      },
    );
  }
}
