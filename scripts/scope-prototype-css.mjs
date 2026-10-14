import {readFile,writeFile,unlink} from 'node:fs/promises';
import postcss from 'postcss';
const file='src/ummah/prototype.raw.css';
const root=postcss.parse(await readFile(file,'utf8'));
root.walkRules(rule=>{if(rule.parent?.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;rule.selectors=rule.selectors.map(s=>s.trim()===':root'?'.uc-root':'.uc-template '+s);});
await writeFile('src/ummah/prototype.css',root.toString());await unlink(file);
