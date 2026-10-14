import {readFile,writeFile,mkdir,readdir,rm,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
execFileSync('node',['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon'};
const assets={};
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else {const ext=e.name.slice(e.name.lastIndexOf('.'));assets[p.slice(4)]={mime:mime[ext]||'application/octet-stream',data:(await readFile(p)).toString('base64')};}}}
await walk('dist');await writeFile('staging/assets.generated.js','export default '+JSON.stringify(assets));
await rm('dist',{recursive:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['staging/worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',define:{'process.env.GEMINI_API_KEY':'undefined','process.env.UMMAH_API_KEY':'undefined','process.env.HUMHUB_ORIGIN':'undefined'},minify:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await rm('staging/assets.generated.js');
console.log('Built isolated staging Worker from the main app and existing service implementations.');
