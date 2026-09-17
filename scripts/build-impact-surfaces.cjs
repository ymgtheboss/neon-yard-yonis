// Render-material labels matched to collision triangles without changing geometry.
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../public/maps');
for(const id of ['subzero','village']){
 const b=fs.readFileSync(path.join(dir,id+'.glb')),len=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+len)),bin=b.subarray(len+28);
 function read(id){const a=g.accessors[id],v=g.bufferViews[a.bufferView],n={VEC3:3,VEC4:4,SCALAR:1}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],fn={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,k)=>bin[fn]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*size)+k*size)));}
 const key=ps=>ps.map(p=>p.map(v=>Math.round(v*10000)).join(',')).sort().join('|'),tags=new Map();
 for(const m of g.meshes)for(const p of m.primitives){const pos=read(p.attributes.POSITION),idx=p.indices===undefined?pos.map((_,i)=>i):read(p.indices).flat(),name=g.materials[p.material]?.name||'',color=p.attributes.COLOR_0===undefined?null:read(p.attributes.COLOR_0);
  for(let i=0;i<idx.length;i+=3){const ids=idx.slice(i,i+3);let tag=/Wood/.test(name)?2:/Metal/.test(name)?3:/Brick/.test(name)?4:/Plaster/.test(name)?5:/Tiles/.test(name)?6:0;
   if(id==='subzero')tag=p.material===0&&color&&ids.every(i=>color[i].slice(0,3).every(v=>v>200))?1:[3,8,9,11,13].includes(p.material)?2:0;
   tags.set(key(ids.map(i=>pos[i])),tag);
  }
 }
 const data=fs.readFileSync(path.join(dir,id+'-collision.bin')),out=Buffer.alloc(data.length/36);
 for(let i=0;i<out.length;i++)out[i]=tags.get(key(Array.from({length:3},(_,j)=>Array.from({length:3},(_,k)=>data.readFloatLE(i*36+j*12+k*4)))))||0;
 fs.writeFileSync(path.join(dir,id+'-impacts.bin'),out);console.log(id,Array.from(new Set(out)).map(t=>[t,out.filter(x=>x===t).length]));
}
