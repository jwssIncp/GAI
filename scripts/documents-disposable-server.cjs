if (process.env.GAI_DOCUMENTS_DISPOSABLE !== '1') throw new Error('Opt-in required: GAI_DOCUMENTS_DISPOSABLE=1. This resets only 127.0.0.1:33317/gai_validation_disposable.');
process.env.NODE_ENV = 'test';
process.env.GAI_TEST_MYSQL_DISPOSABLE = '1';
process.env.TS_NODE_PROJECT = require('node:path').resolve(__dirname, '../gai-backend/tsconfig.json');
require('../gai-backend/node_modules/ts-node/register/transpile-only');
const {createTestApp,seedTestData}=require('../gai-backend/test/integration/test-app.helper.ts');
(async()=>{const app=await createTestApp();await seedTestData(app);await app.listen(3000,'127.0.0.1'); console.log('DOCUMENTS_DISPOSABLE_SERVER_READY 127.0.0.1:3000');const stop=async()=>{await app.close();process.exit(0)};process.on('SIGTERM',stop);process.on('SIGINT',stop)})().catch(e=>{console.error(e);process.exit(1)});
