import {
  type FieldAgentAccessStatus,
  loadFieldAgentAccess,
} from './field-agent-access';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  STORAGE_SIGNER,
  type StorageSigner,
} from '../../../../common/storage/storage-signer.port';
import { FinanceSettingsService } from '../../../finance-settings/finance-settings.service';
import { FieldAgentAuditOperation } from '../../domain/enums/field-agent-audit-operation.enum';
import {
  FIELD_AGENT_REPOSITORY,
  type FieldAgentRepository,
} from '../../domain/ports/field-agent.repository.port';
import { FieldAgentAuditLogEntity } from '../../infrastructure/persistence/field-agent-audit-log.entity';
import { FieldAgentDocumentEntity } from '../../infrastructure/persistence/field-agent-document.entity';
import { FieldAgentEntity } from '../../infrastructure/persistence/field-agent.entity';
import { ListFieldAgentsQueryDto } from '../dto/list-field-agents-query.dto';
import { DeleteFieldAgentUseCase } from '../use-cases/delete-field-agent.use-case';
import { fieldAgentAuditChanges } from './field-agent-audit';
import {
  FieldAgentActorContext,
  FieldAgentScopeService,
} from './field-agent-scope.service';

export interface FieldAgentDocumentResponse {
  id: number;
  field_agent_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  uploaded_by_id: number | null;
  created_at: string;
}

export interface FieldAgentExportRow {
  Nome: string;
  'E-mail': string;
  Telefone: string;
  UF: string;
  'CPF/CNPJ': string;
  Status: string;
  'Acesso ao app': string;
}

const ACCESS_LABELS: Record<FieldAgentAccessStatus, string> = {
  NONE: 'Sem acesso',
  INVITATION_PENDING: 'Convite pendente',
  AWAITING_FIRST_ACCESS: 'Aguardando 1º acesso',
  ACTIVE: 'Ativo',
  REVOKED: 'Revogado',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
};
const EXPORT_PAGE = 500;
const EXPORT_LIMIT = 20000;
export const BATCH_DELETE_LIMIT = 100;

function documentResponse(
  row: FieldAgentDocumentEntity,
): FieldAgentDocumentResponse {
  return {
    id: Number(row.id),
    field_agent_id: Number(row.fieldAgentId),
    original_name: row.originalName,
    mime_type: row.mimeType,
    size_bytes: Number(row.sizeBytes),
    status: row.status,
    uploaded_by_id: row.uploadedById == null ? null : Number(row.uploadedById),
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * Funções do cadastro de inventariantes acrescentadas na paridade financeira:
 * indicadores, exportação, exclusão em lote (com aviso de lançamentos) e
 * documentos anexados.
 */
@Injectable()
export class FieldAgentRecordsService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: FieldAgentScopeService,
    @Inject(FIELD_AGENT_REPOSITORY)
    private readonly repository: FieldAgentRepository,
    private readonly deleteFieldAgent: DeleteFieldAgentUseCase,
    private readonly financeSettings: FinanceSettingsService,
    @Inject(STORAGE_SIGNER) private readonly storage: StorageSigner,
  ) {}

  /** KPIs da lista: total de inventariantes (não excluídos) e UFs distintas. */
  async summary(actor: FieldAgentActorContext) {
    const organizationId = this.scope.resolveOrganizationForCreate(actor);
    const rows = await this.db
      .getRepository(FieldAgentEntity)
      .createQueryBuilder('a')
      .select('a.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .where('a.organizationId = :organizationId', { organizationId })
      .groupBy('a.state')
      .getRawMany<{ state: string | null; count: string }>();
    const states = rows
      .filter((row) => row.state)
      .map((row) => ({ state: row.state!, count: Number(row.count) }))
      .sort((a, b) => a.state.localeCompare(b.state));
    return {
      total: rows.reduce((sum, row) => sum + Number(row.count), 0),
      states_count: states.length,
      without_state: Number(rows.find((row) => !row.state)?.count ?? 0),
      states,
    };
  }

  /** Linhas da exportação, com os mesmos filtros da lista. */
  async exportRows(
    query: ListFieldAgentsQueryDto,
    actor: FieldAgentActorContext,
  ): Promise<FieldAgentExportRow[]> {
    const organizationId = this.scope.resolveOrganizationForCreate(actor);
    const rows: FieldAgentExportRow[] = [];
    for (let page = 1; ; page += 1) {
      const { items, total } = await this.repository.list({
        page,
        pageSize: EXPORT_PAGE,
        organizationId,
        status: query.status,
        state: query.state,
        search: query.search,
        deleted: query.deletion === 'deleted',
      });
      if (total > EXPORT_LIMIT)
        throw new BadRequestException({
          code: 'EXPORT_TOO_LARGE',
          message: `A exportação está limitada a ${EXPORT_LIMIT} inventariantes. Use os filtros.`,
        });
      const access = await loadFieldAgentAccess(
        this.db.manager,
        items.map((agent) => agent.userId),
      );
      for (const agent of items)
        rows.push({
          Nome: agent.name,
          'E-mail': agent.email ?? '',
          Telefone: agent.phone ?? '',
          UF: agent.state ?? '',
          'CPF/CNPJ': agent.document ?? '',
          Status: STATUS_LABELS[agent.status] ?? agent.status,
          'Acesso ao app':
            ACCESS_LABELS[
              (agent.userId && access.get(Number(agent.userId))?.status) ||
                'NONE'
            ],
        });
      if (page * EXPORT_PAGE >= total) break;
    }
    return rows;
  }

  /** Lançamentos financeiros ligados a cada inventariante (aviso antes de excluir). */
  async financialUsage(ids: number[], actor: FieldAgentActorContext) {
    const organizationId = this.scope.resolveOrganizationForCreate(actor);
    if (!ids.length) return [];
    const agents = await this.db.getRepository(FieldAgentEntity).find({
      where: { id: In(ids), organizationId },
      select: { id: true, name: true },
    });
    const known = agents.map((agent) => Number(agent.id));
    if (!known.length) return [];
    const count = async (table: string) =>
      new Map(
        (
          await this.db.query<{ id: string; total: string }[]>(
            `SELECT field_agent_id AS id, COUNT(*) AS total FROM ${table} WHERE organization_id = ? AND deleted_at IS NULL AND field_agent_id IN (${known.map(() => '?').join(',')}) GROUP BY field_agent_id`,
            [organizationId, ...known],
          )
        ).map((row) => [Number(row.id), Number(row.total)]),
      );
    const payments = await count('field_agent_payments');
    const expenses = await count('expenses');
    return agents.map((agent) => ({
      id: Number(agent.id),
      name: agent.name,
      payments: payments.get(Number(agent.id)) ?? 0,
      expenses: expenses.get(Number(agent.id)) ?? 0,
    }));
  }

  /**
   * Exclusão lógica em lote. Cada item passa pela mesma regra da exclusão
   * individual; os lançamentos continuam preservados (exclusão lógica).
   */
  async batchDelete(ids: number[], actor: FieldAgentActorContext) {
    this.scope.resolveOrganizationForCreate(actor);
    const unique = [...new Set(ids)];
    if (!unique.length || unique.length > BATCH_DELETE_LIMIT)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Selecione de 1 a ${BATCH_DELETE_LIMIT} inventariantes.`,
      });
    const results: Array<{ id: number; deleted: boolean; message?: string }> =
      [];
    for (const id of unique) {
      try {
        await this.deleteFieldAgent.execute(id, actor);
        results.push({ id, deleted: true });
      } catch (error) {
        const response =
          error instanceof NotFoundException ||
          error instanceof ConflictException
            ? (error.getResponse() as { message?: string })
            : null;
        if (!response) throw error;
        results.push({
          id,
          deleted: false,
          message: response.message ?? 'Não foi possível excluir.',
        });
      }
    }
    return {
      deleted: results.filter((item) => item.deleted).length,
      failed: results.filter((item) => !item.deleted).length,
      results,
    };
  }

  // ---------- Documentos ----------

  private async agentInScope(
    m: EntityManager,
    id: number,
    actor: FieldAgentActorContext,
    lock = false,
  ) {
    const organizationId = this.scope.resolveOrganizationForCreate(actor);
    const agent = await m.getRepository(FieldAgentEntity).findOne({
      where: { id, organizationId },
      ...(lock && m.connection.options.type === 'mysql'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!agent)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventariante não encontrado nesta organização.',
      });
    return agent;
  }

  private async document(
    m: EntityManager,
    agentId: number,
    documentId: number,
    actor: FieldAgentActorContext,
  ) {
    const agent = await this.agentInScope(m, agentId, actor);
    const row = await m.getRepository(FieldAgentDocumentEntity).findOne({
      where: {
        id: documentId,
        fieldAgentId: agent.id,
        organizationId: agent.organizationId,
      },
    });
    if (!row || row.status === 'removed')
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Documento não encontrado.',
      });
    return { agent, row };
  }

  private async audit(
    m: EntityManager,
    row: FieldAgentDocumentEntity,
    operation: FieldAgentAuditOperation,
    actor: FieldAgentActorContext,
  ) {
    await m.getRepository(FieldAgentAuditLogEntity).save({
      organizationId: row.organizationId,
      fieldAgentId: row.fieldAgentId,
      projectFieldAgentId: null,
      projectId: null,
      operation,
      performedBy: actor.id,
      changes: fieldAgentAuditChanges({
        document_id: { before: null, after: Number(row.id) },
        document_name: { before: null, after: row.originalName },
      }),
    });
  }

  private storageBucket() {
    return process.env.STORAGE_BUCKET ?? 'gai-local';
  }
  private ttl() {
    return Number(process.env.STORAGE_PRESIGNED_URL_TTL_SECONDS ?? 300);
  }

  async listDocuments(agentId: number, actor: FieldAgentActorContext) {
    const agent = await this.agentInScope(this.db.manager, agentId, actor);
    const rows = await this.db.getRepository(FieldAgentDocumentEntity).find({
      where: {
        fieldAgentId: agent.id,
        organizationId: agent.organizationId,
        status: 'uploaded',
      },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return rows.map(documentResponse);
  }

  async createDocumentUpload(
    agentId: number,
    dto: {
      original_name: string;
      mime_type: string;
      size_bytes: number;
      checksum?: string | null;
    },
    actor: FieldAgentActorContext,
  ) {
    const agent = await this.agentInScope(this.db.manager, agentId, actor);
    const settings = await this.financeSettings.valuesAt(agent.organizationId);
    const max = Math.min(
      settings.field_agent_document_max_bytes,
      this.financeSettings.platformMaxUploadBytes(),
    );
    if (dto.size_bytes > max)
      throw new BadRequestException({
        code: 'STORAGE_INVALID_SIZE',
        message: `O documento excede o limite de ${max} bytes por arquivo.`,
        details: { max_bytes: max },
      });
    const name = dto.original_name.trim();
    if (!name || name.length > 255)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Nome de arquivo inválido.',
      });
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const row = this.db.getRepository(FieldAgentDocumentEntity).create({
      organizationId: agent.organizationId,
      fieldAgentId: agent.id,
      storageProvider: process.env.STORAGE_PROVIDER ?? 's3',
      bucket: this.storageBucket(),
      path: `organizations/${agent.organizationId}/field-agents/${agent.id}/documents/${randomUUID()}-${safeName}`,
      originalName: name,
      mimeType: dto.mime_type.toLowerCase(),
      sizeBytes: dto.size_bytes,
      checksum: dto.checksum ?? null,
      status: 'pending_upload',
      uploadedById: actor.id,
    });
    const signed = await this.storage.createUploadUrl({
      bucket: row.bucket,
      path: row.path,
      mimeType: row.mimeType,
      expiresInSeconds: this.ttl(),
      sizeBytes: dto.size_bytes,
      checksum: row.checksum,
    });
    const saved = await this.db
      .getRepository(FieldAgentDocumentEntity)
      .save(row);
    return {
      document: documentResponse(saved),
      upload_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }

  async confirmDocument(
    agentId: number,
    documentId: number,
    dto: { size_bytes?: number | null; checksum?: string | null },
    actor: FieldAgentActorContext,
  ) {
    return this.db.transaction(async (m) => {
      const { row } = await this.document(m, agentId, documentId, actor);
      if (row.status !== 'pending_upload')
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Só é possível confirmar um envio pendente.',
        });
      const verified = await this.storage.verifyUpload({
        bucket: row.bucket,
        path: row.path,
        mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes),
        checksum: row.checksum,
        createdAt: row.createdAt,
        expiresInSeconds: this.ttl(),
        assertion: { sizeBytes: dto.size_bytes, checksum: dto.checksum },
      });
      row.status = 'uploaded';
      row.sizeBytes = verified.sizeBytes;
      row.checksum = verified.checksum;
      const saved = await m.getRepository(FieldAgentDocumentEntity).save(row);
      await this.audit(
        m,
        saved,
        FieldAgentAuditOperation.ATTACH_DOCUMENT,
        actor,
      );
      return documentResponse(saved);
    });
  }

  async downloadDocument(
    agentId: number,
    documentId: number,
    actor: FieldAgentActorContext,
  ) {
    const { row } = await this.document(
      this.db.manager,
      agentId,
      documentId,
      actor,
    );
    if (row.status !== 'uploaded')
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'O documento ainda não terminou de ser enviado.',
      });
    const signed = await this.storage.createDownloadUrl({
      bucket: row.bucket,
      path: row.path,
      mimeType: row.mimeType,
      expiresInSeconds: this.ttl(),
      sizeBytes: Number(row.sizeBytes),
      checksum: row.checksum,
    });
    return {
      document: documentResponse(row),
      download_url: signed.url,
      expires_in_seconds: signed.expiresInSeconds,
    };
  }

  async removeDocument(
    agentId: number,
    documentId: number,
    actor: FieldAgentActorContext,
  ) {
    return this.db.transaction(async (m) => {
      const { row } = await this.document(m, agentId, documentId, actor);
      row.status = 'removed';
      const saved = await m.getRepository(FieldAgentDocumentEntity).save(row);
      await this.audit(
        m,
        saved,
        FieldAgentAuditOperation.REMOVE_DOCUMENT,
        actor,
      );
      return documentResponse(saved);
    });
  }
}
