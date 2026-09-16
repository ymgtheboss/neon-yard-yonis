'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const dir=path.join(__dirname,'../public/weapons'),{weapons}=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
assert.equal(Object.keys(weapons).length,10);
let bytes=0,source=0;
for(const [id,meta]of Object.entries(weapons)){
 const b=fs.readFileSync(path.join(dir,id+'.glb'));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);assert.deepEqual(zlib.gunzipSync(fs.readFileSync(path.join(dir,id+'.glb.gz'))),b);
 const n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(28+n);assert.equal(j.meshes.length,meta.meshes);assert.ok(meta.credits.author&&meta.credits.license&&meta.credits.source);assert.equal(meta.bytes,b.length);
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];let vertices=0;
 for(const m of j.meshes)for(const p of m.primitives){const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView];for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const f=bin.readFloatLE(v.byteOffset+i*12+k*4);assert.ok(Number.isFinite(f),id+' finite position');lo[k]=Math.min(lo[k],f);hi[k]=Math.max(hi[k],f);}vertices+=a.count;}
 assert.ok(vertices>100);assert.ok(Math.abs(lo[2]-meta.tip)<.001,id+' muzzle end');assert.ok(hi[0]-lo[0]<.4,id+' width/orientation');assert.ok(hi[1]-lo[1]<.65,id+' height');assert.ok(Math.abs(hi[2]-lo[2]-meta.length)<.005,id+' normalized length');
 for(const image of j.images||[])assert.ok(image.bufferView!==undefined&&!image.uri,'embedded texture');
 if(['pistol','rifle','shotgun','sniper','dmr'].includes(id))assert.ok(j.nodes.some(n=>n.name==='bolt'),id+' action geometry');
 if(['revolver','autoshot','smg'].includes(id))assert.ok(j.nodes.some(n=>n.name==='magazine'),id+' detached reload part');
 bytes+=b.length;source+=meta.sourceBytes;
}
assert.ok(bytes<source*.4);console.log('PASS ten optimized GLBs: finite scaled geometry, muzzle orientation, moving parts, embedded textures, credits and gzip integrity');
