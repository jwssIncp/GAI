const fs = require('node:fs');
const path = require('node:path');
const backend = path.resolve(__dirname, '../gai-backend');
const env = require(path.join(backend, 'node_modules/dotenv')).parse(
  fs.readFileSync(path.join(backend, '.env')),
);

async function main() {
  if (env.NODE_ENV !== 'local' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) {
    throw new Error('Verificacao local exige NODE_ENV=local e DB_HOST loopback; nenhum banco remoto foi acessado.');
  }
  const mysql = require(path.join(backend, 'node_modules/mysql2/promise'));
  let connection;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      connection = await mysql.createConnection({
        host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
        user: env.DB_USERNAME, password: env.DB_PASSWORD,
        database: env.DB_DATABASE, connectTimeout: 2000,
      });
      break;
    } catch (error) {
      if (attempt === 14 || !['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  try {
    let rows;
    try { [rows] = await connection.query('SELECT name FROM migrations'); }
    catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; rows = []; }
    const applied = new Set(rows.map(row => row.name));
    const directory = path.join(backend, 'src/migrations');
    const names = fs.readdirSync(directory).filter(file => /^\d+.*\.ts$/.test(file)).map(file => {
      const source = fs.readFileSync(path.join(directory, file), 'utf8');
      const name = source.match(/\bname\s*=\s*['"]([^'"]+)['"]/)?.[1]
        || source.match(/export\s+class\s+(\w+)\s+implements\s+MigrationInterface/)?.[1];
      if (!name) throw new Error('Migration sem nome reconhecido: ' + file);
      return name;
    });
    const pending = names.filter(name => !applied.has(name));
    if (pending.length) {
      throw new Error(`Migrations pendentes em ${env.DB_HOST}:${env.DB_PORT || 3306}/${env.DB_DATABASE}:\n${pending.join('\n')}\nRevise o destino local e execute em gai-backend: npm.cmd run migration:run. Depois inicie novamente. Nenhuma migration foi aplicada automaticamente.`);
    }
    console.log(`Banco local ${env.DB_HOST}:${env.DB_PORT || 3306}/${env.DB_DATABASE}: ${names.length} migrations aplicadas; nenhuma pendente.`);
  } finally { await connection.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
