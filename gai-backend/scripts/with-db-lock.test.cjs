// node --test scripts/with-db-lock.test.cjs
// The MySQL part runs only against the disposable validation database
// (GAI_TEST_MYSQL_DISPOSABLE=1, 127.0.0.1:33337), never against app settings.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { parseArgs, LOCK_BUSY } = require('./with-db-lock.cjs');

const script = path.join(__dirname, 'with-db-lock.cjs');
const env = {
  ...process.env,
  DB_HOST: '127.0.0.1',
  DB_PORT: '33337',
  DB_USERNAME: 'root',
  DB_PASSWORD: 'gai-validation-only',
  DB_DATABASE: 'gai_validation_disposable',
};
const node = process.execPath;
const mysqlTest = process.env.GAI_TEST_MYSQL_DISPOSABLE === '1' ? test : test.skip;

function start(args) {
  const child = spawn(node, [script, '--name', 'gai_lock_test', ...args], { env });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const done = new Promise((resolve) => child.on('exit', (code) => resolve({ code, output })));
  return { child, done, output: () => output };
}
const until = async (predicate, ms = 20000) => {
  const deadline = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 100));
  }
};

test('validates arguments', () => {
  assert.throws(() => parseArgs(['--wait', '1']));
  assert.throws(() => parseArgs(['--name', 'bad name', '--', 'x']));
  assert.throws(() => parseArgs(['--wait', '-1', '--', 'x']));
  assert.deepEqual(parseArgs(['--', 'npm', 'run', 'x']), {
    name: 'gai_release',
    wait: 1800,
    command: ['npm', 'run', 'x'],
  });
});

mysqlTest('excludes concurrent runs, propagates exit codes and survives a killed holder', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gai-lock-'));
  const marker = path.join(dir, 'ran');
  const file = (name, code) => {
    fs.writeFileSync(path.join(dir, name), code);
    return path.join(dir, name);
  };
  const sleep = file('sleep.js', 'setTimeout(() => process.exit(0), Number(process.argv[2]));');
  const mark = file('mark.js', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x');`);
  const exit3 = file('exit3.js', 'process.exit(3);');

  const holder = start(['--wait', '5', '--', node, sleep, '4000']);
  await until(() => holder.output().includes('acquired'));
  const busy = await start(['--wait', '1', '--', node, mark]).done;
  assert.equal(busy.code, LOCK_BUSY, busy.output);
  assert.equal(fs.existsSync(marker), false);

  assert.equal((await holder.done).code, 0, holder.output());
  const next = await start(['--wait', '5', '--', node, exit3]).done;
  assert.equal(next.code, 3, next.output);

  // Crash while holding the lock: MySQL drops it with the connection.
  const crashed = start(['--wait', '5', '--', node, sleep, '60000']);
  await until(() => crashed.output().includes('acquired'));
  crashed.child.kill('SIGKILL');
  await crashed.done;
  const recovered = await start(['--wait', '15', '--', node, mark]).done;
  assert.equal(recovered.code, 0, recovered.output);
  assert.equal(fs.existsSync(marker), true);
});
