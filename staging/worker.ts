// Staging runtime for the SAME application and service functions. No production proxy.
import assets from './assets.generated';
import { ummahQuranMiddleware } from '../src/server/ummahQuran';
import { ummahStudyMiddleware } from '../src/server/ummahStudy';
import { executeDragonDawwaAnalysis } from '../src/server/hadithEngine';
import { synthesizeGeminiVoice } from '../src/server/geminiTtsService';
import { extractHadithFromMedia } from '../src/server/hadithOcrService';
import { transcribeAudioWithGemini } from '../src/server/geminiAudioTranscribe';
import { createSocialMiddleware } from '../src/server/socialGateway';
type Env={GEMINI_API_KEY?:string;UMMAH_API_KEY?:string};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function middleware(fn:any,request:Request,key?:string){
 let response:Response|undefined;const headers=new Headers();const res={statusCode:200,setHeader:(k:string,v:string)=>headers.set(k,v),end:(body:string)=>{response=new Response(body,{status:res.statusCode,headers});}};
 const url=new URL(request.url);await fn({url:url.pathname+url.search,method:request.method},res,()=>{},key);return response;
}
export default { async fetch(request:Request,env:Env){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/health')return json({status:'online',environment:'isolated-staging',hasKey:!!env.GEMINI_API_KEY,social:'account-link-pending',payments:false});
 if(path.startsWith('/api/social/'))return await middleware(createSocialMiddleware(),request)||json({error:'not_found'},404);
 if(path.startsWith('/api/quran-audio/'))return await middleware(ummahQuranMiddleware,request,env.UMMAH_API_KEY)||json({error:'not_found'},404);
 if(path.startsWith('/api/quran-study/'))return await middleware(ummahStudyMiddleware,request,env.UMMAH_API_KEY)||json({error:'not_found'},404);
 if(path.startsWith('/api/')){
  if(!['/api/analyze','/api/tts','/api/extract-hadith-media','/api/transcribe-audio'].includes(path))return json({error:'not_found'},404);
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(new URL(request.headers.get('Origin')||request.url).origin!==url.origin)return json({error:'origin_not_allowed'},403);
  if(!env.GEMINI_API_KEY)return json({error:'This isolated staging environment has no AI service key. No research or audio was generated.'},503);
  if(Number(request.headers.get('Content-Length')||0)>15000000)return json({error:'payload_too_large'},413);
  try{
   const raw=await request.text();if(raw.length>15000000)return json({error:'payload_too_large'},413);const b=JSON.parse(raw);
   const required=path==='/api/analyze'?'hadith_input':path==='/api/tts'?'text':path==='/api/extract-hadith-media'?'file_base64':'audio_base64';
   if(typeof b[required]!=='string'||!b[required].trim())return json({error:required+' is required'},400);
   if(path==='/api/analyze')return json(await executeDragonDawwaAnalysis(b.hadith_input,b.isnad_input,['ta','si'].includes(b.preferred_language)?b.preferred_language:'en',env.GEMINI_API_KEY));
   if(path==='/api/tts')return json(await synthesizeGeminiVoice(b.text,b.speaker||'Host',b.voiceName,env.GEMINI_API_KEY));
   if(path==='/api/extract-hadith-media')return json(await extractHadithFromMedia(b.file_base64,b.mime_type||'image/jpeg',b.user_notes,env.GEMINI_API_KEY));
   return json(await transcribeAudioWithGemini(b.audio_base64,b.mime_type||'audio/webm',env.GEMINI_API_KEY));
  }catch{return json({error:'The service could not complete this request. No result is asserted.'},502);}
 }
 if(!['GET','HEAD'].includes(request.method))return json({error:'method_not_allowed'},405);
 const asset=(assets as Record<string,{mime:string;data:string}>)[path==='/'?'/index.html':path]||(!path.includes('.')?(assets as any)['/index.html']:null);
 if(!asset)return new Response('Not found',{status:404});
 const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.mime,'Cache-Control':path.includes('/assets/')?'public, max-age=3600':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}};
