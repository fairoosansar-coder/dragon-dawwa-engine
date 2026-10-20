import type {IncomingMessage,ServerResponse} from 'node:http';
import {extractHadithFromMedia} from './hadithOcrService.ts';
import {transcribeAudioWithGemini} from './geminiAudioTranscribe.ts';
// Development route parity with the existing Express server.
export async function mediaMiddleware(req:IncomingMessage,res:ServerResponse,next:()=>void){
 const path=(req.url||'').split('?')[0];
 if(!['/api/extract-hadith-media','/api/transcribe-audio'].includes(path))return next();
 const send=(status:number,body:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
 if(req.method!=='POST')return send(405,{error:'method_not_allowed'});
 try{
  let body='';for await(const chunk of req){body+=chunk;if(body.length>15000000)return send(413,{error:'payload_too_large'});}
  let b:any;try{b=JSON.parse(body);}catch{return send(400,{error:'invalid_json'});}
  const field=path==='/api/extract-hadith-media'?'file_base64':'audio_base64';
  if(typeof b?.[field]!=='string'||!b[field].trim())return send(400,{error:field+' is required'});
  if(!process.env.GEMINI_API_KEY)return send(503,{error:'The AI media service is not configured in this environment.'});
  const result=path==='/api/extract-hadith-media'?await extractHadithFromMedia(b.file_base64,b.mime_type||'image/jpeg',b.user_notes):await transcribeAudioWithGemini(b.audio_base64,b.mime_type||'audio/webm');
  send(200,result);
 }catch{send(502,{error:'The media service could not complete the request.'});}
}
