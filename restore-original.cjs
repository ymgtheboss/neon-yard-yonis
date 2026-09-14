'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,names=['server.cjs','index.html','package.json','package-lock.json'];
for(const n of names)if(!fs.existsSync(path.join(root,'original-backup',n)))throw Error('Original backup is missing '+n);
const backup=path.join(root,'backup-before-restore-'+Date.now());fs.mkdirSync(backup);
for(const n of names)fs.copyFileSync(path.join(root,n),path.join(backup,n));
try{for(const n of names)fs.copyFileSync(path.join(root,'original-backup',n),path.join(root,n));}
catch(error){for(const n of names)fs.copyFileSync(path.join(backup,n),path.join(root,n));throw error;}
console.log('Original game restored. Your upgraded files are backed up in '+path.basename(backup));
console.log('Run: node server.cjs');
