import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthenticatedUser,
  SessionAuthGuard,
} from '../auth/presentation/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import { RequirePermissions } from '../auth/presentation/decorators/require-permissions.decorator';
import { DocumentsService } from './documents.service';
import { DocumentTemplatesService } from './document-templates.service';
import { GenerateDocumentDto, VisualTemplateDto } from './document.dto';
import type { DocumentKind } from './document.contract';
const actor = (r: Request) => (r as Request & { user: AuthenticatedUser }).user;
function deliver(
  res: Response,
  file: {
    bytes: Buffer;
    mime_type: string;
    filename: string;
    checksum: string;
  },
) {
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${file.filename}"`,
  );
  res.setHeader('Content-Length', file.bytes.length);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Document-SHA256', file.checksum);
  res.send(file.bytes);
}
@Controller(
  'projects/:projectId/technical-reports/:id/versions/:versionId/documents',
)
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions(
  'projects:read',
  'technical-reports:read',
  'technical-reports:export',
)
export class ReportDocumentsController {
  constructor(private readonly documents: DocumentsService) {}
  @Post() generate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() d: GenerateDocumentDto,
    @Req() req: Request,
  ) {
    return this.documents.generate(
      { kind: 'report', projectId, id, versionId },
      d,
      actor(req),
    );
  }
  @Get(':artifactId') async download(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Param('artifactId', ParseIntPipe) artifactId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    deliver(
      res,
      await this.documents.download(
        { kind: 'report', projectId, id, versionId },
        artifactId,
        actor(req),
      ),
    );
  }
}
@Controller('budgets/:id/versions/:versionId')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('budgets:read', 'budgets:export')
export class BudgetDocumentsController {
  constructor(private readonly documents: DocumentsService) {}
  @Post('documents') generate(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() d: GenerateDocumentDto,
    @Req() req: Request,
  ) {
    return this.documents.generate(
      { kind: 'budget', id, versionId },
      d,
      actor(req),
    );
  }
  @Post('proposal-documents') proposal(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() d: GenerateDocumentDto,
    @Req() req: Request,
  ) {
    return this.documents.generate(
      { kind: 'proposal', id, versionId },
      d,
      actor(req),
    );
  }
  private async send(
    kind: DocumentKind,
    id: number,
    versionId: number,
    artifactId: number,
    req: Request,
    res: Response,
  ) {
    deliver(
      res,
      await this.documents.download(
        { kind, id, versionId },
        artifactId,
        actor(req),
      ),
    );
  }
  @Get('documents/:artifactId') download(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Param('artifactId', ParseIntPipe) artifactId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.send('budget', id, versionId, artifactId, req, res);
  }
  @Get('proposal-documents/:artifactId') proposalDownload(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Param('artifactId', ParseIntPipe) artifactId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.send('proposal', id, versionId, artifactId, req, res);
  }
}
@Controller('organizations/:organizationId/document-templates')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('documents:templates')
export class DocumentTemplatesController {
  constructor(private readonly templates: DocumentTemplatesService) {}
  @Get() list(
    @Param('organizationId', ParseIntPipe) org: number,
    @Req() req: Request,
  ) {
    return this.templates.list(org, actor(req));
  }
  @Post() publish(
    @Param('organizationId', ParseIntPipe) org: number,
    @Body() dto: VisualTemplateDto,
    @Req() req: Request,
  ) {
    return this.templates.publish(org, dto, actor(req));
  }
}
