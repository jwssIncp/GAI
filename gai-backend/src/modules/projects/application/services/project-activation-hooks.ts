import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { ProjectActorContext } from './project-scope.service';

export interface ProjectActivatedEvent {
  projectId: number;
  organizationId: number;
  actor: ProjectActorContext;
}
type Handler = (event: ProjectActivatedEvent) => Promise<void>;

/**
 * Ganchos executados depois que um projeto passa a "ativo" (ativar ou reativar). Os módulos
 * interessados (ex.: kick-off automático) se inscrevem sem que Projetos dependa deles. A
 * ativação já está gravada quando os ganchos rodam: uma falha num gancho é registrada no log
 * e não desfaz a ativação; cada gancho deve ser idempotente.
 */
@Injectable()
export class ProjectActivationHooks {
  private readonly handlers: Array<{ name: string; run: Handler }> = [];
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ProjectActivationHooks.name);
  }
  register(name: string, run: Handler) {
    this.handlers.push({ name, run });
  }
  async notify(event: ProjectActivatedEvent) {
    for (const handler of this.handlers) {
      try {
        await handler.run(event);
      } catch (error) {
        this.logger.error({
          operation: 'PROJECT_ACTIVATION_HOOK',
          hook: handler.name,
          projectId: event.projectId,
          organizationId: event.organizationId,
          result: 'FAILURE',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
