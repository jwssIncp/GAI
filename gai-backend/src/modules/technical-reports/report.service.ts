import { randomUUID } from 'node:crypto';
import { DocumentTemplatesService } from '../documents/document-templates.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import {
  ProjectScopeService,
  ProjectActorContext,
} from '../projects/application/services/project-scope.service';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../auth/domain/enums/user.enums';
import { UserRoleAssignmentEntity } from '../users/infrastructure/persistence/user-role-assignment.entity';
import { documentHash as hash } from './report.hash';
import {
  CreateReportDto,
  CreateTemplateDto,
  EditReportDto,
  EditTemplateDto,
  RefreshReportDto,
  ReportCommandDto,
  ReportRevisionDto,
  ResponsibleDto,
  TransitionReportDto,
} from './report.dto';
import {
  ReportCommand,
  ReportContent,
  ReportResponsible,
  ReportTemplate,
  ReportTemplateVersion,
  TechnicalReport,
  TechnicalReportVersion,
  Validation,
} from './report.entity';
import { ReportSourcesService, reportInvalid } from './report.sources';
import {
  plain,
  reportConflict,
  reportValidation,
  validateTemplate,
  REPORT_ENGINE,
} from './report.policy';
@Injectable()
export class TechnicalReportsService {
  constructor(
    readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
    readonly sources: ReportSourcesService,
    private readonly visualTemplates: DocumentTemplatesService,
  ) {}
  async project(m: EntityManager, id: number, actor: ProjectActorContext) {
    const p = await m.findOneBy(ProjectEntity, { id });
    if (!p) throw new NotFoundException('Projeto não encontrado.');
    this.scope.assertCanAccessProject(actor, Number(p.organizationId));
    return p;
  }
  private async command(
    projectId: number,
    d: ReportCommandDto,
    actor: ProjectActorContext,
    operation: string,
    perform: (
      m: EntityManager,
      p: ProjectEntity,
    ) => Promise<Record<string, unknown>>,
  ) {
    const reason = plain(d.reason);
    if (reason.length < 5) reportInvalid('Motivo significativo obrigatório.');
    const context = await this.project(this.ds.manager, projectId, actor);
    const org = Number(context.organizationId);
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      if (this.ds.options.type === 'mysql')
        await m.query('SELECT id FROM organizations WHERE id=? FOR UPDATE', [
          org,
        ]);
      const p = await this.project(m, projectId, actor);
      if (Number(p.organizationId) !== org)
        reportConflict('Escopo do projeto alterado.');
      const fingerprint = hash({ projectId, operation, d, actor: actor.id });
      const prior = await m.findOneBy(ReportCommand, {
        organizationId: org,
        commandKey: d.command_key,
      });
      if (prior) {
        if (prior.hash !== fingerprint || prior.actorId !== actor.id)
          reportConflict('Chave idempotente reutilizada com outro conteúdo.');
        if (operation.startsWith('report-')) {
          const priorData = prior.result.data as ReportContent;
          await this.sources.require(actor, priorData.sources.permissions);
        }
        return prior.result;
      }
      const result = await perform(m, p);
      await m.save(
        ReportCommand,
        m.create(ReportCommand, {
          organizationId: org,
          commandKey: d.command_key,
          hash: fingerprint,
          actorId: actor.id,
          operation,
          reason,
          recordedAt: new Date(),
          result,
        }),
      );
      return result;
    });
  }
  async templates(projectId: number, actor: ProjectActorContext) {
    const p = await this.project(this.ds.manager, projectId, actor);
    const items = await this.ds.manager.find(ReportTemplate, {
      where: { organizationId: Number(p.organizationId) },
      order: { id: 'DESC' },
      take: 1001,
    });
    if (items.length > 1000)
      reportInvalid('Limite de 1.000 modelos por organização.');
    return items;
  }
  private async template(m: EntityManager, p: ProjectEntity, id: number) {
    const t = await m.findOneBy(ReportTemplate, {
      id,
      organizationId: Number(p.organizationId),
    });
    if (!t)
      throw new NotFoundException('Modelo não encontrado nesta organização.');
    return t;
  }
  async templateDetail(
    projectId: number,
    id: number,
    actor: ProjectActorContext,
  ) {
    const p = await this.project(this.ds.manager, projectId, actor),
      t = await this.template(this.ds.manager, p, id);
    return {
      template: t,
      versions: await this.ds.manager.find(ReportTemplateVersion, {
        where: { templateId: id, organizationId: t.organizationId },
        order: { revision: 'DESC' },
      }),
    };
  }
  private templateVersion(
    m: EntityManager,
    t: ReportTemplate,
    actor: ProjectActorContext,
    operation: string,
    reason: string,
  ) {
    return m.save(
      ReportTemplateVersion,
      m.create(ReportTemplateVersion, {
        organizationId: t.organizationId,
        templateId: t.id,
        revision: t.revision,
        operation,
        data: t.data,
        hash: hash(t.data),
        actorId: actor.id,
        recordedAt: new Date(),
        reason,
      }),
    );
  }
  createTemplate(
    projectId: number,
    d: CreateTemplateDto,
    actor: ProjectActorContext,
  ) {
    return this.command(
      projectId,
      d,
      actor,
      'template-create',
      async (m, p) => {
        const t = await m.save(
          ReportTemplate,
          m.create(ReportTemplate, {
            organizationId: Number(p.organizationId),
            revision: 1,
            archived: false,
            publishedVersionId: null,
            data: validateTemplate(d.data),
          }),
        );
        t.id = Number(t.id);
        await this.templateVersion(m, t, actor, 'draft', d.reason);
        return { ...t };
      },
    );
  }
  editTemplate(
    projectId: number,
    id: number,
    d: EditTemplateDto,
    actor: ProjectActorContext,
  ) {
    return this.command(
      projectId,
      d,
      actor,
      'template-edit:' + id,
      async (m, p) => {
        const t = await this.template(m, p, id);
        if (t.archived || t.revision !== d.revision)
          reportConflict('Modelo arquivado ou revisão divergente.');
        t.revision++;
        t.data = validateTemplate(d.data);
        await m
          .createQueryBuilder()
          .update(ReportTemplate)
          .set({ revision: t.revision, data: () => ':data' })
          .where('id=:id AND organization_id=:org', {
            id,
            org: t.organizationId,
            data: JSON.stringify(t.data),
          })
          .execute();
        await this.templateVersion(m, t, actor, 'draft', d.reason);
        return { ...t };
      },
    );
  }
  templateAction(
    projectId: number,
    id: number,
    d: ReportRevisionDto,
    actor: ProjectActorContext,
    action: 'publish' | 'archive',
  ) {
    return this.command(
      projectId,
      d,
      actor,
      'template-' + action + ':' + id,
      async (m, p) => {
        const t = await this.template(m, p, id);
        if (t.revision !== d.revision || t.archived)
          reportConflict('Modelo arquivado ou revisão divergente.');
        t.revision++;
        t.archived = action === 'archive';
        const v = await this.templateVersion(m, t, actor, action, d.reason);
        if (action === 'publish') t.publishedVersionId = Number(v.id);
        await m.update(
          ReportTemplate,
          { id, organizationId: t.organizationId },
          {
            revision: t.revision,
            archived: t.archived,
            publishedVersionId: t.publishedVersionId,
          },
        );
        return { ...t };
      },
    );
  }
  private async activeUser(m: EntityManager, org: number, id: number) {
    const user = await m.findOneBy(UserEntity, {
      id,
      organizationId: org,
      status: UserStatus.ACTIVE,
    });
    if (
      !user ||
      !(await m.exists(UserRoleAssignmentEntity, {
        where: { userId: id, isActive: true },
      }))
    )
      reportInvalid(
        'Responsável deve ser usuário ativo da organização com atribuição ativa.',
      );
    return user;
  }
  async responsibles(projectId: number, actor: ProjectActorContext) {
    const p = await this.project(this.ds.manager, projectId, actor);
    return this.ds.manager.find(ReportResponsible, {
      where: { organizationId: Number(p.organizationId) },
      order: { id: 'ASC' },
      take: 1000,
    });
  }
  createResponsible(
    projectId: number,
    d: ResponsibleDto,
    actor: ProjectActorContext,
  ) {
    return this.command(
      projectId,
      d,
      actor,
      'responsible-register',
      async (m, p) => {
        const org = Number(p.organizationId);
        await this.activeUser(m, org, d.user_id);
        if (
          await m.exists(ReportResponsible, {
            where: { organizationId: org, userId: d.user_id },
          })
        )
          reportConflict('Usuário já cadastrado como responsável.');
        const data = {
          id: 0,
          user_id: d.user_id,
          display_name: plain(d.display_name),
          function: plain(d.function),
          professional_registration: plain(d.professional_registration),
          registration_evidence: plain(d.registration_evidence),
        };
        if (data.professional_registration && !data.registration_evidence)
          reportInvalid('Registro profissional exige referência documental.');
        const r = await m.save(
          ReportResponsible,
          m.create(ReportResponsible, {
            organizationId: org,
            userId: d.user_id,
            data,
          }),
        );
        r.id = Number(r.id);
        r.data.id = r.id;
        await m
          .createQueryBuilder()
          .update(ReportResponsible)
          .set({ data: () => ':data' })
          .where('id=:id', { id: r.id, data: JSON.stringify(r.data) })
          .execute();
        return { ...r };
      },
    );
  }
  async list(projectId: number, actor: ProjectActorContext) {
    const p = await this.project(this.ds.manager, projectId, actor);
    const rows = await this.ds.manager.find(TechnicalReport, {
      where: { projectId, organizationId: Number(p.organizationId) },
      order: { id: 'DESC' },
      take: 1001,
    });
    if (rows.length > 1000)
      reportInvalid('Limite de 1.000 laudos por projeto.');
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      revision: r.revision,
      status: r.status,
      title: r.data.title,
      report_type: r.data.template.data.report_type,
      approvedVersionId: r.approvedVersionId,
    }));
  }
  private async report(
    m: EntityManager,
    p: ProjectEntity,
    id: number,
    actor: ProjectActorContext,
  ) {
    const r = await m.findOneBy(TechnicalReport, {
      id,
      projectId: Number(p.id),
      organizationId: Number(p.organizationId),
    });
    if (!r) throw new NotFoundException('Laudo não encontrado neste projeto.');
    await this.sources.require(actor, r.data.sources.permissions);
    return r;
  }
  async detail(projectId: number, id: number, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const p = await this.project(m, projectId, actor),
        r = await this.report(m, p, id, actor);
      const versions = await m.find(TechnicalReportVersion, {
        // History only exposes metadata. Do not hydrate every large immutable
        // snapshot just to discard its data after the query.
        select: [
          'id',
          'revision',
          'status',
          'hash',
          'actorId',
          'recordedAt',
          'reason',
        ],
        where: { reportId: id, projectId, organizationId: r.organizationId },
        order: { revision: 'DESC' },
      });
      return {
        ...r,
        versions: versions.map((v) => ({
          id: v.id,
          revision: v.revision,
          status: v.status,
          hash: v.hash,
          actorId: v.actorId,
          recordedAt: v.recordedAt,
          reason: v.reason,
        })),
      };
    });
  }
  async version(
    projectId: number,
    id: number,
    versionId: number,
    actor: ProjectActorContext,
  ) {
    const p = await this.project(this.ds.manager, projectId, actor);
    await this.report(this.ds.manager, p, id, actor);
    const v = await this.ds.manager.findOneBy(TechnicalReportVersion, {
      id: versionId,
      reportId: id,
      projectId,
      organizationId: Number(p.organizationId),
    });
    if (!v) throw new NotFoundException('Versão não pertence ao laudo.');
    await this.sources.require(actor, v.data.sources.permissions);
    return v;
  }
  private async versionSave(
    m: EntityManager,
    r: TechnicalReport,
    validation: Validation,
    actor: ProjectActorContext,
    reason: string,
  ) {
    return m.save(
      TechnicalReportVersion,
      m.create(TechnicalReportVersion, {
        organizationId: r.organizationId,
        projectId: r.projectId,
        reportId: r.id,
        revision: r.revision,
        status: r.status,
        data: r.data,
        validation,
        hash: hash({ engine: REPORT_ENGINE, data: r.data, validation }),
        actorId: actor.id,
        recordedAt: new Date(),
        reason,
      }),
    );
  }
  private async update(m: EntityManager, r: TechnicalReport) {
    const result = await m
      .createQueryBuilder()
      .update(TechnicalReport)
      .set({
        revision: r.revision,
        status: r.status,
        approvedVersionId: r.approvedVersionId,
        data: () => ':data',
      })
      .where(
        'id=:id AND organization_id=:org AND project_id=:project AND revision=:old',
        {
          id: r.id,
          org: r.organizationId,
          project: r.projectId,
          old: r.revision - 1,
          data: JSON.stringify(r.data),
        },
      )
      .execute();
    if (result.affected !== 1)
      reportConflict('Revisão alterada concorrentemente.');
  }
  private editable(r: TechnicalReport, revision: number) {
    if (r.revision !== revision || !['draft', 'reopened'].includes(r.status))
      reportConflict(
        'Laudo não editável ou revisão divergente. Reabra/revise antes de alterar.',
      );
  }
  private async invalidResponsibles(m: EntityManager, r: TechnicalReport) {
    const invalid: number[] = [];
    for (const profile of r.data.responsibles) {
      try {
        await this.activeUser(m, r.organizationId, profile.user_id);
        const current = await m.findOneBy(ReportResponsible, {
          id: profile.id,
          organizationId: r.organizationId,
          userId: profile.user_id,
        });
        if (!current || hash(current.data) !== hash(profile))
          invalid.push(profile.id);
      } catch {
        invalid.push(profile.id);
      }
    }
    return invalid;
  }
  create(projectId: number, d: CreateReportDto, actor: ProjectActorContext) {
    return this.command(projectId, d, actor, 'report-create', async (m, p) => {
      const org = Number(p.organizationId),
        v = await m.findOneBy(ReportTemplateVersion, {
          id: d.template_version_id,
          organizationId: org,
          operation: 'publish',
        });
      if (!v)
        reportInvalid('Selecione uma versão publicada desta organização.');
      const t = await this.template(m, p, v.templateId);
      if (t.archived)
        reportInvalid('Modelo arquivado não permite novos laudos.');
      const sources = await this.sources.capture(m, p, d.selection, actor);
      const fields = v.data.fields.map<ReportContent['fields'][number]>(
        (f) => ({
          key: f.key,
          label: f.label,
          value: f.system_key ? (sources.fields[f.system_key] ?? '') : '',
          origin:
            f.system_key && sources.fields[f.system_key] != null
              ? 'system'
              : 'empty',
          source_key: f.system_key ?? null,
          original_value: f.system_key
            ? (sources.fields[f.system_key] ?? null)
            : null,
        }),
      );
      const data: ReportContent = {
        title: plain(d.title),
        template: {
          id: Number(t.id),
          version_id: Number(v.id),
          hash: v.hash,
          data: v.data,
        },
        sections: v.data.sections.map((s) => ({
          key: s.key,
          title: s.title,
          text: plain(s.text),
          origin: 'template',
        })),
        fields,
        sources,
        responsibles: [],
        technical_notes: '',
        conclusion: '',
      };
      const r = await m.save(
        TechnicalReport,
        m.create(TechnicalReport, {
          organizationId: org,
          projectId,
          revision: 1,
          status: 'draft',
          approvedVersionId: null,
          data,
        }),
      );
      r.id = Number(r.id);
      await this.versionSave(
        m,
        r,
        reportValidation(data, sources.hash),
        actor,
        d.reason,
      );
      return { ...r };
    });
  }
  edit(
    projectId: number,
    id: number,
    d: EditReportDto,
    actor: ProjectActorContext,
  ) {
    return this.command(
      projectId,
      d,
      actor,
      'report-edit:' + id,
      async (m, p) => {
        const r = await this.report(m, p, id, actor);
        this.editable(r, d.revision);
        if (
          d.sections.length !== r.data.sections.length ||
          new Set(d.sections.map((s) => s.key)).size !== d.sections.length
        )
          reportInvalid('Envie todas as seções, sem chaves repetidas.');
        if (
          d.fields.length !== r.data.fields.length ||
          new Set(d.fields.map((f) => f.key)).size !== d.fields.length
        )
          reportInvalid('Envie todos os campos, sem chaves repetidas.');
        for (const s of d.sections) {
          const old = r.data.sections.find((c) => c.key === s.key);
          if (!old) reportInvalid('Seção não pertence ao modelo.');
          const text = plain(s.text);
          if (text !== old.text) {
            old.text = text;
            old.origin = 'manual';
          }
        }
        for (const f of d.fields) {
          const old = r.data.fields.find((c) => c.key === f.key);
          if (!old) reportInvalid('Campo não pertence ao modelo.');
          const value = plain(f.value);
          if (value !== old.value) {
            old.value = value;
            old.origin = value ? 'manual' : 'empty';
          }
        }
        r.data.responsibles = [];
        for (const rid of d.responsible_ids) {
          const resp = await m.findOneBy(ReportResponsible, {
            id: rid,
            organizationId: r.organizationId,
          });
          if (!resp) reportInvalid('Responsável não pertence à organização.');
          await this.activeUser(m, r.organizationId, resp.userId);
          r.data.responsibles.push(resp.data);
        }
        r.data.title = plain(d.title);
        r.data.technical_notes = plain(d.technical_notes);
        r.data.conclusion = plain(d.conclusion);
        r.revision++;
        await this.update(m, r);
        await this.versionSave(
          m,
          r,
          reportValidation(r.data, r.data.sources.hash),
          actor,
          d.reason,
        );
        return { ...r };
      },
    );
  }
  refresh(
    projectId: number,
    id: number,
    d: RefreshReportDto,
    actor: ProjectActorContext,
  ) {
    return this.command(
      projectId,
      d,
      actor,
      'report-refresh:' + id,
      async (m, p) => {
        const r = await this.report(m, p, id, actor);
        this.editable(r, d.revision);
        r.data.sources = await this.sources.capture(m, p, d.selection, actor);
        for (const f of r.data.fields)
          if (f.source_key) {
            const value = r.data.sources.fields[f.source_key] ?? null;
            f.original_value = value;
            if (f.origin !== 'manual') {
              f.value = value ?? '';
              f.origin = value === null ? 'empty' : 'system';
            }
          }
        r.revision++;
        await this.update(m, r);
        await this.versionSave(
          m,
          r,
          reportValidation(
            r.data,
            r.data.sources.hash,
            await this.invalidResponsibles(m, r),
          ),
          actor,
          d.reason,
        );
        return { ...r };
      },
    );
  }
  async validate(projectId: number, id: number, actor: ProjectActorContext) {
    return this.ds.transaction('REPEATABLE READ', async (m) => {
      const p = await this.project(m, projectId, actor),
        r = await this.report(m, p, id, actor),
        current = await this.sources.capture(
          m,
          p,
          r.data.sources.selection,
          actor,
        );
      return reportValidation(
        r.data,
        current.hash,
        await this.invalidResponsibles(m, r),
      );
    });
  }
  transition(
    projectId: number,
    id: number,
    d: TransitionReportDto,
    actor: ProjectActorContext,
  ) {
    return this.command(
      projectId,
      d,
      actor,
      'report-' + d.action + ':' + id,
      async (m, p) => {
        const r = await this.report(m, p, id, actor);
        if (r.revision !== d.revision)
          reportConflict('Revisão divergente. Atualize antes de continuar.');
        let validation: Validation;
        if (d.action === 'review') {
          if (!['draft', 'reopened'].includes(r.status))
            reportConflict(
              'Somente rascunho/reaberto pode seguir para revisão.',
            );
          const current = await this.sources.capture(
            m,
            p,
            r.data.sources.selection,
            actor,
          );
          validation = reportValidation(
            r.data,
            current.hash,
            await this.invalidResponsibles(m, r),
          );
          if (!validation.valid)
            reportConflict(
              'Há bloqueios de validação. Consulte a validação estruturada.',
            );
          r.status = 'in_review';
        } else if (d.action === 'approve') {
          if (r.status !== 'in_review')
            reportConflict('Prepare uma versão em revisão antes de aprovar.');
          r.data.visual_template = await this.visualTemplates.current(
            r.organizationId,
            m,
          );
          const current = await this.sources.capture(
            m,
            p,
            r.data.sources.selection,
            actor,
          );
          validation = reportValidation(
            r.data,
            current.hash,
            await this.invalidResponsibles(m, r),
          );
          if (!validation.valid)
            reportConflict(
              'Há bloqueios de validação; fontes ou requisitos mudaram.',
            );
          r.status = 'approved';
        } else if (d.action === 'reopen') {
          if (!['approved', 'in_review'].includes(r.status))
            reportConflict('Somente aprovado/em revisão pode ser reaberto.');
          r.status = 'reopened';
          validation = reportValidation(r.data, r.data.sources.hash);
        } else {
          if (!['draft', 'reopened', 'approved'].includes(r.status))
            reportConflict('Estado não permite arquivamento.');
          r.status = 'archived';
          validation = reportValidation(r.data, r.data.sources.hash);
        }
        r.revision++;
        const version = await this.versionSave(
          m,
          r,
          validation,
          actor,
          d.reason,
        );
        if (d.action === 'approve') r.approvedVersionId = Number(version.id);
        await this.update(m, r);
        return { ...r, validation, version_id: Number(version.id) };
      },
    );
  }
  async export(
    projectId: number,
    id: number,
    versionId: number,
    actor: ProjectActorContext,
  ) {
    const version = await this.version(projectId, id, versionId, actor);
    if (version.status !== 'approved')
      reportConflict('Exportação exige uma versão aprovada preservada.');
    await this.ds.manager.save(
      ReportCommand,
      this.ds.manager.create(ReportCommand, {
        organizationId: version.organizationId,
        commandKey: 'download-' + randomUUID(),
        hash: version.hash,
        actorId: actor.id,
        operation: 'report-export:' + id,
        reason: 'Download do snapshot aprovado ' + versionId,
        recordedAt: new Date(),
        result: { report_id: id, version_id: versionId, hash: version.hash },
      }),
    );
    return {
      format: 'gai-technical-report-snapshot-v1',
      engine: REPORT_ENGINE,
      version,
      pdf_docx_contract: {
        input: 'immutable approved snapshot',
        required: [
          'escaped plain text',
          'professional A4 template',
          'paginated tables',
          'authorized private artifact and download',
          'render and visual QA',
          'checksum and current source permission validation',
        ],
        available: true,
        formats: ['pdf', 'docx'],
        generation_endpoint: `/projects/${projectId}/technical-reports/${id}/versions/${versionId}/documents`,
      },
    };
  }
}
