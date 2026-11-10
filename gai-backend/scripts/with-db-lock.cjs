'use strict';
// Run a command while holding a MySQL named lock (GET_LOCK) on a dedicated
// connection. Used by the release (migrations) and by mobile:retention so they
// never overlap, whatever started them (deploy, Ops workflow, EventBridge
// schedule). The lock lives only as long as this connection: if the process or
// the ECS task dies, MySQL releases it - no permanent lock is possible.
//
//   node scripts/with-db-lock.cjs [--name gai_release] [--wait 1800] -- <command...>
//
// Exit codes: the child's exit code; 75 when the lock was not obtained within
// --wait seconds (nothing was executed); 1 on connection errors.
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const LOCK_BUSY = 75;

function parseArgs(argv) {
  const sep = argv.indexOf('--');
  if (sep === -1 || sep === argv.length - 1)
    throw new Error('Usage: with-db-lock.cjs [--name N] [--wait S] -- <command...>');
  const options = { name: 'gai_release', wait: 1800 };
  const flags = argv.slice(0, sep);
  for (let i = 0; i < flags.length; i += 2) {
    if (flags[i] === '--name') options.name = flags[i + 1];
    else if (flags[i] === '--wait') options.wait = Number(flags[i + 1]);
    else throw new Error(`Unknown option ${flags[i]}`);
  }
  if (!/^[a-z0-9_]{1,64}$/.test(options.name)) throw new Error('Invalid lock name');
  if (!Number.isInteger(options.wait) || options.wait < 0) throw new Error('Invalid --wait');
  return { ...options, command: argv.slice(sep + 1) };
}

async function main() {
  const { name, wait, command } = parseArgs(process.argv.slice(2));
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'gai',
    password: process.env.DB_PASSWORD ?? 'gai',
    database: process.env.DB_DATABASE ?? 'gai',
  });
  const [[{ acquired }]] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [name, wait]);
  if (acquired !== 1) {
    console.error(`[db-lock] '${name}' is held by another release/retention task; nothing was executed.`);
    await connection.end();
    return LOCK_BUSY;
  }
  console.log(`[db-lock] '${name}' acquired; running: ${command.join(' ')}`);
  // Keep the idle lock connection alive during long migrations.
  const keepAlive = setInterval(() => connection.query('SELECT 1').catch(() => undefined), 60000);
  const code = await new Promise((resolve) => {
    // Linux (ECS): direct exec. Windows (local runs): via cmd for npm.cmd, with
    // quoted arguments so paths containing spaces survive.
    const child =
      process.platform === 'win32'
        ? spawn(command.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' '), {
            stdio: 'inherit',
            shell: true,
          })
        : spawn(command[0], command.slice(1), { stdio: 'inherit' });
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
    child.on('exit', (exitCode, signal) => resolve(exitCode ?? (signal ? 1 : 0)));
    child.on('error', () => resolve(1));
  });
  clearInterval(keepAlive);
  await connection.query('SELECT RELEASE_LOCK(?)', [name]).catch(() => undefined);
  await connection.end().catch(() => undefined);
  console.log(`[db-lock] '${name}' released (command exit ${code}).`);
  return code;
}

if (require.main === module)
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`[db-lock] ${error.message}`);
      process.exit(1);
    },
  );

module.exports = { parseArgs, LOCK_BUSY };
