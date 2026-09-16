// Match render triangles to the original Subzero collision triangles. Geometry stays unchanged.
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../public/maps'),b=fs.readFileSync(path.join(dir,'subzero.glb')),n=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+n)),bin=b.subarray(n+28);
function read(id){const a=g.accessors[id],v=g.bufferViews[a.bufferView],s={VEC3:3,VEC4:4,SCALAR:1}[a.type],bytes={5121:1,5123:2,5125:4,5126:4}[a.componentType],fn={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];return Array.from({length:a.count},(_,i)=>Array.from({length:s},(_,k)=>bin[fn]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||s*bytes)+k*bytes)));}
const key=points=>points.map(p=>p.map(v=>Math.round(v*10000)).join(',')).sort().join('|'),tags=new Map();
for(const m of g.meshes)for(const p of m.primitives){const positions=read(p.attributes.POSITION),indices=read(p.indices).flat(),colors=read(p.attributes.COLOR_0);for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),white=ids.every(id=>colors[id].slice(0,3).every(v=>v>200));const surface=p.material===0&&white?1:[3,8,9,11,13].includes(p.material)?2:0;tags.set(key(ids.map(id=>positions[id])),surface);}}
const data=fs.readFileSync(path.join(dir,'subzero-collision.bin')),out=Buffer.alloc(data.length/36);
for(let i=0;i<out.length;i++){const points=Array.from({length:3},(_,j)=>Array.from({length:3},(_,k)=>data.readFloatLE(i*36+j*12+k*4)));out[i]=tags.get(key(points))||0;}
fs.writeFileSync(path.join(dir,'subzero-surfaces.bin'),out);console.log('Tagged',out.length,'triangles:',[0,1,2].map(t=>out.filter(v=>v===t).length));
