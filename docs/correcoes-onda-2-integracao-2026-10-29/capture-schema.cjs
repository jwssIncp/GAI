const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const schemas = ['gai_validation_disposable', 'gai_navigation_disposable'];
const sql = `SELECT TABLE_SCHEMA, COUNT(*) AS tables_count FROM information_schema.TABLES WHERE TABLE_SCHEMA IN ('${schemas.join("','")}') GROUP BY TABLE_SCHEMA;` + schemas.map(schema => `SELECT '${schema}' AS schema_name, COUNT(*) AS migrations_count FROM ${schema}.migrations;`).join('');
const result = spawnSync('docker', ['exec', 'gai-wave2-20261029-mysql', 'mysql', '-uroot', '-pgai-validation-only', '-B', '-e', sql], { encoding: 'utf8' });
if (result.status !== 0) throw Error(result.stderr);
fs.writeFileSync(path.join(__dirname, 'evidencias/schema-final.json'), JSON.stringify({ at: new Date().toISOString(), target: 'gai-wave2-20261029-mysql:33347', read_only: true, schemas, result: result.stdout.trim() }, null, 2));
console.log(result.stdout);
