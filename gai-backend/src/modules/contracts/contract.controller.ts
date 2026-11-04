import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import {
  AmendmentDto,
  ContractCommandDto,
  ContractDataDto,
  EditContractDto,
} from './contract.dto';
import { ContractService } from './contract.service';
@Controller('projects/:projectId/contracts')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ContractController {
  constructor(private readonly service: ContractService) {}
  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }
  @Get()
  @RequirePermissions('projects:read', 'contracts:read')
  list(@Param('projectId', ParseIntPipe) p: number, @Req() req: Request) {
    return this.service.list(p, this.actor(req));
  }
  @Get(':id')
  @RequirePermissions('projects:read', 'contracts:read')
  detail(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.service.detail(p, id, this.actor(req));
  }
  @Post()
  @RequirePermissions('projects:read', 'contracts:read', 'contracts:edit')
  create(
    @Param('projectId', ParseIntPipe) p: number,
    @Body() dto: ContractDataDto,
    @Req() req: Request,
  ) {
    return this.service.create(p, dto, this.actor(req));
  }
  @Patch(':id')
  @RequirePermissions('projects:read', 'contracts:read', 'contracts:edit')
  edit(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditContractDto,
    @Req() req: Request,
  ) {
    return this.service.edit(p, id, dto, this.actor(req));
  }
  @Post(':id/amendments')
  @RequirePermissions('projects:read', 'contracts:read', 'contracts:amend')
  amend(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AmendmentDto,
    @Req() req: Request,
  ) {
    return this.service.amend(p, id, dto, this.actor(req));
  }
  @Post(':id/archive')
  @RequirePermissions('projects:read', 'contracts:read', 'contracts:archive')
  archive(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ContractCommandDto,
    @Req() req: Request,
  ) {
    return this.service.archive(p, id, dto, this.actor(req));
  }
}
