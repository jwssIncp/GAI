import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { DocumentFormat, ProfessionalDocument } from './document.contract';
@Injectable()
export class DocumentRendererService implements OnModuleDestroy {
  private readonly workers = new Set<Worker>();
  onModuleDestroy() {
    for (const worker of this.workers) void worker.terminate();
  }
  async render(
    model: ProfessionalDocument,
    format: DocumentFormat,
  ): Promise<Buffer> {
    if (this.workers.size >= 2)
      throw new ServiceUnavailableException(
        'Geração ocupada. Tente novamente em instantes.',
      );
    if (Buffer.byteLength(JSON.stringify(model)) > 3 * 1024 * 1024)
      throw new ServiceUnavailableException(
        'Documento excede o limite de entrada de 3 MB.',
      );
    const compiled = join(__dirname, 'document.worker.js');
    const worker = existsSync(compiled)
      ? new Worker(compiled, {
          workerData: { model, format },
          resourceLimits: { maxOldGenerationSizeMb: 256 },
        })
      : new Worker(
          `require(${JSON.stringify(require.resolve('ts-node/register/transpile-only'))});require(${JSON.stringify(join(__dirname, 'document.worker.ts'))});`,
          {
            eval: true,
            workerData: { model, format },
            resourceLimits: { maxOldGenerationSizeMb: 256 },
          },
        );
    this.workers.add(worker);
    try {
      return await new Promise<Buffer>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new ServiceUnavailableException(
              'Tempo limite de geração excedido.',
            ),
          );
          void worker.terminate();
        }, 30000);
        worker.once('message', (message: { bytes?: Uint8Array }) => {
          clearTimeout(timer);
          if (message.bytes) resolve(Buffer.from(message.bytes));
          else
            reject(
              new ServiceUnavailableException(
                'Não foi possível renderizar o documento.',
              ),
            );
        });
        worker.once('error', () => {
          clearTimeout(timer);
          reject(
            new ServiceUnavailableException(
              'Falha no renderizador documental.',
            ),
          );
        });
        worker.once('exit', () => {
          clearTimeout(timer);
          reject(new ServiceUnavailableException('Renderizador interrompido.'));
        });
      });
    } finally {
      await worker.terminate();
      this.workers.delete(worker);
    }
  }
}
