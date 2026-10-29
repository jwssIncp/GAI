const fs = require('node:fs');

// This transform is pure/local. CI downloads the current task revision, so an
// initial Terraform environment change alone would not update later releases.
function prepareDocumentTask(input, name = 'gai-backend') {
  const task = structuredClone(input);
  const container = task.containerDefinitions?.find((item) => item.name === name);
  if (!container) throw Error('Backend container missing from task definition');
  const env = container.environment ?? [];
  container.environment = [
    ...env.filter((item) => item.name !== 'DOCUMENT_STORAGE'),
    { name: 'DOCUMENT_STORAGE', value: 'database' },
  ];
  const cpu = Math.max(Number(task.cpu || 0), 1024);
  const ranges = { 1024: [2048, 8192, 1024], 2048: [4096, 16384, 1024], 4096: [8192, 30720, 1024], 8192: [16384, 61440, 4096], 16384: [32768, 122880, 8192] };
  const range = ranges[cpu];
  if (!range) throw Error('Unsupported Fargate CPU allocation');
  const memory = Math.max(Number(task.memory || 0), range[0]);
  if (!Number.isFinite(memory) || memory > range[1] || (memory - range[0]) % range[2]) throw Error('Invalid Fargate memory allocation');
  // Preserve all existing higher allocations and sidecar settings. A smaller
  // explicit backend hard cap requires deliberate sizing instead of hiding it.
  if (container.memory && container.memory < 1536) throw Error('Backend container hard memory cap must be sized for documents (at least 1536 MiB)');
  task.cpu = String(cpu);
  task.memory = String(memory);
  return task;
}
module.exports = { prepareDocumentTask };
if (require.main === module) {
  const [, , source, destination, name] = process.argv;
  if (!source || !destination) throw Error('Usage: prepare-document-task.cjs input.json output.json [container]');
  fs.writeFileSync(destination, JSON.stringify(prepareDocumentTask(JSON.parse(fs.readFileSync(source, 'utf8')), name), null, 2) + '\n');
}
