const fs = require('node:fs');

const STORAGE_MIME_TYPES =
  'image/jpeg,image/jpg,image/png,image/webp,application/pdf,application/json,text/plain,text/csv,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function upsertEnv(environment, entries) {
  const names = new Set(entries.map((item) => item.name));
  return [...environment.filter((item) => !names.has(item.name)), ...entries];
}

function resolveAssetsBucket(environment) {
  const fromStorage = environment.find((item) => item.name === 'STORAGE_BUCKET')?.value?.trim();
  const fromInventory = environment
    .find((item) => item.name === 'INVENTORY_ITEM_IMAGE_STORAGE_BUCKET')
    ?.value?.trim();
  const bucket = fromStorage || fromInventory;
  if (!bucket) {
    throw Error(
      'Assets bucket missing from task definition (STORAGE_BUCKET / INVENTORY_ITEM_IMAGE_STORAGE_BUCKET)',
    );
  }
  return bucket;
}

// This transform is pure/local. CI downloads the current task revision, so an
// initial Terraform environment change alone would not update later releases.
function prepareDocumentTask(input, name = 'gai-backend') {
  const task = structuredClone(input);
  const container = task.containerDefinitions?.find((item) => item.name === name);
  if (!container) throw Error('Backend container missing from task definition');
  const env = container.environment ?? [];
  const bucket = resolveAssetsBucket(env);
  container.environment = upsertEnv(env, [
    { name: 'DOCUMENT_STORAGE', value: 'database' },
    { name: 'STORAGE_PROVIDER', value: 's3' },
    { name: 'STORAGE_BUCKET', value: bucket },
    { name: 'STORAGE_PRESIGNED_URL_TTL_SECONDS', value: '300' },
    { name: 'STORAGE_MAX_SIZE_BYTES', value: '52428800' },
    { name: 'STORAGE_ALLOWED_MIME_TYPES', value: STORAGE_MIME_TYPES },
    { name: 'STORAGE_FORCE_PATH_STYLE', value: 'false' },
    { name: 'INVENTORY_ITEM_IMAGE_STORAGE_PROVIDER', value: 's3' },
    { name: 'INVENTORY_ITEM_IMAGE_STORAGE_BUCKET', value: bucket },
    {
      name: 'INVENTORY_ITEM_IMAGE_MAX_SIZE_BYTES',
      value:
        env.find((item) => item.name === 'INVENTORY_ITEM_IMAGE_MAX_SIZE_BYTES')?.value ||
        '10485760',
    },
    {
      name: 'INVENTORY_ITEM_IMAGE_MAX_PER_ITEM',
      value:
        env.find((item) => item.name === 'INVENTORY_ITEM_IMAGE_MAX_PER_ITEM')?.value || '3',
    },
    {
      name: 'INVENTORY_ITEM_IMAGE_PRESIGNED_URL_TTL_SECONDS',
      value:
        env.find((item) => item.name === 'INVENTORY_ITEM_IMAGE_PRESIGNED_URL_TTL_SECONDS')
          ?.value || '300',
    },
  ]);
  const cpu = Math.max(Number(task.cpu || 0), 1024);
  const ranges = {
    1024: [2048, 8192, 1024],
    2048: [4096, 16384, 1024],
    4096: [8192, 30720, 1024],
    8192: [16384, 61440, 4096],
    16384: [32768, 122880, 8192],
  };
  const range = ranges[cpu];
  if (!range) throw Error('Unsupported Fargate CPU allocation');
  const memory = Math.max(Number(task.memory || 0), range[0]);
  if (!Number.isFinite(memory) || memory > range[1] || (memory - range[0]) % range[2]) {
    throw Error('Invalid Fargate memory allocation');
  }
  // Preserve all existing higher allocations and sidecar settings. A smaller
  // explicit backend hard cap requires deliberate sizing instead of hiding it.
  if (container.memory && container.memory < 1536) {
    throw Error(
      'Backend container hard memory cap must be sized for documents (at least 1536 MiB)',
    );
  }
  task.cpu = String(cpu);
  task.memory = String(memory);
  return task;
}

module.exports = { prepareDocumentTask, resolveAssetsBucket, STORAGE_MIME_TYPES };
if (require.main === module) {
  const [, , source, destination, name] = process.argv;
  if (!source || !destination) {
    throw Error('Usage: prepare-document-task.cjs input.json output.json [container]');
  }
  fs.writeFileSync(
    destination,
    JSON.stringify(
      prepareDocumentTask(JSON.parse(fs.readFileSync(source, 'utf8')), name),
      null,
      2,
    ) + '\n',
  );
}
