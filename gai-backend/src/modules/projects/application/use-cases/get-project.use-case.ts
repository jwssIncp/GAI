import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/ports/project.repository.port';
import { ProjectResponseDto } from '../dto/project-response.dto';
import {
  ProjectActorContext,
  ProjectScopeService,
} from '../services/project-scope.service';

@Injectable()
export class GetProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: ProjectRepository,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(
    id: number,
    actor: ProjectActorContext,
  ): Promise<ProjectResponseDto> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    }
    this.scope.assertCanAccessProject(actor, project.organizationId);
    return ProjectResponseDto.fromDomain(project);
  }
}
