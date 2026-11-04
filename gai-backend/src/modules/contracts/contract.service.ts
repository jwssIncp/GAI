import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { CompanyEntity } from '../companies/infrastructure/persistence/company.entity';
import { isCivilDate } from '../../common/validation/civil-date';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../projects/application/services/project-scope.service';
import { ProjectStatusTransitionPolicy } from '../projects/domain/services/project-status-transition.policy';
import {
  AmendmentDto,
  ContractCommandDto,
  ContractDataDto,
  EditContractDto,
} from './contract.dto';
import {
  ContractAmendmentEntity,
  ContractEntity,
  ContractSnapshot,
  ContractVersionEntity,
} from './contract.entity';
import {
  cents,
  conflict,
  invalid,
  money,
  normalizeContract,
  transition,
} from './contract.policy';

@Injectable()
export class ContractService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
  ) {}
  private async project(
    m: EntityManager,
    projectId: number,
    actor: ProjectActorContext,
    write = false,
    archive = false,
  ) {
    const q = m
      .getRepository(ProjectEntity)
      .createQueryBuilder('p')
      .where('p.id = :projectId', { projectId });
    if (write && this.ds.options.type === 'mysql')
      q.setLock('pessimistic_write');
    const project = await q.getOne();
    if (!project)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Projeto não encontrado.',
      });
    this.scope.assertCanAccessProject(actor, project.organizationId);
    if (
      write &&
      !archive &&
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
    )
      conflict(
        'Projeto encerrado não permite alterações contratuais; consulta e arquivamento permanecem disponíveis.',
      );
    return project;
  }
  private async contract(m: EntityManager, project: ProjectEntity, id: number) {
    const row = await m.findOneBy(ContractEntity, {
      id,
      projectId: project.id,
      organizationId: project.organizationId,
    });
    if (!row)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Contrato não encontrado neste projeto.',
      });
    return row;
  }
  private async company(
    m: EntityManager,
    project: ProjectEntity,
    companyId: number,
  ) {
    if (project.companyId !== companyId)
      invalid('A empresa contratante deve ser a empresa vinculada ao projeto.');
    const c = await m.findOneBy(CompanyEntity, {
      id: companyId,
      organizationId: project.organizationId,
    });
    if (!c) invalid('Empresa contratante indisponível nesta organização.');
    return c;
  }
  private checkRevision(row: ContractEntity, revision: number, reason: string) {
    if (row.revision !== revision)
      conflict(
        'O contrato foi alterado. Atualize a página antes de continuar.',
      );
    if (reason.trim().length < 5)
      invalid('Informe uma justificativa com pelo menos cinco caracteres.');
    if (row.data.status === 'archived')
      conflict('Contrato arquivado é imutável.');
  }
  private async version(
    m: EntityManager,
    row: ContractEntity,
    actor: ProjectActorContext,
    operation: string,
    reason: string,
  ) {
    await m.save(
      ContractVersionEntity,
      m.create(ContractVersionEntity, {
        contractId: row.id,
        organizationId: row.organizationId,
        projectId: row.projectId,
        revision: row.revision,
        data: row.data,
        operation,
        reason: reason.trim(),
        actorId: actor.id,
        recordedAt: new Date(),
      }),
    );
    return row;
  }
  async list(projectId: number, actor: ProjectActorContext) {
    const p = await this.project(this.ds.manager, projectId, actor);
    return this.ds.getRepository(ContractEntity).find({
      where: { projectId, organizationId: p.organizationId },
      order: { id: 'DESC' },
      take: 1000,
    });
  }
  async detail(projectId: number, id: number, actor: ProjectActorContext) {
    return this.ds.transaction(async (m) => {
      const p = await this.project(m, projectId, actor),
        row = await this.contract(m, p, id);
      const where = {
        contractId: id,
        projectId,
        organizationId: p.organizationId,
      };
      return {
        ...row,
        versions: await m.find(ContractVersionEntity, {
          where,
          order: { revision: 'DESC' },
        }),
        amendments: await m.find(ContractAmendmentEntity, {
          where,
          order: { revision: 'ASC' },
        }),
      };
    });
  }
  async create(
    projectId: number,
    dto: ContractDataDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(async (m) => {
      const p = await this.project(m, projectId, actor, true),
        d = normalizeContract(dto),
        c = await this.company(m, p, d.company_id);
      if (!['draft', 'active'].includes(d.status))
        invalid('Um contrato deve iniciar como rascunho ou ativo.');
      // The organization row serializes contract numbers across different projects.
      if (this.ds.options.type === 'mysql')
        await m.query('SELECT id FROM organizations WHERE id = ? FOR UPDATE', [
          p.organizationId,
        ]);
      if (
        await m.existsBy(ContractEntity, {
          organizationId: p.organizationId,
          number: d.number,
        })
      )
        conflict('Número de contrato já utilizado nesta organização.');
      const row = await m.save(
        ContractEntity,
        m.create(ContractEntity, {
          organizationId: p.organizationId,
          projectId,
          companyId: c.id,
          number: d.number,
          revision: 1,
          data: {
            ...d,
            current_value: d.original_value ?? null,
            current_ends_on: d.ends_on ?? null,
            current_scope: d.scope ?? null,
            company_name: c.name,
            company_state: c.state?.trim().toUpperCase() || null,
          },
        }),
      );
      return this.version(m, row, actor, 'create', 'Cadastro contratual');
    });
  }
  async edit(
    projectId: number,
    id: number,
    dto: EditContractDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(async (m) => {
      const p = await this.project(m, projectId, actor, true),
        row = await this.contract(m, p, id);
      this.checkRevision(row, dto.revision, dto.reason);
      const d = normalizeContract(dto);
      await this.company(m, p, d.company_id);
      for (const key of [
        'number',
        'company_id',
        'currency',
        'contracted_on',
        'original_value',
        'starts_on',
        'ends_on',
        'scope',
      ] as const) {
        if (
          d[key] !== row.data[key] &&
          !(row.data.status === 'draft' && row.data[key] == null)
        )
          conflict(
            'Identidade, datas, escopo e valor originais são imutáveis. Utilize aditivos para prazo, escopo e valor.',
          );
      }
      transition(row.data.status, d.status);
      if (row.data.status === 'draft') {
        row.data.current_value = d.original_value ?? null;
        row.data.current_ends_on = d.ends_on ?? null;
        row.data.current_scope = d.scope ?? null;
      }
      row.data = { ...row.data, ...d };
      row.revision++;
      await m.save(row);
      return this.version(m, row, actor, 'edit', dto.reason);
    });
  }
  async amend(
    projectId: number,
    id: number,
    dto: AmendmentDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(async (m) => {
      const p = await this.project(m, projectId, actor, true),
        row = await this.contract(m, p, id);
      this.checkRevision(row, dto.revision, dto.reason);
      await this.company(m, p, row.companyId);
      if (!['active', 'suspended'].includes(row.data.status))
        conflict('Aditivos exigem contrato ativo ou suspenso.');
      if (!dto.identifier.trim())
        invalid('Informe o identificador do aditivo.');
      const last = await m.findOne(ContractAmendmentEntity, {
        where: { contractId: id, organizationId: p.organizationId, projectId },
        order: { revision: 'DESC' },
      });
      if (
        dto.dated_on <
          (last?.datedOn ?? row.data.contracted_on ?? '1000-01-01') ||
        dto.dated_on < '1000-01-01'
      )
        invalid('Data do aditivo anterior à contratação ou ao último aditivo.');
      if (!isCivilDate(dto.dated_on)) invalid('Data inválida.');
      if (dto.dated_on > new Date().toISOString().slice(0, 10))
        invalid('Não registre aditivos com data futura.');
      if (
        await m.existsBy(ContractAmendmentEntity, {
          contractId: id,
          identifier: dto.identifier.trim(),
        })
      )
        conflict('Identificador de aditivo já utilizado.');
      const changed = [
        dto.value_delta != null,
        dto.ends_on != null,
        dto.scope != null,
      ];
      if (!changed.some(Boolean))
        invalid('Informe uma alteração de valor, prazo ou escopo.');
      const kindIndex = (
        { value: 0, term: 1, scope: 2 } as Record<string, number>
      )[dto.type];
      if (
        dto.type !== 'mixed' &&
        (changed.filter(Boolean).length !== 1 ||
          kindIndex == null ||
          !changed[kindIndex])
      )
        invalid('Tipo do aditivo incompatível com as alterações.');
      const next: ContractSnapshot = { ...row.data };
      if (dto.value_delta != null) {
        if (next.current_value == null)
          invalid(
            'Valor original ausente: não é possível calcular aditivo financeiro.',
          );
        const amount = cents(next.current_value) + cents(dto.value_delta);
        if (amount < 0n || amount > 999999999999999n)
          invalid('Valor vigente fora do limite contratual.');
        next.current_value = money(amount);
      }
      if (dto.ends_on != null) {
        if (
          dto.ends_on < (next.starts_on ?? '1000-01-01') ||
          !isCivilDate(dto.ends_on)
        )
          invalid('Vigência do aditivo inválida.');
        next.current_ends_on = dto.ends_on;
      }
      if (dto.scope != null) {
        if (!dto.scope.trim()) invalid('Escopo vazio.');
        next.current_scope = dto.scope.trim();
      }
      row.revision++;
      row.data = next;
      await m.save(row);
      await m.save(
        ContractAmendmentEntity,
        m.create(ContractAmendmentEntity, {
          contractId: id,
          organizationId: p.organizationId,
          projectId,
          identifier: dto.identifier.trim(),
          datedOn: dto.dated_on,
          type: dto.type,
          valueDelta:
            dto.value_delta == null ? null : money(cents(dto.value_delta)),
          endsOn: dto.ends_on ?? null,
          scope: dto.scope?.trim() ?? null,
          reason: dto.reason.trim(),
          actorId: actor.id,
          revision: row.revision,
          recordedAt: new Date(),
        }),
      );
      return this.version(m, row, actor, 'amend', dto.reason);
    });
  }
  async archive(
    projectId: number,
    id: number,
    dto: ContractCommandDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(async (m) => {
      const p = await this.project(m, projectId, actor, true, true),
        row = await this.contract(m, p, id);
      this.checkRevision(row, dto.revision, dto.reason);
      if (!['draft', 'completed', 'cancelled'].includes(row.data.status))
        conflict('Conclua ou cancele o contrato antes de arquivar.');
      row.data = { ...row.data, status: 'archived' };
      row.revision++;
      await m.save(row);
      return this.version(m, row, actor, 'archive', dto.reason);
    });
  }
}
