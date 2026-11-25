// Private staging bootstrap. Only the hashes of the approved snapshots are pinned here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const OLD = '5505fd8665b5b9948d36902f4955f7ca4d195a7efe03248d81f049fd66f5a272';
const CURRENT = '60398f817d3067da64aa4f794b10a97fe3d7d463c3080c367a8ae12e586d3092';
const root = '/app/.data';
const live = path.join(root, 'live');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const requireOk = (ok, msg) => { if (!ok) throw Error(msg); };
function checkDatabase(dir) {
  const db = new DatabaseSync(path.join(dir, 'gate.sqlite'), { readOnly:true });
  try {
    requireOk(db.prepare('PRAGMA integrity_check').get().integrity_check === 'ok', 'ledger corruption');
    requireOk(db.prepare('select count(*) n from passes').get().n > 0, 'empty recovered ledger');
  } finally { db.close(); }
  requireOk(fs.statSync(path.join(dir,'.staging-signing')).size > 0, 'missing signing material');
}
function restore(dir, old, current) {
  for (const d of [old,current]) {
    for (const e of JSON.parse(fs.readFileSync(path.join(d,'manifest.json'),'utf8'))) {
      requireOk(/^(data|reports)\//.test(e.file) && !e.file.split('/').includes('..'), 'invalid manifest path');
      requireOk(hash(fs.readFileSync(path.join(d,e.file))) === e.sha256, 'snapshot content mismatch');
    }
  }
  fs.cpSync(path.join(current,'data'),dir,{recursive:true,errorOnExist:true,force:false});
  checkDatabase(dir);
  requireOk(fs.readFileSync(path.join(dir,'.staging-signing')).equals(fs.readFileSync(path.join(old,'data/.staging-signing'))),'signer mismatch');
  const reports = path.join(dir,'recovered-reports');
  fs.mkdirSync(reports,{mode:0o700});
  for (const d of [old,current]) for (const n of fs.readdirSync(path.join(d,'reports'))) {
    requireOk(/^[\w-]+\.json$/.test(n),'invalid report name');
    const bytes = fs.readFileSync(path.join(d,'reports',n));
    const j = JSON.parse(bytes);
    if (j.result && Array.isArray(j.sources)) fs.writeFileSync(path.join(reports,n),bytes,{mode:0o600});
  }
  requireOk(fs.readdirSync(reports).length > 0,'no completed report exports');
  fs.writeFileSync(path.join(dir,'.restore-complete'),CURRENT,{mode:0o600});
}
async function start() {
  process.umask(0o077);
  requireOk(process.env.RAILWAY_SERVICE_ID === '0f2bc2c5-0d70-4add-b55d-5b711eedce35' &&
    process.env.RAILWAY_ENVIRONMENT_ID === '1f7d98bf-1d49-4d9f-a5cc-13b57abcc095','unexpected staging target');
  requireOk(fs.readFileSync('/proc/self/mountinfo','utf8').split('\n').some(l=>l.split(' ')[4]===root),'missing staging data mount');
  fs.chmodSync(root,0o711);
  if (!fs.existsSync(live)) {
    requireOk(fs.readdirSync(root).every(n=>n==='lost+found' || n.startsWith('.bootstrap-')), 'unexpected volume contents');
    const tmp=fs.mkdtempSync(path.join(root,'.bootstrap-'));
    const client=new S3Client({endpoint:'https://t3.storageapi.dev',region:'auto',forcePathStyle:true,credentials:{
      accessKeyId:process.env.OP_RESTORE_ACCESS_KEY_ID,secretAccessKey:process.env.OP_RESTORE_SECRET_ACCESS_KEY}});
    try {
      for (const [label,sha] of [['old',OLD],['current',CURRENT]]) {
        const r=await client.send(new GetObjectCommand({Bucket:'open-passage-staging-recovery-q-c978',Key:`snapshots/${sha}.tar.gz`}));
        const b=Buffer.from(await r.Body.transformToByteArray());
        requireOk(hash(b)===sha,'archive readback mismatch');
        const d=path.join(tmp,label); fs.mkdirSync(d);
        execFileSync('tar',['-xz','-C',d,'--no-same-owner'],{input:b});
      }
      const candidate=path.join(tmp,'candidate');
      restore(candidate,path.join(tmp,'old'),path.join(tmp,'current'));
      execFileSync('chown',['-R','node:node',candidate]);
      fs.renameSync(candidate,live);
    } finally {client.destroy();fs.rmSync(tmp,{recursive:true,force:true});}
  }
  requireOk(fs.readFileSync(path.join(live,'.restore-complete'),'utf8')===CURRENT,'unknown restore marker');
  checkDatabase(live);
  console.log('STAGING_VOLUME_READY: restored ledger and reports verified');
}
module.exports={restore};
if(require.main===module) start().catch(e=>{console.error('STAGING_RESTORE_STOPPED',e.name, String(e.message).replace(/AKIA[A-Z0-9]+/g,'[redacted]'));process.exitCode=1;});
