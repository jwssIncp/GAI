import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFieldAgentDto } from '../../../../src/modules/field-agents/application/dto/create-field-agent.dto';
import { ListFieldAgentsQueryDto } from '../../../../src/modules/field-agents/application/dto/list-field-agents-query.dto';
import { UpdateFieldAgentDto } from '../../../../src/modules/field-agents/application/dto/update-field-agent.dto';
import { ProjectStatusBlocksFieldAgentOperationError } from '../../../../src/modules/field-agents/application/errors/project-status-blocks-operation';
import { FieldAgentRecordsService } from '../../../../src/modules/field-agents/application/services/field-agent-records.service';
import { CreateFieldAgentUseCase } from '../../../../src/modules/field-agents/application/use-cases/create-field-agent.use-case';
import { FieldAgent } from '../../../../src/modules/field-agents/domain/entities/field-agent';
import { FieldAgentStatus } from '../../../../src/modules/field-agents/domain/enums/field-agent-status.enum';

const actor = { id: 9, systemRoles: [], organizationId: 1 };

function agent(id: number, state: string | null = 'SP'): FieldAgent {
  const now = new Date('2026-11-13T12:00:00.000Z');
  return new FieldAgent({
    id,
    organizationId: 1,
    userId: null,
    name: `Inventariante ${id}`,
    email: null,
    phone: null,
    document: null,
    state,
    status: FieldAgentStatus.ACTIVE,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('Inventariantes: UF', () => {
  it('normaliza a UF para maiúsculas e aceita só siglas válidas', async () => {
    const ok = plainToInstance(CreateFieldAgentDto, {
      name: 'Ana',
      state: ' sp ',
    });
    expect(await validate(ok)).toHaveLength(0);
    expect(ok.state).toBe('SP');
    const bad = plainToInstance(UpdateFieldAgentDto, { state: 'XX' });
    expect((await validate(bad)).map((e) => e.property)).toEqual(['state']);
    const empty = plainToInstance(UpdateFieldAgentDto, { state: '' });
    expect(await validate(empty)).toHaveLength(0);
    expect(empty.state).toBeNull();
  });

  it('filtra a lista por UF', async () => {
    const query = plainToInstance(ListFieldAgentsQueryDto, { state: 'rj' });
    expect(await validate(query)).toHaveLength(0);
    expect(query.state).toBe('RJ');
  });

  it('o domínio registra a mudança de UF na auditoria', () => {
    const a = agent(1, null);
    expect(a.updateFields({ state: 'MG' })).toEqual({
      state: { before: null, after: 'MG' },
    });
    expect(a.state).toBe('MG');
  });
});

describe('Inventariantes: cadastro já com os projetos (bug do INVESTOR não replicado)', () => {
  function useCase(save: jest.Mock) {
    const repository = {
      findConflict: jest.fn().mockResolvedValue(null),
      saveFieldAgentWithAudit: save,
    };
    const organizations = {
      findById: jest.fn().mockResolvedValue({ isActive: () => true }),
    };
    const scope = { resolveOrganizationForCreate: () => 1 };
    const logger = { setContext: jest.fn(), info: jest.fn() };
    return new CreateFieldAgentUseCase(
      repository as never,
      organizations as never,
      scope as never,
      logger as never,
    );
  }

  it('envia os projetos marcados para a mesma gravação do cadastro', async () => {
    const save = jest.fn().mockResolvedValue(agent(5));
    await useCase(save).execute(
      { name: 'Ana Souza', state: 'SP', project_ids: [10, 11] },
      actor,
    );
    expect(save).toHaveBeenCalledTimes(1);
    const [created, audit, projects] = save.mock.calls[0] as [
      FieldAgent,
      { changes: Record<string, unknown> },
      number[],
    ];
    expect(created.state).toBe('SP');
    expect(audit.changes.state).toEqual({ before: null, after: 'SP' });
    expect(projects).toEqual([10, 11]);
  });

  it('sem projetos, grava sem vínculos', async () => {
    const save = jest.fn().mockResolvedValue(agent(5));
    await useCase(save).execute({ name: 'Ana Souza' }, actor);
    expect(save.mock.calls[0][2]).toEqual([]);
  });

  it('projeto encerrado desfaz o cadastro inteiro e devolve 409 estável', async () => {
    const save = jest
      .fn()
      .mockRejectedValue(new ProjectStatusBlocksFieldAgentOperationError(null));
    await expect(
      useCase(save).execute(
        { name: 'Ana Souza', project_ids: [99] },
        actor as never,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_STATUS_BLOCKS_OPERATION' },
    });
  });

  it('o DTO recusa projetos repetidos', async () => {
    const dto = plainToInstance(CreateFieldAgentDto, {
      name: 'Ana',
      project_ids: [1, 1],
    });
    expect((await validate(dto)).map((e) => e.property)).toEqual([
      'project_ids',
    ]);
  });
});

describe('Inventariantes: exclusão em lote', () => {
  function service(execute: jest.Mock) {
    return new FieldAgentRecordsService(
      {} as never,
      { resolveOrganizationForCreate: () => 1 } as never,
      {} as never,
      { execute } as never,
      {} as never,
      {} as never,
    );
  }

  it('exclui cada item pela regra individual e relata os que falharam', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Inventariante não encontrado.',
        }),
      )
      .mockRejectedValueOnce(
        new ConflictException({
          code: 'CONFLICT',
          message: 'O inventariante já foi excluído.',
        }),
      );
    const result = await service(execute).batchDelete([1, 2, 3, 1], actor);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      deleted: 1,
      failed: 2,
      results: [
        { id: 1, deleted: true },
        { id: 2, deleted: false, message: 'Inventariante não encontrado.' },
        { id: 3, deleted: false, message: 'O inventariante já foi excluído.' },
      ],
    });
  });

  it('erro inesperado interrompe o lote (não é engolido)', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('db down'));
    await expect(service(execute).batchDelete([1], actor)).rejects.toThrow(
      'db down',
    );
  });

  it('recusa lote vazio ou acima de 100', async () => {
    const execute = jest.fn();
    await expect(service(execute).batchDelete([], actor)).rejects.toMatchObject(
      {
        response: { code: 'VALIDATION_ERROR' },
      },
    );
    await expect(
      service(execute).batchDelete(
        Array.from({ length: 101 }, (_, i) => i + 1),
        actor,
      ),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('Inventariantes: documentos respeitam o limite do parâmetro financeiro', () => {
  it('recusa arquivo acima do limite vigente da organização', async () => {
    const db = {
      manager: {
        connection: { options: { type: 'sqlite' } },
        getRepository: () => ({
          findOne: jest.fn().mockResolvedValue({ id: 5, organizationId: 1 }),
        }),
      },
    };
    const financeSettings = {
      valuesAt: jest
        .fn()
        .mockResolvedValue({ field_agent_document_max_bytes: 2 * 1024 * 1024 }),
      platformMaxUploadBytes: () => 100 * 1024 * 1024,
    };
    const storage = { createUploadUrl: jest.fn() };
    const records = new FieldAgentRecordsService(
      db as never,
      { resolveOrganizationForCreate: () => 1 } as never,
      {} as never,
      {} as never,
      financeSettings as never,
      storage as never,
    );
    await expect(
      records.createDocumentUpload(
        5,
        {
          original_name: 'rg.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2 * 1024 * 1024 + 1,
        },
        actor,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'STORAGE_INVALID_SIZE',
        details: { max_bytes: 2097152 },
      },
    });
    expect(financeSettings.valuesAt).toHaveBeenCalledWith(1);
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });
});
