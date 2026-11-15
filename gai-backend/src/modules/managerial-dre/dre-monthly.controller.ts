import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { DreScopeDto } from './dre.dto';
import {
  DreCellDto,
  DreImportConfirmDto,
  DreImportPreviewDto,
  DreLayoutDto,
  DreMonthlyQueryDto,
  DreRulesDto,
} from './dre-monthly.dto';
import {
  DreDefaultModelService,
  DreMonthlyCommandsService,
  DreMonthlyViewService,
} from './dre-monthly-commands.service';
import { DreCommandDto, DreReopenDto } from './dre.dto';
import { DreService } from './dre.service';

const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
type Upload = { originalname: string; buffer: Buffer } | undefined;

class DreDetailQueryLite {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) as_of?: string;
}

class DreDetailQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) organization_id?: number;
  @Type(() => Number) @IsInt() @Min(1) account_id!: number;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) as_of?: string;
}

/** DRE mensal (etapa 9): grade conta × mês, configuração, lançamento e importação. */
@Controller('finance/dre/monthly')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class DreMonthlyController {
  constructor(
    private readonly view: DreMonthlyViewService,
    private readonly commands: DreMonthlyCommandsService,
    private readonly model: DreDefaultModelService,
    private readonly dre: DreService,
  ) {}
  private actor(req: Request) {
    return (req as Request & { user: AuthenticatedUser }).user;
  }

  @Get()
  @RequirePermissions('dre:read')
  grid(@Query() q: DreMonthlyQueryDto, @Req() req: Request) {
    return this.view.view(q, this.actor(req));
  }

  @Get('checklist/:month')
  @RequirePermissions('dre:read')
  checklist(
    @Param('month') month: string,
    @Query() q: DreDetailQueryLite,
    @Req() req: Request,
  ) {
    return this.view.checklist(month, q, this.actor(req));
  }

  @Get('review')
  @RequirePermissions('dre:read')
  review(@Query() q: DreScopeDto, @Req() req: Request) {
    return this.view.review(q, this.actor(req));
  }

  @Post('review/:id/void')
  @HttpCode(200)
  @RequirePermissions('dre:read', 'dre:classify', 'dre:adjust')
  voidReviewed(
    @Param('id', ParseIntPipe) id: number,
    @Query() f: DreScopeDto,
    @Body() d: DreReopenDto,
    @Req() req: Request,
  ) {
    return this.dre.voidReviewed(id, f, d, this.actor(req));
  }

  @Get('freeze/:month')
  @RequirePermissions('dre:read', 'dre:periods')
  freezePreview(
    @Param('month') month: string,
    @Query() f: DreScopeDto,
    @Req() req: Request,
  ) {
    return this.dre.freezePreview(month, f, this.actor(req));
  }

  @Post('freeze/:month')
  @HttpCode(200)
  @RequirePermissions('dre:read', 'dre:periods')
  freeze(
    @Param('month') month: string,
    @Query() f: DreScopeDto,
    @Body() d: DreReopenDto,
    @Req() req: Request,
  ) {
    return this.dre.freezeColumn(month, f, d, this.actor(req));
  }

  @Get('detail')
  @RequirePermissions('dre:read')
  detail(@Query() q: DreDetailQueryDto, @Req() req: Request) {
    return this.view.detail(q, this.actor(req));
  }

  /** Modelo padrão: pré-visualização do que será criado e associado. */
  @Get('model')
  @RequirePermissions('dre:read', 'dre:configure')
  modelPreview(@Query() f: DreScopeDto, @Req() req: Request) {
    return this.model.preview(f, this.actor(req));
  }

  /** Aplica o modelo padrão (completa; nunca sobrescreve). */
  @Post('model')
  @HttpCode(200)
  @RequirePermissions('dre:read', 'dre:configure')
  modelApply(
    @Query() f: DreScopeDto,
    @Body() d: DreCommandDto,
    @Req() req: Request,
  ) {
    return this.model.apply(f, d, this.actor(req));
  }

  @Put('rules')
  @RequirePermissions('dre:read', 'dre:configure')
  rules(@Query() f: DreScopeDto, @Body() d: DreRulesDto, @Req() req: Request) {
    return this.commands.saveRules(f, d, this.actor(req));
  }

  @Put('layout')
  @RequirePermissions('dre:read', 'dre:configure')
  layout(
    @Query() f: DreScopeDto,
    @Body() d: DreLayoutDto,
    @Req() req: Request,
  ) {
    return this.commands.saveLayout(f, d, this.actor(req));
  }

  @Put('cells')
  @RequirePermissions('dre:read', 'dre:adjust')
  cell(@Query() f: DreScopeDto, @Body() d: DreCellDto, @Req() req: Request) {
    return this.commands.setCell(f, d, this.actor(req));
  }

  @Post('imports/preview')
  @HttpCode(200)
  @RequirePermissions('dre:read', 'dre:import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES } }),
  )
  preview(
    @Body() d: DreImportPreviewDto,
    @UploadedFile() file: Upload,
    @Req() req: Request,
  ) {
    return this.commands.importPreview(d, file, this.actor(req));
  }

  @Post('imports')
  @HttpCode(201)
  @RequirePermissions('dre:read', 'dre:import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES } }),
  )
  confirm(
    @Body() d: DreImportConfirmDto,
    @UploadedFile() file: Upload,
    @Req() req: Request,
  ) {
    return this.commands.importConfirm(d, file, this.actor(req));
  }
}
