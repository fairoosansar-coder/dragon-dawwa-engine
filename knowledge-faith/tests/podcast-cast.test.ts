import {test} from 'node:test';
import assert from 'node:assert/strict';
import {castRole,castInput,podcastCast,castPcm} from '../src/server/podcastCast.ts';

test('host plus seven distinct researchers, stable across localized display names',()=>{
  const aliases=[
    ['host','Brother Feroz (Host)'],
    ['layla','Dr. Layla al-Qasimi','லய்லா','ලයිලා'],
    ['tariq','Dr. Tariq al-Mansoor','தாரிக்','තාරික්'],
    ['imran','Sheikh Imran al-Hasani','இம்ரான்','ඉම්රාන්'],
    ['farhan','Shaykh Farhan al-Rashed','ஃபர்ஹான்','ෆර්හාන්'],
    ['amina','Dr. Amina al-Kindi','ஆமினா','ආමිනා'],
    ['zainab','Dr. Zainab al-Mubarak','ஜைனப்','සයිනබ්'],
    ['yusuf','Sheikh Yusuf al-Azhari','யூசுப்','යූසුෆ්'],
  ];
  for(const [role,...labels] of aliases)for(const label of labels)assert.equal(castRole(label),role);
  assert.equal(castRole('Unknown speaker'),undefined);
  assert.equal(new Set(Object.values(podcastCast).map(x=>x[0])).size,8);
  assert.equal(castInput('host','Welcome.').voice_id,'xSfzoa4Rf8qe7qNgSiq5');
});

test('Sinhala omits the unsupported language code; English and Tamil still send theirs',async t=>{
  const requests: RequestInit[] = [];
  t.mock.method(globalThis,'fetch',async (_url:string, options:RequestInit)=>{
    requests.push(options);
    return new Response(new Uint8Array(128));
  });
  const old=process.env.ELEVENLABS_API_KEY; process.env.ELEVENLABS_API_KEY='fixture';
  try {
    for(const [lang,text] of [['si','ඇත්තටම මොකද වුණේ?'],['ta','என்ன நடந்தது?'],['en','What happened?']]){
      await castPcm('host',text,lang);
      const body=JSON.parse(String(requests.at(-1)?.body));
      assert.equal(body.model_id,'eleven_v4');
      assert.deepEqual(body.inputs,[{voice_id:'xSfzoa4Rf8qe7qNgSiq5',text:`[warmly] ${text}`}]);
      if(lang==='si') assert.equal(Object.hasOwn(body,'language_code'),false);
      else assert.equal(body.language_code,lang);
    }
    assert.equal(requests.length,3);
  } finally { if(old===undefined) delete process.env.ELEVENLABS_API_KEY;else process.env.ELEVENLABS_API_KEY=old; }
});

test('v4 receives the role, direction and selected language; refusal never substitutes another voice',async t=>{
  t.mock.method(globalThis,'fetch',async (_url:string,options:RequestInit)=>{
    const body=JSON.parse(String(options.body));
    assert.equal(body.model_id,'eleven_v4');
    assert.equal(body.language_code,'ta');
    assert.deepEqual(body.inputs,[{voice_id:podcastCast.zainab[0],text:'[curious] ஏன்?'}]);
    return new Response(null,{status:403});
  });
  const old=process.env.ELEVENLABS_API_KEY;process.env.ELEVENLABS_API_KEY='fixture';
  try{await assert.rejects(castPcm('zainab','ஏன்?','ta'),/403/);}
  finally{if(old===undefined) delete process.env.ELEVENLABS_API_KEY;else process.env.ELEVENLABS_API_KEY=old;}
});
