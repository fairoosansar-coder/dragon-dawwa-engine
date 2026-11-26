const fs=require('node:fs'), path=require('node:path'), {DatabaseSync}=require('node:sqlite');
function install(dir,seed){
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const dest=path.join(dir,'hadeethenc.sqlite');
  // Publish a completely copied database atomically without replacing an existing inode.
  if(!fs.existsSync(dest)){
    const tmp=fs.mkdtempSync(path.join(dir,'.edition-import-'));
    try {
      const f=path.join(tmp,'seed.sqlite');fs.copyFileSync(seed,f);fs.chmodSync(f,0o600);
      try{fs.linkSync(f,dest);}catch(e){if(e.code!=='EEXIST')throw e;}
    }finally{fs.rmSync(tmp,{recursive:true,force:true});}
  }
  // Add missing languages only. Never delete, replace, or downgrade a pre-existing edition.
  const db=new DatabaseSync(dest);
  try{
    db.prepare('ATTACH DATABASE ? AS seed').run(seed);
    db.exec('BEGIN IMMEDIATE');
    db.exec('CREATE TABLE IF NOT EXISTS source_notices(sheet TEXT PRIMARY KEY,banner TEXT NOT NULL)');
    for(const {lang} of db.prepare('SELECT lang FROM seed.import_meta').all()){
      if(db.prepare('SELECT 1 FROM main.import_meta WHERE lang=?').get(lang))continue;
      // Conflicting untracked rows abort the transaction rather than being overwritten.
      db.prepare('INSERT INTO main.hadeeth SELECT * FROM seed.hadeeth WHERE lang=?').run(lang);
      db.prepare('INSERT INTO main.import_meta SELECT * FROM seed.import_meta WHERE lang=?').run(lang);
      db.prepare('INSERT OR IGNORE INTO main.source_notices SELECT * FROM seed.source_notices WHERE sheet=?').run(lang);
    }
    db.exec('COMMIT');
  }finally{db.close();}
}
module.exports={install};
if(require.main===module){
  if(process.env.RAILWAY_SERVICE_ID!=='0f2bc2c5-0d70-4add-b55d-5b711eedce35' ||
     process.env.RAILWAY_ENVIRONMENT_ID!=='1f7d98bf-1d49-4d9f-a5cc-13b57abcc095' ||
     process.env.DD_PERSIST_DIR!=='/app/.data/live' || process.env.HADEETHENC_DB)
    throw Error('Unexpected staging source target');
  install('/app/.data/live/sources','/opt/open-passage/editions.sqlite');
}
