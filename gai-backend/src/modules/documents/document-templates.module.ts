import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentRendererService } from './document-renderer.service';
@Module({
  imports: [AuthModule, ProjectsModule],
  providers: [DocumentTemplatesService, DocumentRendererService],
  exports: [DocumentTemplatesService, DocumentRendererService],
})
export class DocumentTemplatesModule {}
