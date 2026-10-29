import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import {
  SessionAuthGuard,
  type AuthenticatedUser,
} from '../auth/presentation/guards/session-auth.guard';
import { AssistedService } from './assisted.service';
import {
  AssistedPageQuery,
  DecideAssistedDto,
  GenerateAssistedDto,
} from './assisted.dto';
interface AuthRequest extends Request {
  user: AuthenticatedUser;
}
@ApiTags('Assisted reconciliation')
@ApiBearerAuth()
@Controller(
  'projects/:projectId/inventory-sessions/:sessionId/assisted-reconciliation',
)
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class AssistedController {
  constructor(private readonly service: AssistedService) {}
  @Post('runs')
  @RequirePermissions(
    'assisted-reconciliation:read',
    'assisted-reconciliation:generate',
  )
  generate(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('sessionId', ParseIntPipe) s: number,
    @Body() dto: GenerateAssistedDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.generate(p, s, dto, req.user);
  }
  @Get('runs')
  @RequirePermissions('assisted-reconciliation:read')
  runs(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('sessionId', ParseIntPipe) s: number,
    @Query() q: AssistedPageQuery,
    @Req() req: AuthRequest,
  ) {
    return this.service.runs(p, s, q, req.user);
  }
  @Get('runs/:runId/candidates')
  @RequirePermissions('assisted-reconciliation:read')
  candidates(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('sessionId', ParseIntPipe) s: number,
    @Param('runId', ParseIntPipe) id: number,
    @Query() q: AssistedPageQuery,
    @Req() req: AuthRequest,
  ) {
    return this.service.candidates(p, s, id, q, req.user);
  }
  @Get('candidates/:id/history')
  @RequirePermissions('assisted-reconciliation:read')
  history(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('sessionId', ParseIntPipe) s: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: AssistedPageQuery,
    @Req() req: AuthRequest,
  ) {
    return this.service.history(p, s, id, q, req.user);
  }
  @Post('candidates/:id/decisions')
  @RequirePermissions(
    'assisted-reconciliation:read',
    'assisted-reconciliation:review',
    'consolidations:create',
  )
  decide(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('sessionId', ParseIntPipe) s: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideAssistedDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.decide(p, s, id, dto, req.user);
  }
}
