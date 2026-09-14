const {spawnSync}=require('node:child_process');
const path=require('node:path');
for(const name of ['engine','client','network']) {
 const r=spawnSync(process.execPath,[path.join(__dirname,name+'.cjs')],{stdio:'inherit'});
 if(r.status!==0)process.exit(r.status||1);
}
