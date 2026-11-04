import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from '../../gai-frontend/node_modules/vite/dist/node/index.js';
import react from '../../gai-frontend/node_modules/@vitejs/plugin-react/dist/index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../gai-frontend');
process.chdir(root);
const server=await createServer({root,configFile:false,plugins:[react()],resolve:{alias:{'@':path.join(root,'src')}},server:{host:'127.0.0.1',port:33320,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:33319',changeOrigin:true}}}});
await server.listen();console.log('AUDIT_FRONTEND_READY http://127.0.0.1:33320');
