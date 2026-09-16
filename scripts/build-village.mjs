// Build Bellhaven from the user-supplied Quaternius modular village pack.
// Usage: node scripts/build-village.mjs /path/to/Medieval-Village.zip
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import zlib from 'node:zlib';import {execFileSync} from 'node:child_process';
import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import collisionModule from '../map-collision.cjs';const {MapCollision}=collisionModule;
globalThis.ProgressEvent=class{constructor(type,init){Object.assign(this,init);}};
const source=process.argv[2]||path.join(os.homedir(),'Downloads/Medieval Village MegaKit[Standard].zip'),src='/tmp/neon-village-build',dest='public/maps';fs.mkdirSync(dest,{recursive:true});
execFileSync('python3',['-c',`import zipfile,pathlib,sys
out=pathlib.Path(sys.argv[2]);out.mkdir(exist_ok=True)
with zipfile.ZipFile(sys.argv[1]) as z:
 for n in z.namelist():
  if n.endswith('/'):continue
  if '/gltf/' in n.lower() or n.endswith('License_Standard.txt'):
   (out/pathlib.PurePosixPath(n).name).write_bytes(z.read(n))`,source,src]);
const templates=new Map(),roofHulls=new Map(),materials=[],materialKeys=new Map(),images=[],imageKeys=new Map(),textures=[],textureKeys=new Map(),batches=new Map(),collision=[],placements=[],buildings=[],routes=[],ramps=[];
function imageId(uri){const name=path.basename(uri);if(!imageKeys.has(name)){imageKeys.set(name,images.length);images.push(name);}return imageKeys.get(name);}
function texId(t,j){const im=imageId(j.images[j.textures[t].source].uri);if(!textureKeys.has(im)){textureKeys.set(im,textures.length);textures.push({source:im,sampler:0});}return textureKeys.get(im);}
function matId(m,j){const copy=structuredClone(m);for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])if(copy[key])copy[key].index=texId(copy[key].index,j);for(const key of ['baseColorTexture','metallicRoughnessTexture'])if(copy.pbrMetallicRoughness?.[key])copy.pbrMetallicRoughness[key].index=texId(copy.pbrMetallicRoughness[key].index,j);copy.doubleSided=true;const key=JSON.stringify(copy);if(!materialKeys.has(key)){materialKeys.set(key,materials.length);materials.push(copy);}return materialKeys.get(key);}
async function load(name){if(templates.has(name))return templates.get(name);const j=JSON.parse(fs.readFileSync(path.join(src,name+'.gltf'))),stripped=structuredClone(j);const mats=j.materials.map(m=>matId(m,j));stripped.images=[];stripped.textures=[];stripped.materials=j.materials.map((m,i)=>({name:'m'+i}));for(const b of stripped.buffers)b.uri='data:application/octet-stream;base64,'+fs.readFileSync(path.join(src,path.basename(b.uri))).toString('base64');
 const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(stripped),'');scene.updateMatrixWorld(true);const result=[];scene.traverse(o=>{if(!o.isMesh)return;const g=new THREE.BufferGeometry();for(const name of ['position','normal','uv'])if(o.geometry.attributes[name])g.setAttribute(name,o.geometry.attributes[name].clone());if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(o.geometry.index)g.setIndex(o.geometry.index.clone());g.applyMatrix4(o.matrixWorld);result.push({geo:g,material:mats[Number(o.material.name.slice(1))]});});templates.set(name,result);return result;}
const needed=['Wall_Plaster_Straight','Wall_UnevenBrick_Straight','Wall_Plaster_Window_Wide_Flat','Wall_UnevenBrick_Window_Wide_Flat','Wall_Plaster_Door_Round','Door_1_Round','DoorFrame_Round_WoodDark','Wall_Arch','Roof_RoundTiles_8x14','Roof_RoundTiles_6x10','Roof_Tower_RoundTiles','Roof_Front_Brick8','Roof_Front_Brick6','Roof_Front_Brick4','Floor_UnevenBrick','Floor_Brick','Floor_WoodDark','Prop_Chimney','Prop_Chimney2','Prop_Crate','Prop_Wagon','Prop_Vine1','Prop_Vine2','Prop_Vine4','Prop_WoodenFence_Single','WindowShutters_Wide_Flat_Open','WindowShutters_Wide_Flat_Closed','Balcony_Cross_Straight','Stairs_Exterior_Straight','Prop_ExteriorBorder_Straight1','Prop_Support'];
for(const name of needed)await load(name);
function addTriangles(g){const p=g.attributes.position,ix=g.index;for(let i=0;i<(ix?ix.count:p.count);i+=3){const vs=[];for(let k=0;k<3;k++){const n=ix?ix.getX(i+k):i+k;vs.push(new THREE.Vector3().fromBufferAttribute(p,n));}if(new THREE.Triangle(...vs).getArea()>1e-7)collision.push(...vs.flatMap(v=>v.toArray()));}}
function bake(g,material,matrix,solid=true,tint=[1,1,1]){const geo=g.clone().applyMatrix4(matrix);const colors=[];for(let i=0;i<geo.attributes.position.count;i++){const y=geo.attributes.position.getY(i),normal=geo.attributes.normal.getY(i);const ao=.78+.22*Math.min(1,Math.max(0,y)/1.5);colors.push(...tint.map(c=>c*ao*(normal<-.3?.77:1)));}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeBoundingBox();const center=geo.boundingBox.getCenter(new THREE.Vector3()),key=material+':'+Math.floor(center.x/24)+':'+Math.floor(center.z/24);if(!batches.has(key))batches.set(key,{material,geos:[]});batches.get(key).geos.push(geo);if(solid)addTriangles(geo);}
function put(name,x,y,z,ry=0,sx=1,sy=sx,sz=sx,solid=true,tint=[1,1,1]){const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry,0)),new THREE.Vector3(sx,sy,sz));const roof=solid&&name.startsWith('Roof_');for(const p of templates.get(name))bake(p.geo,p.material,matrix,solid&&!roof,tint);
 if(roof){if(!roofHulls.has(name)){const points=[];for(const p of templates.get(name)){const a=p.geo.attributes.position;for(let n=0;n<a.count;n++)points.push(new THREE.Vector3().fromBufferAttribute(a,n));}roofHulls.set(name,new ConvexGeometry(points));}addTriangles(roofHulls.get(name).clone().applyMatrix4(matrix));}
 placements.push({name,x,y,z,ry,sx,sy,sz});}
function plain(color,roughness=1){const name='custom-'+color;if(!materialKeys.has(name)){materialKeys.set(name,materials.length);materials.push({name,pbrMetallicRoughness:{baseColorFactor:[...new THREE.Color(color).toArray(),1],metallicFactor:0,roughnessFactor:roughness},doubleSided:true});}return materialKeys.get(name);}
function box(x,y,z,w,h,d,color,solid=true){bake(new THREE.BoxGeometry(w,h,d),plain(color),new THREE.Matrix4().makeTranslation(x,y+h/2,z),solid);}
function colBox(x,y,z,w,h,d){addTriangles(new THREE.BoxGeometry(w,h,d).translate(x,y+h/2,z));}
// Continuous collision floor. Rendered tiles sit flush, avoiding seams in locomotion.
const ground=new THREE.PlaneGeometry(120,120).rotateX(-Math.PI/2);addTriangles(ground);
for(let x=-58;x<60;x+=4)for(let z=-58;z<60;z+=4){const street=Math.abs(x)<10||Math.abs(Math.abs(x)-34)<7||Math.abs(z)<5||Math.abs(Math.abs(z)-30)<4;const t=.92+((Math.abs(x*13+z*17)%11)/110);put(street?'Floor_Brick':'Floor_UnevenBrick',x,-.02,z,0,2,1,2,false,[t,street?t*.96:t,street?t*.88:t*.95]);}
// Low, continuous town wall; silhouettes beyond it suggest a larger world.
for(let n=-59;n<60;n+=2){for(const [x,z,r]of [[n,-59,0],[n,59,Math.PI],[-59,n,Math.PI/2],[59,n,-Math.PI/2]])put('Wall_UnevenBrick_Straight',x,0,z,r,1,1.28,1,true,[.84,.9,.88]);}
const palettes=[[1,.96,.85],[.91,.96,1],[1,.88,.72],[.84,.96,.84],[.94,.86,.79],[.86,.9,1]];
let buildingIndex=0;
function house(x,z,w,d,floors,open=false,tint=palettes[buildingIndex++%palettes.length]){
 buildings.push({x,z,w,d,floors,open});const floorH=3.08;
 // Two smaller ridges over a broad block create a varied street of attached houses.
 const faces=[{cx:x,cz:z-d/2,len:w,r:0},{cx:x,cz:z+d/2,len:w,r:Math.PI},{cx:x-w/2,cz:z,len:d,r:Math.PI/2},{cx:x+w/2,cz:z,len:d,r:-Math.PI/2}];
 for(let level=0;level<floors;level++)for(const [faceIndex,f]of faces.entries())for(let n=0;n<f.len/2;n++){
  const offset=-f.len/2+1+n*2,px=f.cx+Math.cos(f.r)*offset,pz=f.cz-Math.sin(f.r)*offset;
  const door=level===0&&n===Math.floor(f.len/4)&&(faceIndex===0||faceIndex===1),window=!door&&(n%3===1||level>0&&n%2===0);
  let name=door?'Wall_Plaster_Door_Round':window?(level?'Wall_Plaster_Window_Wide_Flat':'Wall_UnevenBrick_Window_Wide_Flat'):level?'Wall_Plaster_Straight':'Wall_UnevenBrick_Straight';
  put(name,px,level*floorH,pz,f.r,1,1,1,open,tint);
  if(door){put('DoorFrame_Round_WoodDark',px,0,pz,f.r,1,1,1,open);if(!open)put('Door_1_Round',px,0,pz,f.r,1,1,1,false);}
  if(window)put(open?'WindowShutters_Wide_Flat_Open':'WindowShutters_Wide_Flat_Closed',px,level*floorH,pz,f.r,1,1,1,open);
 }
 if(!open)colBox(x,0,z,w+.6, floors*floorH+.04,d+.6);
 for(let level=1;level<=floors;level++){// Ceilings are solid even in buildings with accessible ground floors.
  box(x,level*floorH-.14,z,w,.14,d,'#574330',open);
 }
 const roofY=floors*floorH;
 for(const dx of [-w/4,w/4]){
  put('Roof_RoundTiles_8x14',x+dx,roofY,z,0,w/16,.85,d/14,true,[.94,.83,.72]);
  for(const side of [-1,1])put('Roof_Front_Brick8',x+dx,roofY,z+side*d/2,side===1?0:Math.PI,w/16,.85,1,false,tint);
 }
 put(buildingIndex%2?'Prop_Chimney':'Prop_Chimney2',x-w*.21,roofY+1,z+d*.22,0,1.1,1.1,1.1,false);
 for(const side of [-1,1])put('Prop_Vine'+(buildingIndex%2?'1':'2'),x+side*(w/2-.4),.1,z-d/2-.08,0,1,1,1,false,[.8,1,.7]);
}
// Four blocks along each flank. Closed buildings define cover and block long rays.
for(const [col,x]of [-48,-20,20,48].entries())for(const [row,z]of [-45,-16,16,45].entries()){
 const open=(x===-20&&z===-16)||(x===20&&z===16);
 house(x,z,18,22,(col+row)%3===0?2:1,open);
}
// Bell tower anchors the center; four openings provide a circulation loop around it.
for(let level=0;level<3;level++)for(const [x,z,r]of [[0,-2,0],[0,2,Math.PI],[-2,0,Math.PI/2],[2,0,-Math.PI/2]]){
 for(const offset of [-1,1])put(level===0?'Wall_Arch':'Wall_Plaster_Window_Wide_Flat',x+Math.cos(r)*offset,level*3.08,z-Math.sin(r)*offset,r,1,1,1,true,[.95,.9,.75]);
}
box(0,2.95,0,4,.16,4,'#56452e');put('Roof_Tower_RoundTiles',0,9.2,0,0,1,1,1,true,[.84,.94,.84]);
// Two smaller gatehouses break the central avenue into three encounters.
for(const z of [-43,43]){house(0,z,6,10,1,false,[.9,.94,1]);put('Prop_Wagon',z<0?-7:7,0,z+7,Math.PI/2,1.2,1.2,1.2,true);}
// Market canopies and low shop counters: waist-high cover with clear upper sightlines.
for(const [x,z,color]of [[-7,-15,'#a35a3a'],[7,-15,'#396c67'],[-7,15,'#a38a40'],[7,15,'#475c83'],[-6,-29,'#396c67'],[6,29,'#a35a3a']]){
 box(x,0,z,3.4,.78,1.5,'#745338');for(const dx of [-1.7,1.7])for(const dz of [-.8,.8])box(x+dx,0,z+dz,.09,2.55,.09,'#493623');
 const roof=new THREE.PlaneGeometry(3.8,2.2).rotateX(-Math.PI/2);bake(roof,plain(color),new THREE.Matrix4().makeTranslation(x,2.55,z),false);
 put('Prop_Crate',x+.6,.78,z,0,.55,.55,.55,true);
}
// Wagon/chest cover alternates sides, keeping the flank lanes from becoming firing tunnels.
for(const x of [-34,34])for(const [i,z]of [-48,-19,12,43].entries()){
 const cx=x+(i%2?2.1:-2.1);put('Prop_Wagon',cx,0,z,(i%2?-.16:.18),1.15,1.15,1.15,true);
 for(let n=0;n<3;n++)put('Prop_Crate',cx+(x<0?2:-2),n===2?1.02:0,z+(n%2)*1.1,0,1,1,1,true);
}
// Upper balconies with visible, smooth ramp collision beneath the actual stair treads.
function stairs(x,z,heading){const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),heading),matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,0,z),q,new THREE.Vector3(1,1,1));
 for(let i=0;i<3;i++){const p=new THREE.Vector3(0,i,-1-i*2).applyMatrix4(matrix);put('Stairs_Exterior_Straight',p.x,p.y,p.z,heading,1,1,1,false);}
 const vs=[[-1,0,0],[1,0,0],[1,3,-6],[-1,3,-6]].map(v=>new THREE.Vector3(...v).applyMatrix4(matrix));collision.push(...[0,1,2,0,2,3].flatMap(i=>vs[i].toArray()));
 const bottomLeft=new THREE.Vector3(-1,0,-6).applyMatrix4(matrix),bottomRight=new THREE.Vector3(1,0,-6).applyMatrix4(matrix);
 for(const tri of [[vs[0],vs[3],bottomLeft],[vs[1],bottomRight,vs[2]],[bottomLeft,vs[3],vs[2]],[bottomLeft,vs[2],bottomRight]])collision.push(...tri.flatMap(v=>v.toArray()));
 ramps.push({x,z,heading,run:6,rise:3});
 const top=new THREE.Vector3(0,3,-7).applyMatrix4(matrix);box(top.x,2.95,top.z,4,.13,2,'#5d4832');
 for(const side of [-1,1]){const p=new THREE.Vector3(side*2,3,-7).applyMatrix4(matrix);const r=heading+side*Math.PI/2;put('Balcony_Cross_Straight',p.x-Math.sin(r),3,p.z-Math.cos(r),r,1,1,1,true);}
for(const offset of [-1,1]){const p=new THREE.Vector3(offset,3,-8).applyMatrix4(matrix);put('Balcony_Cross_Straight',p.x-Math.sin(heading),3,p.z-Math.cos(heading),heading,1,1,1,true);}
}
stairs(-9,-4,0);stairs(9,4,Math.PI);
// Garden accents are visual only; their masonry planters provide readable collision.
for(const [x,z]of [[-8,7],[8,-7],[-34,30],[34,-30],[-54,0],[54,0]]){
 box(x,0,z,3.6,.6,2.4,'#7d8273');box(x,.6,z,3.2,.05,2,'#405641',false);
 for(let n=0;n<5;n++){const g=new THREE.IcosahedronGeometry(.6,1);bake(g,plain(n%2?'#557543':'#738747'),new THREE.Matrix4().makeTranslation(x-1.2+n*.6,1,z+(n%2?.35:-.3)),false);}
}
// Trees sit in enclosed edge gardens; open streets remain free of foliage collision.
for(const x of [-56,56])for(const z of [-31,31]){box(x,0,z,1.8,.55,2.5,'#777d6b');box(x,.55,z,.25,3.5,.25,'#6f5136');for(const [y,r]of [[3.5,1.5],[4.8,1.25],[5.8,.8]])bake(new THREE.IcosahedronGeometry(r,1),plain('#647949'),new THREE.Matrix4().makeTranslation(x,y,z),false);}
// Pack static batches by material and 24m neighborhood for frustum culling.
const out={asset:{version:'2.0',generator:'Bellhaven modular arena compiler',extras:{author:'Quaternius / layout by Neon Yard',license:'CC0 1.0',source:'https://quaternius.com/packs/medievalvillagemegakit.html'}},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials,textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],images:[],accessors:[],bufferViews:[],buffers:[]};
const chunks=[];let length=0;function view(b){const padded=Buffer.alloc(Math.ceil(b.length/4)*4);b.copy(padded);const id=out.bufferViews.length;out.bufferViews.push({buffer:0,byteOffset:length,byteLength:b.length});chunks.push(padded);length+=padded.length;return id;}
function attr(a,type){const id=out.accessors.length;const v={bufferView:view(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)),componentType:a.array instanceof Float32Array?5126:a.array instanceof Uint16Array?5123:5125,count:a.count,type};if(type==='VEC3'){v.min=[0,1,2].map(k=>{let v=Infinity;for(let i=k;i<a.array.length;i+=3)v=Math.min(v,a.array[i]);return v;});v.max=[0,1,2].map(k=>{let v=-Infinity;for(let i=k;i<a.array.length;i+=3)v=Math.max(v,a.array[i]);return v;});}out.accessors.push(v);return id;}
let triangles=0;
for(const [key,b]of batches){const indexed=b.geos.every(g=>g.index);const geo=mergeGeometries(indexed?b.geos:b.geos.map(g=>g.index?g.toNonIndexed():g));const primitive={attributes:{POSITION:attr(geo.attributes.position,'VEC3'),NORMAL:attr(geo.attributes.normal,'VEC3'),TEXCOORD_0:attr(geo.attributes.uv,'VEC2'),COLOR_0:attr(geo.attributes.color,'VEC3')},material:b.material};if(geo.index)primitive.indices=attr(geo.index,'SCALAR');triangles+=(geo.index?.count||geo.attributes.position.count)/3;out.scenes[0].nodes.push(out.nodes.length);out.nodes.push({name:key,mesh:out.meshes.length});out.meshes.push({primitives:[primitive]});}
for(const im of images)out.images.push({mimeType:'image/png',bufferView:view(fs.readFileSync(path.join(src,im)))});
out.buffers=[{byteLength:length}];const json=Buffer.from(JSON.stringify(out)),jp=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(jp);const h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+jp.length+length,8);h.writeUInt32LE(jp.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(dest+'/village.glb',Buffer.concat([h,jp,bh,...chunks]));
execFileSync('python3',['scripts/optimize-weapon-textures.py',dest+'/village.glb']);fs.writeFileSync(dest+'/village-collision.bin',Buffer.from(new Float32Array(collision).buffer));
for(const file of ['village.glb','village-collision.bin'])fs.writeFileSync(dest+'/'+file+'.gz',zlib.gzipSync(fs.readFileSync(dest+'/'+file),{level:9}));
const c=new MapCollision(new Float32Array(collision));const candidates=[[-34,-54],[34,54],[-34,54],[34,-54],[-8,-54],[8,54],[-54,-31],[54,31],[-34,-30],[34,30],[-34,0],[34,0],[-8,30],[8,-30],[-8,-22],[8,22]];
const SPAWNS=candidates.map(([x,z])=>{const y=c.support(x,z,2,3);if(!Number.isFinite(y)||c.blocked(x,y,z))throw Error('Invalid village spawn '+[x,z,y]);return [x,z,y];});
const AREAS=[{name:'BELL MARKET',x:0,z:0,w:22,d:64},{name:'NORTH GATE',x:0,z:-45,w:120,d:30},{name:'SOUTH GATE',x:0,z:45,w:120,d:30},{name:'COOPER STREET',x:-35,z:0,w:45,d:60},{name:'GARDEN WALK',x:35,z:0,w:45,d:60}];
const world={BLOCKS:[],DECOR:[],PROPS:[],AREAS,SPAWNS,MAP:{id:'village',name:'Bellhaven',url:'/maps/village.glb',collisionUrl:'/maps/village-collision.bin',bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},killY:-8,attribution:'Medieval Village MegaKit by Quaternius • CC0 • Bellhaven arena layout',source:'https://quaternius.com/packs/medievalvillagemegakit.html',sky:'#c9d9da',fogNear:75,fogFar:170,shadows:true,overview:'/maps/village-overview.svg',signs:[{text:'BELL MARKET',x:0,y:2.5,z:2.08,ry:0,width:3.2},{text:'COOPER STREET',x:-20,y:2.5,z:-4.8,ry:0,width:4},{text:'GARDEN WALK',x:20,y:2.5,z:4.8,ry:Math.PI,width:4}]}};fs.writeFileSync(dest+'/village-world.json',JSON.stringify(world,null,2)+'\n');
let walkable=0;for(let x=-59.5;x<60;x++)for(let z=-59.5;z<60;z++){const y=c.support(x,z,2.7,4);if(Number.isFinite(y)&&!c.blocked(x,y,z))walkable++;}
const report={name:'Bellhaven',boundsArea:14400,subzeroBoundsArea:7056,boundsAreaRatio:14400/7056,supportedLowerLevelCells:walkable,renderTriangles:triangles,collisionTriangles:collision.length/9,drawBatches:out.meshes.length,textureCount:images.length,sourceModels:needed,placements:placements.length,buildings,ramps,spawns:SPAWNS,glbBytes:fs.statSync(dest+'/village.glb').size,gzipBytes:fs.statSync(dest+'/village.glb.gz').size};fs.writeFileSync(dest+'/village-report.json',JSON.stringify(report,null,2)+'\n');fs.copyFileSync(src+'/License_Standard.txt',dest+'/village-license.txt');
let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-65 -70 130 140"><rect x="-65" y="-70" width="130" height="140" fill="#d4ccb4"/><text x="-59" y="-64" font-size="4" fill="#253e3b">BELLHAVEN · 120 × 120</text><rect x="-59" y="-59" width="118" height="118" fill="#a29d87" stroke="#3d5146"/>';
for(const b of buildings)svg+=`<rect x="${b.x-b.w/2}" y="${b.z-b.d/2}" width="${b.w}" height="${b.d}" fill="${b.open?'#b1c9b4':'#8b6551'}" stroke="#614b3d" stroke-width=".3"/>`;
for(const p of placements.filter(p=>p.name==='Prop_Wagon'||p.name==='Prop_Crate'))svg+=`<rect x="${p.x-.6}" y="${p.z-1}" width="1.2" height="2" fill="#4b5545"/>`;
svg+='<rect x="-2" y="-2" width="4" height="4" fill="#f3ddb0"/>';
for(const [i,p]of SPAWNS.entries())svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="1" fill="#247a75"/><text x="${p[0]+1.4}" y="${p[1]+1}" font-size="2" fill="#1b3833">${i+1}</text>`;
svg+='<text x="-59" y="65" font-size="2.5" fill="#253e3b">TEAL: SPAWNS · LIGHT: ACCESSIBLE BUILDINGS · BROWN: SOLID COVER</text></svg>';fs.writeFileSync(dest+'/village-overview.svg',svg);console.log({...report,buildings:buildings.length,sourceModels:needed.length,spawns:SPAWNS.length});
