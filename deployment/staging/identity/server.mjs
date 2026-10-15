import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {createPool} from 'mysql2/promise';
import {googleAuthResponse,googleModeConfig,canonicalGoogleHost} from './vendor/google-auth.mjs';
import {authResponse,verifiedRequestUser,logoutFormToken} from './vendor/auth.mjs';
const roles=new Set(['owner','reader','author','reviewer','publisher']);
const PROJECT='48d7a4cf-07dc-489b-8a3d-d6d10142b14e';
const ENVIRONMENT='1f7d98bf-1d49-4d9f-a5cc-13b57abcc095';
export function validateIdentityConfig(env){
 if(env.UMMAH_IDENTITY_ENVIRONMENT!=='isolated-staging'||env.RAILWAY_PROJECT_ID!==PROJECT||env.RAILWAY_ENVIRONMENT_ID!==ENVIRONMENT||env.REVIEW_DB_NAME!=='ummah_identity_staging'||env.REVIEW_DB_USER!=='ummah_identity_app'||typeof env.REVIEW_DB_PASSWORD!=='string'||env.REVIEW_DB_PASSWORD.length<32||!/^[-a-z0-9]+\.railway\.internal$/.test(env.REVIEW_DB_HOST||''))throw Error('Isolated staging identity database configuration required.');
 const settings=googleModeConfig(env);const origin=new URL(settings.origin);
 if(!origin.hostname.endsWith('.railway.app')||env.REVIEW_APP_ID!=='ummahconnect-isolated-staging')throw Error('Dedicated Railway staging public origin required.');
 return settings;
}
export function database(pool){return{prepare(sql){return{bind(...args){return{async first(){const[rows]=await pool.execute(sql,args);return rows[0]||null;},async run(){const[result]=await pool.execute(sql,args);return{meta:{changes:result.affectedRows}};}};}};}};}
export function identityHandler(env,db){return async request=>{
 const settings=validateIdentityConfig(env);const url=new URL(request.url);
 if(url.origin!==settings.origin||!canonicalGoogleHost(request.headers.get('host'),settings.origin))return new Response('Canonical staging host required.',{status:403});
 if(['/auth/login','/auth/callback'].includes(url.pathname))return googleAuthResponse(request,env,{db});
 if(['/auth/logout','/auth/logout-all'].includes(url.pathname))return authResponse(request,env,{db});
 if(url.pathname==='/api/review/session'&&request.method==='GET'){
  const user=await verifiedRequestUser(request,env,db);
  if(!user)return Response.json({user:null},{status:401,headers:{'Cache-Control':'no-store'}});
  const row=await db.prepare('SELECT role,disabled FROM review_roles WHERE user_id=?').bind(user.id).first();
  if(!row||Number(row.disabled)||!roles.has(row.role))return Response.json({user:null},{status:403,headers:{'Cache-Control':'no-store'}});
  return Response.json({user:{...user,role:row.role},configured:true,logoutCsrfToken:logoutFormToken(request,env)},{headers:{'Cache-Control':'no-store'}});
 }
 return new Response('Not found',{status:404});
};}
export async function startIdentity(env=process.env){
 const settings=validateIdentityConfig(env);
 const pool=createPool({host:env.REVIEW_DB_HOST,port:3306,database:env.REVIEW_DB_NAME,user:env.REVIEW_DB_USER,password:env.REVIEW_DB_PASSWORD,connectionLimit:4,connectTimeout:10000,multipleStatements:false});
 const[markers]=await pool.execute('SELECT instance_id,project_id,environment_id FROM ummah_identity_instance WHERE instance_id=?',['ummahconnect-isolated-staging']);
 if(markers.length!==1||markers[0].project_id!==PROJECT||markers[0].environment_id!==ENVIRONMENT){await pool.end();throw Error('Dedicated staging database marker required.');}
 const handle=identityHandler(env,database(pool));
 const server=createServer(async(req,res)=>{
  try{
   if(req.socket.remoteAddress!=='127.0.0.1'){res.writeHead(403);return res.end('Private identity listener only.');}
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2048){res.writeHead(413);return res.end('Request too large.');}chunks.push(chunk);}
   const headers=new Headers();for(const[name,value]of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join('; '):value);
   const response=await handle(new Request(settings.origin+(req.url||'/'),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}));
   res.statusCode=response.status;for(const[name,value]of response.headers)if(name.toLowerCase()!=='set-cookie')res.setHeader(name,value);
   const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(503,{'Cache-Control':'no-store'});res.end('Staging identity authority unavailable.');}
 });
 server.listen(3001,'127.0.0.1',()=>console.log('Isolated staging identity listener ready.'));
 process.on('SIGTERM',()=>server.close(()=>pool.end().finally(()=>process.exit(0))));
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startIdentity().catch(()=>{console.error('Isolated identity startup blocked: configuration or dedicated database unavailable.');process.exit(1);});
