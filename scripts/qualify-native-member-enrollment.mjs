import {spawnSync} from 'node:child_process';
import {generateKeyPairSync,privateDecrypt,constants,createDecipheriv,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,chmodSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import mysql from '../deployment/staging/identity/node_modules/mysql2/promise.js';
import {enrollStagingIdentity} from './enroll-staging-identity.mjs';
const container=process.env.UMMAH_MEMBER_TEST_CONTAINER;
if(process.env.UMMAH_MEMBER_TEST_MODE!=='ephemeral-ci'||!/^ummah-native-ci-[a-z0-9-]+-humhub$/.test(container||''))throw Error('Disposable native CI only.');
const root=mkdtempSync(join(tmpdir(),'ummah-member-ci-'));chmodSync(root,0o700);
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const checks=[];const credentials=[];
function docker(args,expected=0){const r=spawnSync('docker',args,{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});assert.equal(r.status,expected,'Safe disposable operation failed');return r.stdout;}
function db(sql){return docker(['exec',container,'php','-r',`$p=new PDO('mysql:host='.getenv('HUMHUB_DB_HOST').';dbname=ummah_humhub_staging','ummah_humhub_app',getenv('HUMHUB_DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$s=${JSON.stringify(sql)};if(str_starts_with($s,'SELECT'))echo json_encode($p->query($s)->fetchAll(PDO::FETCH_ASSOC));else $p->exec($s);`]);}
function counts(){return JSON.parse(db('SELECT (SELECT COUNT(*) FROM user) users,(SELECT COUNT(*) FROM space_membership) members,(SELECT COUNT(*) FROM ummah_review_grant) grants,(SELECT COUNT(*) FROM rest_user_bearer_tokens) tokens'))[0];}
function input(role,label){return {kind:'verified-ummah-member-enrollment',subjectReference:'google:'+createHash('sha256').update('synthetic-native-ci-'+label).digest('base64url'),email:'member-'+label+'@example.invalid',role,spaceId:1,publicKeyPem:publicKey};}
function run(data){const file=join(root,'input.json');writeFileSync(file,JSON.stringify(data),{mode:0o600});docker(['cp',file,container+':/tmp/ummah-member-ci-input.json']);docker(['exec',container,'chown','www-data:www-data','/tmp/ummah-member-ci-input.json']);docker(['exec',container,'chmod','600','/tmp/ummah-member-ci-input.json']);return spawnSync('docker',['exec','--user','www-data','--env','RAILWAY_SERVICE_ID=e6498121-1725-4d5a-a66f-e0f1091d6d35','--env','UMMAH_INITIALIZE_HUMHUB=no','--env','UMMAH_MEMBER_INPUT_FILE=/tmp/ummah-member-ci-input.json','--env','HUMHUB_ROOT=/var/www/html',container,'php','/tmp/provision-native-member.php'],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});}
function decrypt(envelope){const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.wrappedKey,'base64'));const dec=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));if(envelope.aad)dec.setAAD(Buffer.from(envelope.aad));dec.setAuthTag(Buffer.from(envelope.tag,'base64'));return JSON.parse(Buffer.concat([dec.update(Buffer.from(envelope.ciphertext,'base64')),dec.final()]).toString('utf8'));}
async function request(token,path){const r=await fetch('http://127.0.0.1:3401/api/v1/'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null};}
try {
 const before=counts();
 for(const role of ['author','reviewer']){
  const data=input(role,role);const r=run(data);let output;try{output=JSON.parse(r.stdout.trim().split('\n').at(-1));}catch{}assert.equal(r.status,0,'Native helper rejected: '+(output?.code||'no_safe_code'));const member=decrypt(output.envelope);assert.equal(member.subjectReference,data.subjectReference);assert.equal(member.role,role);assert.equal(typeof member.token,'string');assert.equal(member.token.length,86);assert.ok(Number.isInteger(member.humhubUserId));credentials.push(member);
  assert.equal(r.stdout.includes(member.token),false,'Plain credential output');assert.equal(r.stdout.includes(data.email),false,'Real-identity style output');assert.equal(r.stdout.includes(data.subjectReference),false,'Reference output');
  const me=await request(member.token,'auth/current');assert.equal(me.status,200);assert.equal(Number(me.data.id),member.humhubUserId);
  const posts=await request(member.token,'ummahreview/posts?space=1');assert.equal(posts.status,200);
  assert.equal((await request(member.token,'ummahreview/submissions?space=1')).status,role==='author'?200:403);
  assert.equal((await request(member.token,'ummahreview/reviews?space=1')).status,role==='reviewer'?200:403);
  const snapshot=counts();assert.notEqual(run(data).status,0);assert.deepEqual(counts(),snapshot);checks.push(role+'-narrow-native-role-encrypted-envelope-and-duplicate-refusal');
 }
 const author=credentials.find(x=>x.role==='author');
 const submitted=await fetch('http://127.0.0.1:3401/api/v1/ummahreview/submissions',{method:'POST',headers:{Authorization:'Bearer '+author.token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({spaceId:1,message:'Synthetic enrolled-author qualification; not verified scholarship.',sources:[],requestKey:createHash('sha256').update('enrolled-member-ci-submit').digest('hex')}),redirect:'error',signal:AbortSignal.timeout(10000)});
 assert.equal(submitted.status,200,'Enrolled Author native submission denied');const draft=await submitted.json();assert.equal(draft.state,10);assert.equal(draft.status,'pending');checks.push('enrolled-author-native-submit-draft-first');
 const snapshots=counts();assert.notEqual(run(input('owner','owner-rejected')).status,0);assert.deepEqual(counts(),snapshots);checks.push('owner-role-refused-without-mutation');
 db("CREATE TRIGGER ummah_member_ci_reject BEFORE INSERT ON ummah_review_grant FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ephemeral member rollback probe'");
 try {assert.notEqual(run(input('author','rollback')).status,0);assert.deepEqual(counts(),snapshots);checks.push('real-user-membership-transaction-rollback');} finally {db('DROP TRIGGER ummah_member_ci_reject');}
 assert.equal(Number(counts().users),Number(before.users)+2);assert.equal(Number(counts().members),Number(before.members)+2);assert.equal(Number(counts().grants),Number(before.grants)+2);assert.equal(Number(JSON.parse(db('SELECT COUNT(*) n FROM user_password WHERE user_id IN ('+credentials.map(x=>x.humhubUserId).join(',')+')'))[0].n),0);
 assert.match(process.env.UMMAH_CI_MYSQL_IP||'',/^172\.[0-9.]+$/);
 const identity=await mysql.createConnection({host:process.env.UMMAH_CI_MYSQL_IP,user:'ummah_identity_app',password:process.env.UMMAH_CI_MYSQL_PASSWORD,database:'ummah_identity_staging',multipleStatements:false});
 try {
  const mapPath=join(root,'account-map.json');writeFileSync(mapPath,JSON.stringify({schemaVersion:1,accounts:Object.fromEntries(credentials.map(x=>[x.subjectReference,{enabled:true,disabled:false,humhubUserId:x.humhubUserId,token:x.token}]))}),{mode:0o600});
  for(const member of credentials){
   const inputPath=join(root,'identity-input.json');const enrollment={kind:'verified-ummah-identity-enrollment',subjectReference:member.subjectReference,role:member.role,spaceId:1,operation:'stage'};writeFileSync(inputPath,JSON.stringify(enrollment),{mode:0o600});
   const env={UMMAH_IDENTITY_ENVIRONMENT:'isolated-staging',RAILWAY_PROJECT_ID:'48d7a4cf-07dc-489b-8a3d-d6d10142b14e',RAILWAY_ENVIRONMENT_ID:'1f7d98bf-1d49-4d9f-a5cc-13b57abcc095',RAILWAY_SERVICE_ID:'f3756510-4e87-445b-9cfb-9dad042d6758',REVIEW_DB_NAME:'ummah_identity_staging',REVIEW_DB_USER:'ummah_identity_app',REVIEW_DB_HOST:'identity-ci.railway.internal',REVIEW_DB_PASSWORD:process.env.UMMAH_CI_MYSQL_PASSWORD,REVIEW_PUBLIC_ORIGIN:'https://ummah-app-staging.up.railway.app',UMMAH_PUBLIC_ORIGIN:'https://ummah-app-staging.up.railway.app',HUMHUB_ORIGIN:'https://ummah-humhub-staging.up.railway.app'};
   const nativeFetch=(url,init)=>{assert.equal(new URL(url).origin,env.HUMHUB_ORIGIN);return fetch(String(url).replace(env.HUMHUB_ORIGIN,'http://127.0.0.1:3401'),init);};
   const staged=await enrollStagingIdentity({env,db:identity,inputPath,mapPath,nativeFetch});assert.equal(staged.stage,true);assert.equal(staged.nativeChecksPassed,false);let [rows]=await identity.execute('SELECT disabled,role FROM review_roles WHERE user_id=?',[member.subjectReference]);assert.equal(Number(rows[0].disabled),1);
   enrollment.operation='activate';writeFileSync(inputPath,JSON.stringify(enrollment),{mode:0o600});const activated=await enrollStagingIdentity({env,db:identity,inputPath,mapPath,nativeFetch});assert.equal(activated.activated,true);[rows]=await identity.execute('SELECT disabled,role FROM review_roles WHERE user_id=?',[member.subjectReference]);assert.equal(Number(rows[0].disabled),0);assert.equal(rows[0].role,member.role);checks.push(member.role+'-actual-scoped-identity-mysql-stage-and-activate');
  }
 } finally {await identity.end();}
 console.log(JSON.stringify({kind:'native-real-member-helper-qualification',checks,encryptedEnvelopes:true,noPasswords:true,syntheticDraftOnly:true,noHumanReviewsCreated:true,realGoogleLoginTested:false,humanParticipation:false,hostedEnvironmentContacted:false}));
} finally {rmSync(root,{recursive:true,force:true});}
