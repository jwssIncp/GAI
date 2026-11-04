import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../auth/domain/ports/permission-resolver.port';
import type { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { BudgetService } from '../budgets/budget.service';
import { TechnicalReportsService } from '../technical-reports/report.service';
import { documentHash } from '../technical-reports/report.hash';
import { REPORT_ENGINE } from '../technical-reports/report.policy';
import { budgetDocument, reportDocument } from './document.builder';
import {
  DOCUMENT_ENGINE,
  DOCUMENT_MIME,
  DocumentFormat,
  DocumentKind,
  DocumentSource,
  MAX_DOCUMENT_BYTES,
} from './document.contract';
import { DocumentArtifact, DocumentAudit } from './document.entity';
import { DocumentRendererService } from './document-renderer.service';
import { GenerateDocumentDto } from './document.dto';
export interface SourceRequest {
  kind: DocumentKind;
  id: number;
  versionId: number;
  projectId?: number | null;
}
@Injectable()
export class DocumentsService {
  private readonly pending = new Map<string, Promise<DocumentArtifact>>();
  constructor(
    private readonly ds: DataSource,
    private readonly reports: TechnicalReportsService,
    private readonly budgets: BudgetService,
    private readonly renderer: DocumentRendererService,
    @Inject(PERMISSION_RESOLVER)
    private readonly permissions: PermissionResolver,
  ) {}
  private async require(actor: ProjectActorContext, keys: string[]) {
    if (!(await hasAllPermissions(actor, keys, this.permissions)))
      throw new ForbiddenException('Permissão documental insuficiente.');
  }
  private async source(
    r: SourceRequest,
    actor: ProjectActorContext,
    memory: boolean,
  ): Promise<DocumentSource> {
    if (r.kind === 'report') {
      await this.require(actor, [
        'projects:read',
        'technical-reports:read',
        'technical-reports:export',
      ]);
      if (!r.projectId || memory)
        throw new BadRequestException('Opções incompatíveis com laudo.');
      const v = await this.reports.version(
        r.projectId,
        r.id,
        r.versionId,
        actor,
      );
      if (v.status !== 'approved')
        throw new ConflictException(
          'Exportação exige uma versão aprovada preservada.',
        );
      const canonical = documentHash({
        engine: REPORT_ENGINE,
        data: v.data,
        validation: v.validation,
      });
      // Earlier approved snapshots used insertion-order JSON; never rewrite them.
      const legacy = createHash('sha256')
        .update(
          JSON.stringify({
            engine: REPORT_ENGINE,
            data: v.data,
            validation: v.validation,
          }),
        )
        .digest('hex');
      if (v.hash !== canonical && v.hash !== legacy)
        throw new ConflictException(
          'Integridade do snapshot aprovado inválida.',
        );
      return {
        ...r,
        projectId: r.projectId,
        organizationId: v.organizationId,
        hash: v.hash,
        model: reportDocument(v),
      };
    }
    await this.require(actor, [
      'budgets:read',
      'budgets:export',
      ...(memory ? ['budgets:configure-prices'] : []),
    ]);
    const { row, version, approved } = await this.budgets.documentVersion(
      r.id,
      r.versionId,
      actor,
    );
    return {
      ...r,
      projectId: row.projectId,
      organizationId: row.organizationId,
      hash: version.hash,
      model: budgetDocument(version, approved, r.kind === 'proposal', memory),
    };
  }
  private async audit(
    source: DocumentSource,
    actor: ProjectActorContext,
    operation: string,
    details: Record<string, unknown>,
  ) {
    await this.ds.manager.save(
      DocumentAudit,
      this.ds.manager.create(DocumentAudit, {
        organizationId: source.organizationId,
        actorId: actor.id,
        recordedAt: new Date(),
        operation,
        details: {
          kind: source.kind,
          source_id: source.id,
          version_id: source.versionId,
          project_id: source.projectId,
          source_hash: source.hash,
          visual_version: source.model.visual.version,
          ...details,
        },
      }),
    );
  }
  private metadata(a: DocumentArtifact) {
    return {
      id: Number(a.id),
      kind: a.kind,
      source_id: a.sourceId,
      version_id: a.versionId,
      format: a.format,
      mime_type: DOCUMENT_MIME[a.format],
      filename: `${a.kind}-${a.sourceId}-versao-${a.versionId}.${a.format}`,
      size_bytes: a.sizeBytes,
      checksum: a.checksum,
      source_hash: a.sourceHash,
      visual_version: a.visualVersion,
      visual_hash: a.visualHash,
      status: a.status,
      include_memory: a.includeMemory,
      recorded_at: a.recordedAt,
    };
  }
  async generate(
    r: SourceRequest,
    dto: GenerateDocumentDto,
    actor: ProjectActorContext,
  ) {
    if (!['pdf', 'docx'].includes(dto.format))
      throw new BadRequestException('Formato não suportado.');
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.DOCUMENT_STORAGE !== 'database'
    )
      throw new ServiceUnavailableException(
        'Armazenamento documental não homologado neste ambiente.',
      );
    const source = await this.source(r, actor, !!dto.include_memory);
    const cacheKey = documentHash({
      engine: DOCUMENT_ENGINE,
      org: source.organizationId,
      kind: r.kind,
      id: r.id,
      version: r.versionId,
      source_hash: source.hash,
      model: source.model,
      format: dto.format,
      memory: !!dto.include_memory,
    });
    try {
      let artifact = await this.ds.manager.findOneBy(DocumentArtifact, {
        cacheKey,
        organizationId: source.organizationId,
      });
      let cached = !!artifact;
      if (!artifact) {
        let task = this.pending.get(cacheKey);
        cached = !!task;
        if (!task) {
          task = this.create(
            source,
            dto.format,
            !!dto.include_memory,
            cacheKey,
            actor,
          );
          this.pending.set(cacheKey, task);
          void task
            .finally(() => this.pending.delete(cacheKey))
            .catch(() => undefined);
        }
        artifact = await task;
      }
      await this.source(r, actor, !!dto.include_memory);
      await this.audit(source, actor, 'generated', {
        artifact_id: artifact.id,
        format: dto.format,
        checksum: artifact.checksum,
        cached,
        result: 'success',
      });
      return this.metadata(artifact);
    } catch (error) {
      await this.audit(source, actor, 'generation-failed', {
        format: dto.format,
        result: 'failed',
      });
      throw error;
    }
  }
  private async create(
    source: DocumentSource,
    format: DocumentFormat,
    includeMemory: boolean,
    cacheKey: string,
    actor: ProjectActorContext,
  ) {
    const bytes = await this.renderer.render(source.model, format);
    if (bytes.length > MAX_DOCUMENT_BYTES)
      throw new BadRequestException('Arquivo excede 10 MB.');
    await this.source(source, actor, includeMemory);
    const values = {
      organizationId: source.organizationId,
      actorId: actor.id,
      recordedAt: new Date(),
      cacheKey,
      kind: source.kind,
      sourceId: source.id,
      versionId: source.versionId,
      projectId: source.projectId,
      format,
      sourceHash: source.hash,
      visualHash: documentHash(source.model.visual),
      visualVersion: source.model.visual.version,
      includeMemory,
      status: source.model.status,
      checksum: createHash('sha256').update(bytes).digest('hex'),
      sizeBytes: bytes.length,
      bytes,
    };
    try {
      return await this.ds.manager.save(
        DocumentArtifact,
        this.ds.manager.create(DocumentArtifact, values),
      );
    } catch (error) {
      const prior = await this.ds.manager.findOneBy(DocumentArtifact, {
        cacheKey,
        organizationId: source.organizationId,
      });
      if (prior) return prior;
      throw error;
    }
  }
  async download(r: SourceRequest, id: number, actor: ProjectActorContext) {
    // Authorize before looking up an artifact, and repeat source permissions after lookup.
    const source = await this.source(r, actor, false);
    const row = await this.ds.manager
      .getRepository(DocumentArtifact)
      .createQueryBuilder('a')
      .addSelect('a.bytes')
      .where(
        'a.id=:id AND a.organization_id=:org AND a.kind=:kind AND a.source_id=:source AND a.version_id=:version',
        {
          id,
          org: source.organizationId,
          kind: r.kind,
          source: r.id,
          version: r.versionId,
        },
      )
      .getOne();
    if (!row || row.projectId !== source.projectId)
      throw new NotFoundException('Arquivo indisponível nesta versão.');
    await this.source(r, actor, row.includeMemory);
    if (
      row.sourceHash !== source.hash ||
      !row.bytes ||
      row.sizeBytes > MAX_DOCUMENT_BYTES ||
      row.bytes.length !== row.sizeBytes ||
      createHash('sha256').update(row.bytes).digest('hex') !== row.checksum
    ) {
      await this.audit(source, actor, 'download-failed', {
        artifact_id: id,
        result: 'integrity-failed',
      });
      throw new ConflictException(
        'Arquivo indisponível: falha de integridade.',
      );
    }
    await this.audit(source, actor, 'download', {
      artifact_id: id,
      format: row.format,
      checksum: row.checksum,
      result: 'delivered',
    });
    return { ...this.metadata(row), bytes: row.bytes };
  }
}
