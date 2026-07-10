import { readFileSync } from 'fs';
import { join } from 'path';

describe('import-sessions-api contract', () => {
  const content = readFileSync(
    join(
      process.cwd(),
      'specs/012-import-sessions/contracts/import-sessions-api.yaml',
    ),
    'utf8',
  );

  it('defines sessions, payloads, errors and files endpoints', () => {
    for (const path of [
      '/projects/{projectId}/import-sessions:',
      '/projects/{projectId}/import-sessions/{sessionId}:',
      '/projects/{projectId}/import-sessions/by-uuid/{sessionUuid}:',
      '/projects/{projectId}/import-sessions/{sessionId}/finish:',
      '/projects/{projectId}/import-sessions/{sessionId}/payloads:',
      '/projects/{projectId}/import-sessions/{sessionId}/payloads/{payloadId}/reprocess:',
      '/projects/{projectId}/import-sessions/{sessionId}/errors:',
      '/projects/{projectId}/import-sessions/{sessionId}/files/upload-url:',
      '/projects/{projectId}/import-sessions/{sessionId}/files/{fileId}/download-url:',
    ]) {
      expect(content).toContain(path);
    }
  });

  it('documents statuses and permissions', () => {
    for (const item of [
      'mobile_sync',
      'incremental_sync',
      'received',
      'processed',
      'duplicated',
      'pending_upload',
      'import-sessions:create',
      'import-payloads:reprocess',
      'import-files:download',
    ]) {
      expect(content).toContain(item);
    }
  });
});
