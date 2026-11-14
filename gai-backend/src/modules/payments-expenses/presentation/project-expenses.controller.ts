import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RequirePermissions } from '../../auth/presentation/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/presentation/guards/permissions.guard';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../../auth/presentation/guards/session-auth.guard';
import { ReopenPaymentDto } from '../application/dto/payments-expenses-inputs';
import {
  AddToBatchDto,
  AdvanceInputDto,
  BillBatchDto,
  ExpenseBoardQueryDto,
  ExpenseExportQueryDto,
  ExpenseIdsDto,
  ExpenseProjectsQueryDto,
  ExpenseTypeBatchDto,
  ExpenseZipQueryDto,
  ImportCommitDto,
  ReasonDto,
} from '../application/dto/project-expenses.dto';
import { ExpenseTransferService } from '../application/services/expense-transfer.service';
import type { PaymentsExpensesActorContext } from '../application/services/payments-expenses-scope.service';
import { PaymentsExpensesService } from '../application/services/payments-expenses.service';
import { ProjectExpensesService } from '../application/services/project-expenses.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Despesas na paridade com o INVESTOR (doc 06 §3, etapa 4). */
@ApiTags('Despesas')
@ApiBearerAuth()
@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ProjectExpensesController {
  constructor(
    private readonly board: ProjectExpensesService,
    private readonly transfer: ExpenseTransferService,
    private readonly expenses: PaymentsExpensesService,
  ) {}

  @Get('expense-projects')
  @RequirePermissions('expenses:read')
  @ApiOperation({ summary: 'Despesas: lista de projetos (Tela A)' })
  projects(
    @Query() q: ExpenseProjectsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.projects(
      { search: q.search, only_open: q.only_open === 'true', year: q.year },
      this.actor(req),
    );
  }

  @Get('projects/:projectId/expense-board')
  @RequirePermissions('expenses:read')
  @ApiOperation({
    summary: 'Despesas do projeto: KPIs, resumo, lotes e lançamentos',
  })
  boardOf(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() q: ExpenseBoardQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.board(projectId, q, this.actor(req));
  }

  @Get('projects/:projectId/expense-board/export')
  @RequirePermissions('expenses:read')
  @ApiOperation({ summary: 'Exportar a lista filtrada em Excel ou CSV' })
  async export(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() q: ExpenseExportQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { format, ...filters } = q;
    const file = await this.transfer.export(
      projectId,
      filters,
      format ?? 'xlsx',
      this.actor(req),
    );
    res
      .type(file.mimeType)
      .setHeader('Content-Disposition', disposition(file.fileName))
      .send(file.content);
  }

  @Get('projects/:projectId/expense-board/zip')
  @RequirePermissions(
    'expenses:read',
    'expenses:export-zip',
    'expenses:download-attachment',
  )
  @ApiOperation({
    summary: 'ZIP com comprovantes (completo ou cliente reembolsável)',
  })
  async zip(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() q: ExpenseZipQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const zip = await this.transfer.prepareZip(projectId, q, this.actor(req));
    res.status(200);
    res.type('application/zip');
    res.setHeader('Content-Disposition', disposition(zip.fileName));
    res.setHeader('X-Expenses', String(zip.expenses));
    res.setHeader('X-Attachments', String(zip.attachments));
    try {
      await zip.write({
        // Respeita a contrapressão: só lê o próximo pedaço quando a resposta drenar.
        write: (chunk) =>
          res.write(chunk)
            ? Promise.resolve()
            : new Promise<void>((resolve, reject) => {
                res.once('drain', resolve);
                res.once('close', () => reject(new Error('Conexão encerrada')));
              }),
        end: () => new Promise<void>((resolve) => res.end(resolve)),
      });
    } catch (error) {
      // Cabeçalho já enviado: só resta interromper a transferência.
      res.destroy(error as Error);
    }
  }

  @Post('projects/:projectId/expense-board/import/preview')
  @HttpCode(200)
  @RequirePermissions('expenses:import', 'expenses:create')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Importar: ler a planilha e pré-visualizar' })
  previewImport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.transfer.previewImport(projectId, file, this.actor(req));
  }

  @Post('projects/:projectId/expense-board/import')
  @HttpCode(200)
  @RequirePermissions('expenses:import', 'expenses:create')
  @ApiOperation({ summary: 'Importar: gravar as linhas confirmadas' })
  commitImport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ImportCommitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.transfer.commitImport(projectId, dto.rows, this.actor(req));
  }

  @Post('projects/:projectId/expense-board/type')
  @HttpCode(200)
  @RequirePermissions('expenses:update')
  changeType(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ExpenseTypeBatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.changeType(
      projectId,
      dto.ids,
      dto.expense_type,
      this.actor(req),
    );
  }

  @Post('projects/:projectId/expense-board/delete')
  @HttpCode(200)
  @RequirePermissions('expenses:delete')
  remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ExpenseIdsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.remove(projectId, dto.ids, this.actor(req));
  }

  @Post('projects/:projectId/expenses/:id/reopen')
  @HttpCode(200)
  @RequirePermissions('expenses:read', 'expenses:reopen')
  @ApiOperation({
    summary: 'Reabrir despesa aprovada para edição (volta a pendente)',
  })
  reopen(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.expenses.reopenExpense(projectId, id, dto, this.actor(req));
  }

  // Lotes de reembolso ao cliente (D-B)
  @Get('projects/:projectId/reimbursement-batches')
  @RequirePermissions('reimbursement-batches:read')
  batches(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.batches(projectId, this.actor(req));
  }

  @Post('projects/:projectId/reimbursement-batches')
  @HttpCode(200)
  @RequirePermissions('reimbursement-batches:create')
  @ApiOperation({
    summary: 'Prestar conta: incluir despesas num lote (novo ou aberto)',
  })
  addToBatch(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: AddToBatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.addToBatch(projectId, dto, this.actor(req));
  }

  @Post('projects/:projectId/reimbursement-batches/:batchId/remove')
  @HttpCode(200)
  @RequirePermissions('reimbursement-batches:create')
  removeFromBatch(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Body() dto: ExpenseIdsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.removeFromBatch(
      projectId,
      batchId,
      dto.ids,
      this.actor(req),
    );
  }

  @Post('projects/:projectId/reimbursement-batches/:batchId/bill')
  @HttpCode(200)
  @RequirePermissions('reimbursement-batches:close')
  bill(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Body() dto: BillBatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.billBatch(projectId, batchId, dto, this.actor(req));
  }

  @Post('projects/:projectId/reimbursement-batches/:batchId/reopen')
  @HttpCode(200)
  @RequirePermissions('reimbursement-batches:reopen')
  reopenBatch(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.reopenBatch(projectId, batchId, this.actor(req));
  }

  @Post('projects/:projectId/reimbursement-batches/:batchId/cancel')
  @HttpCode(200)
  @RequirePermissions('reimbursement-batches:reopen')
  cancelBatch(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.cancelBatch(projectId, batchId, this.actor(req));
  }

  // Concluir / reabrir o financeiro do projeto (M8)
  @Post('projects/:projectId/finance-closure/close')
  @HttpCode(200)
  @RequirePermissions('project-finance:close')
  closeFinance(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ReasonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.closeFinance(projectId, dto.reason, this.actor(req));
  }

  @Post('projects/:projectId/finance-closure/reopen')
  @HttpCode(200)
  @RequirePermissions('project-finance:reopen')
  reopenFinance(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ReasonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.reopenFinance(projectId, dto.reason, this.actor(req));
  }

  // Adiantamentos (M6)
  @Get('projects/:projectId/expense-advances')
  @RequirePermissions('expense-advances:read')
  advances(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.advances(projectId, this.actor(req));
  }

  @Post('projects/:projectId/expense-advances')
  @HttpCode(201)
  @RequirePermissions('expense-advances:create')
  createAdvance(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: AdvanceInputDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.saveAdvance(projectId, null, dto, this.actor(req));
  }

  @Patch('projects/:projectId/expense-advances/:id')
  @RequirePermissions('expense-advances:update')
  updateAdvance(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdvanceInputDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.saveAdvance(projectId, id, dto, this.actor(req));
  }

  @Delete('projects/:projectId/expense-advances/:id')
  @RequirePermissions('expense-advances:delete')
  removeAdvance(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.board.removeAdvance(projectId, id, this.actor(req));
  }

  private actor(req: AuthenticatedRequest): PaymentsExpensesActorContext {
    return {
      id: req.user!.id,
      systemRoles: req.user!.systemRoles,
      organizationId: req.user!.organizationId,
    };
  }
}

/** Nome de arquivo com acentos no cabeçalho (RFC 5987), com alternativa ASCII. */
function disposition(name: string) {
  const ascii = name
    .normalize('NFD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
