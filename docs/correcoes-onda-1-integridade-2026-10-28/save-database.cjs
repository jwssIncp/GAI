const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { spawnSync } = require('node:child_process');
const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label || '')) throw Error('Expected snapshot label');
const file = path.join(__dirname, 'evidencias', label + '-synthetic.sql'), fd = fs.openSync(file, 'w');
const r = spawnSync('docker', ['exec', 'gai-wave1-20261028-mysql', 'mysqldump', '-uroot', '-pgai-validation-only', '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF', 'gai_validation_disposable'], { stdio: ['ignore', fd, 'pipe'] });
fs.closeSync(fd); if(r.status !== 0) throw Error(String(r.stderr));
const bytes = fs.readFileSync(file), result = { file: path.basename(file), target: 'gai-wave1-20261028-mysql:33337/gai_validation_disposable', bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), created_at: new Date().toISOString() };
fs.writeFileSync(file + '.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
