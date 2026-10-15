import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Parser=require('../../verification-tools/node_modules/php-parser');
const parser=new Parser({parser:{phpVersion:'8.3'},ast:{withPositions:true}});
const dir='integrations/social/humhub-ummahreview';let count=0;
function walk(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,x.name);if(x.isDirectory())walk(p);else if(p.endsWith('.php')){parser.parseCode(fs.readFileSync(p,'utf8'),p);console.log('PHP syntax parsed:',p);count++;}}}
walk(dir);console.log('Parsed files:',count,'— syntax only; NOT php -l, real PHP execution or HumHub/MySQL qualification.');
