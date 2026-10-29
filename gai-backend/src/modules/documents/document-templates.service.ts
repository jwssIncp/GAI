import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../projects/application/services/project-scope.service';
import { documentHash } from '../technical-reports/report.hash';
import { DEFAULT_VISUAL, VisualTemplate } from './document.contract';
import { VisualTemplateDto } from './document.dto';
import { DocumentAudit, DocumentVisualVersion } from './document.entity';
import { DocumentRendererService } from './document-renderer.service';
@Injectable()
export class DocumentTemplatesService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
    private readonly renderer: DocumentRendererService,
  ) {}
  async current(
    organizationId: number,
    m: EntityManager = this.ds.manager,
  ): Promise<VisualTemplate> {
    const row = await m.findOne(DocumentVisualVersion, {
      where: { organizationId },
      order: { id: 'DESC' },
    });
    return row?.data ?? { ...DEFAULT_VISUAL };
  }
  async list(org: number, actor: ProjectActorContext) {
    this.scope.assertCanAccessProject(actor, org);
    return this.ds.manager.find(DocumentVisualVersion, {
      where: { organizationId: org },
      order: { id: 'DESC' },
      take: 100,
    });
  }
  async publish(
    org: number,
    dto: VisualTemplateDto,
    actor: ProjectActorContext,
  ) {
    this.scope.assertCanAccessProject(actor, org);
    for (const text of [
      dto.organization_name,
      dto.institutional,
      dto.header,
      dto.footer,
    ])
      if (
        /[<>]/.test(text) ||
        Array.from(text).some((c) => {
          const n = c.charCodeAt(0);
          return n < 32 && ![9, 10, 13].includes(n);
        })
      )
        throw new BadRequestException('Use texto simples no modelo visual.');
    const logo = dto.logo_png || null;
    if (logo) {
      const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        logo,
      );
      const b = match ? Buffer.from(match[1], 'base64') : Buffer.alloc(0);
      if (
        b.length < 33 ||
        b.length > 128 * 1024 ||
        !b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
        b.toString('ascii', 12, 16) !== 'IHDR' ||
        !b.readUInt32BE(16) ||
        !b.readUInt32BE(20) ||
        b.readUInt32BE(16) > 1024 ||
        b.readUInt32BE(20) > 1024
      )
        throw new BadRequestException(
          'Logotipo deve ser PNG de até 128 KB e 1024 × 1024 pixels.',
        );
    }
    if (logo) {
      try {
        await this.renderer.render(
          {
            title: 'Validação de logotipo',
            subtitle: '',
            version: 'preview',
            date: '',
            status: '',
            sourceHash: '',
            visual: { ...dto, logo_png: logo, version: 'preview' },
            blocks: [],
          },
          'pdf',
        );
      } catch {
        throw new BadRequestException(
          'O logotipo PNG não pôde ser decodificado com segurança.',
        );
      }
    }
    return this.ds.transaction(async (m) => {
      const row = await m.save(
        DocumentVisualVersion,
        m.create(DocumentVisualVersion, {
          organizationId: org,
          actorId: actor.id,
          recordedAt: new Date(),
          hash: documentHash(dto),
          data: { ...dto, logo_png: logo, version: 'pending' },
        }),
      );
      row.id = Number(row.id);
      row.data.version = 'visual-' + row.id;
      await m.update(
        DocumentVisualVersion,
        { id: row.id, organizationId: org },
        { data: row.data, hash: documentHash(row.data) },
      );
      await m.save(
        DocumentAudit,
        m.create(DocumentAudit, {
          organizationId: org,
          actorId: actor.id,
          recordedAt: new Date(),
          operation: 'visual-published',
          details: {
            visual_version: row.data.version,
            hash: documentHash(row.data),
          },
        }),
      );
      return { ...row, hash: documentHash(row.data) };
    });
  }
}
