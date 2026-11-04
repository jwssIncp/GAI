import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  PreparationAnswerEntity,
  PreparationTemplateEntity,
  PreparationTemplateVersionEntity,
  ProjectPreparationEntity,
} from './preparation.entity';

@Injectable()
export class PreparationRepository {
  constructor(private readonly dataSource: DataSource) {}
  get manager(): EntityManager {
    return this.dataSource.manager;
  }
  transaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(operation);
  }
  template(organizationId: number, id: number, manager = this.manager) {
    return manager
      .getRepository(PreparationTemplateEntity)
      .findOneBy({ id, organizationId });
  }
  version(
    organizationId: number,
    templateId: number,
    version: number,
    manager = this.manager,
  ) {
    return manager
      .getRepository(PreparationTemplateVersionEntity)
      .findOneBy({ organizationId, templateId, version });
  }
  instance(
    organizationId: number,
    projectId: number,
    id: number,
    manager = this.manager,
  ) {
    return manager
      .getRepository(ProjectPreparationEntity)
      .findOneBy({ id, organizationId, projectId });
  }
  answers(instance: ProjectPreparationEntity, manager = this.manager) {
    return manager.getRepository(PreparationAnswerEntity).find({
      where: {
        organizationId: instance.organizationId,
        projectId: instance.projectId,
        preparationId: instance.id,
      },
      order: { id: 'ASC' },
    });
  }
}
