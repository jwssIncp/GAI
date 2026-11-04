import { parentPort, workerData } from 'node:worker_threads';
import { renderDocument } from './document.render';
import type { DocumentFormat, ProfessionalDocument } from './document.contract';
const input = workerData as {
  model: ProfessionalDocument;
  format: DocumentFormat;
};
void renderDocument(input.model, input.format).then(
  (bytes) => parentPort!.postMessage({ bytes }),
  () => parentPort!.postMessage({ error: 'DOCUMENT_RENDER_FAILED' }),
);
