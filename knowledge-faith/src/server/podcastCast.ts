// Audio direction belongs to the performance, never to the published transcript.
export const podcastCast = {
  host:   ['xSfzoa4Rf8qe7qNgSiq5', 'warmly', /feroz|ஃபெரோஸ்|பெரோஸ்|ෆෙරෝස්|\bhost\b|^seeker$/i],
  layla:  ['OZ0L6eISlOejga3XjDFt', 'thoughtfully', /layla|qasimi|லய்லா|ලයිලා|passage reader|quran_tafsir/i],
  tariq:  ['Eclv6jJwMbGUhEki9Bro', 'measured', /tariq|mansoor|தாரிக்|තාරික්|hadith_sunnah/i],
  imran:  ['l30f87tf05uxyknGdDw6', 'deliberately', /imran|hasani|இம்ரான்|ඉම්රාන්|isnad_rijal/i],
  farhan: ['bPMKpgEe88vKSwusXTMU', 'reflective', /farhan|rashed|ஃபர்ஹான்|ෆර්හාන්|fiqh_consensus/i],
  amina:  ['ftDdhfYtmfGP0tFlBYA1', 'gently', /amina|kindi|ஆமினா|ආමිනා|linguistic_maqasid/i],
  zainab: ['XfNU2rGpBa01ckF309OY', 'curious', /zainab|mubarak|ஜைனப்|සයිනබ්|modern_science/i],
  yusuf:  ['qxTFXDYbGcR8GaHSjczg', 'reassuring', /yusuf|azhari|யூசுப்|යූසුෆ්|executive_synthesis|^analyst$|^guest$/i],
} as const;
export type CastRole = keyof typeof podcastCast;
export function castRole(label:string):CastRole | undefined {
  return (Object.keys(podcastCast) as CastRole[]).find(k=>k===label || podcastCast[k][2].test(label));
}
export function castInput(role:CastRole, text:string) {
  const [voice_id,direction]=podcastCast[role];
  return {voice_id,text:`[${direction}] ${text.trim()}`};
}
export async function castPcm(role:CastRole,text:string,lang:string):Promise<Buffer> {
  const key=process.env.ELEVENLABS_API_KEY || process.env.LEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
  if (!key) throw new Error('ElevenLabs podcast voices are not connected.');
  const response=await fetch('https://api.elevenlabs.io/v1/text-to-dialogue?output_format=pcm_24000',{
    method:'POST',headers:{'Content-Type':'application/json','xi-api-key':key},signal:AbortSignal.timeout(90000),
    // Eleven v4 rejects explicit "si"; let it infer Sinhala from the unchanged script.
    body:JSON.stringify({model_id:'eleven_v4',...(lang==='si'?{}:{language_code:lang}),inputs:[castInput(role,text)]})
  });
  if(!response.ok) throw new Error(`ElevenLabs podcast voice is unavailable (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<64 || bytes.length%2) throw new Error('Incomplete podcast audio.');
  return bytes;
}
