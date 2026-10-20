import {spawn} from 'node:child_process';
import {mkdir,writeFile,chmod} from 'node:fs/promises';
import {validateIdentityConfig} from './identity/server.mjs';
// GEMINI_* must be allowlisted: the child Node process does not inherit full Railway env.
const allowed=new Set(['PATH','HOME','NODE_ENV','PORT','AUTH_PROVIDER','RAILWAY_PROJECT_ID','RAILWAY_ENVIRONMENT_ID','REVIEW_PUBLIC_ORIGIN','REVIEW_DB_HOST','REVIEW_DB_NAME','REVIEW_DB_USER','REVIEW_DB_PASSWORD','REVIEW_DB_TRANSPORT','REVIEW_DB_ROLE','REVIEW_BIND_HOST','REVIEW_APP_ID','REVIEW_SESSION_SECRET','GOOGLE_OIDC_ISSUER','GOOGLE_OIDC_CLIENT_ID','GOOGLE_OIDC_CLIENT_SECRET','DD_DELETION_AUDIT_SECRET','STUDY_USAGE_SECRET','DD_PUBLIC_READ_MODE','QURAN_ENVIRONMENT','HUMHUB_ORIGIN','GEMINI_API_KEY','GEMINI_MODEL']);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>allowed.has(key)||key.startsWith('UMMAH_')));
validateIdentityConfig(env);
if(env.UMMAH_SOCIAL_ENVIRONMENT!=='isolated-staging'||env.UMMAH_PUBLIC_ORIGIN!==env.REVIEW_PUBLIC_ORIGIN||env.UMMAH_IDENTITY_ORIGIN!=='http://127.0.0.1:3001')throw Error('Explicit same-app staging identity origin required.');
let map;
try {map=JSON.parse(env.UMMAH_ACCOUNT_MAP_JSON||'null');}
catch {throw Error('Protected staging account mapping is invalid.');}
if(map?.schemaVersion!==1||!map.accounts||typeof map.accounts!=='object')throw Error('Protected staging account mapping required.');
const dir='/tmp/ummahconnect';await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
const file=dir+'/account-map.json';await writeFile(file,JSON.stringify(map),{mode:0o600});await chmod(file,0o600);
delete env.UMMAH_ACCOUNT_MAP_JSON;env.UMMAH_ACCOUNT_MAP_FILE=file;env.NODE_ENV='production';
const children=[spawn(process.execPath,['deployment/staging/identity/server.mjs'],{env,stdio:'inherit'}),spawn(process.execPath,['--import','tsx','server.ts'],{env,stdio:'inherit'})];
let ending=false;
function stop(code){if(ending)return;ending=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),1000);}
for(const child of children){child.on('error',()=>stop(1));child.on('exit',code=>stop(code||1));}
process.on('SIGTERM',()=>stop(0));process.on('SIGINT',()=>stop(0));
