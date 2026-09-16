// Bake supplied GLBs into a common -Z muzzle convention, preserving materials and credits.
// Texture resizing is a separate deterministic Pillow step (optimize-weapon-textures.py).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
globalThis.ProgressEvent=class{constructor(type,init){Object.assign(this,init);}};
const sourceDir=process.argv[2]||path.join(os.homedir(),'Downloads');
const specs={pistol:['glock-17',.32,Math.PI/2,0],rifle:['low-poly_ak-15_k',.95,Math.PI/2,0],shotgun:['mossberg_500_low_poly',1.08,0,0],sniper:['rifle__awp_weapon_model_cs2',1.22,Math.PI,0],revolver:['old_colt_python',.39,-Math.PI/2,0],lmg:['m249_low',1.12,Math.PI,0],dmr:['low-poly_m14',1.12,0,0],carbine:['colt_m4a1_carbine',.95,Math.PI,-.15],autoshot:['aa-12_redesign',.99,Math.PI/2,0],smg:['mp5',.69,.9021088268,0]};
function components(geo){
 const positions=geo.attributes.position,parents=Array.from({length:positions.count},(_,i)=>i),seen=new Map(),indices=geo.index?Array.from(geo.index.array):parents.slice();
 function root(i){while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;}
 for(let i=0;i<positions.count;i++){const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(seen.has(key))parents[root(i)]=root(seen.get(key));else seen.set(key,i);}
 for(let i=0;i<indices.length;i+=3)for(let k=1;k<3;k++)parents[root(indices[i+k])]=root(indices[i]);
 const groups=new Map();for(const i of indices){const key=root(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 return [...groups.values()].map(ids=>{const result=new THREE.BufferGeometry(),remap=new Map(),out=[],data={position:[],normal:[],uv:[]};for(const i of ids){if(!remap.has(i)){remap.set(i,remap.size);for(const [name,values]of Object.entries(data)){const a=geo.attributes[name];for(let k=0;k<a.itemSize;k++)values.push(a.getComponent(i,k));}}out.push(remap.get(i));}for(const [name,values]of Object.entries(data))result.setAttribute(name,new THREE.Float32BufferAttribute(values,name==='uv'?2:3));result.setIndex(out);result.computeBoundingBox();return result;});
}
const report={weapons:{}};fs.mkdirSync('public/weapons',{recursive:true});
for(const [id,[file,length,ry,rx]]of Object.entries(specs)){
 const b=fs.readFileSync(path.join(sourceDir,file+'.glb')),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(28+n),stripped=structuredClone(j);
 stripped.images=[];stripped.textures=[];stripped.materials=(j.materials||[]).map((m,i)=>({name:'material_'+i,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor}}));stripped.buffers=[{byteLength:bin.length,uri:'data:application/octet-stream;base64,'+bin.toString('base64')}];delete stripped.extensionsRequired;
 const materialKeys=new Map(),materialRemap=(j.materials||[]).map((m,i)=>{const copy=structuredClone(m);delete copy.name;delete copy.extras;const key=JSON.stringify(copy,(_,v)=>typeof v==='number'?Math.round(v*1000)/1000:v);if(!materialKeys.has(key))materialKeys.set(key,i);return materialKeys.get(key);});
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(stripped),'');gltf.scene.updateMatrixWorld(true);
 const rotation=new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(rx)),parts=[],bounds=new THREE.Box3();
 gltf.scene.traverse(o=>{if(!o.isMesh)return;if(id==='rifle'&&/^Object_(30|31|33|34|36|37)$/.test(o.name))return;if(id==='carbine'&&/^(ammo_|mag_20rnd)/i.test(o.name))return;
 const geo=new THREE.BufferGeometry(),positions=[],normal=[],uv=[],matIndex=materialRemap[Number(o.material.name.split('_').at(-1))];
 const matrix=rotation.clone().multiply(o.matrixWorld),nm=new THREE.Matrix3().getNormalMatrix(matrix);
 for(let i=0;i<o.geometry.attributes.position.count;i++){const p=o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(matrix);positions.push(...p);bounds.expandByPoint(p);const nn=new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.normal,i).applyNormalMatrix(nm);normal.push(...nn);const t=o.geometry.attributes.uv;uv.push(t?t.getX(i):0,t?t.getY(i):0);}
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(o.geometry.index)geo.setIndex(Array.from(o.geometry.index.array));
 let part='body';if(id==='dmr'&&/^(mag_19|mag_follower)/.test(o.parent.name))part='magazine';if(id==='dmr'&&/^(bolt_40|oprod_15)/.test(o.parent.name))part='bolt';if(id==='pistol'&&(/Cube0(12|13|14|15|17|18)_/.test(o.name)||/Material0(20|22)_/.test(o.name)))part='bolt';if(id==='pistol'&&/Material001_/.test(o.name))part='magazine';if(id==='rifle'&&/^Object_(39|40)$/.test(o.name))part='magazine';if(id==='rifle'&&o.name==='Object_44')part='bolt';if(/mag|clip/i.test(o.name)&&!/^m4a1/.test(o.name))part='magazine';if(id==='carbine'&&/stanag/.test(o.name))part='magazine';if(/slide|bolt|pump/i.test(o.name))part='bolt';
 if(id==='sniper'&&o.isSkinnedMesh){
  const groups=new Map(),indices=geo.index?Array.from(geo.index.array):Array.from({length:geo.attributes.position.count},(_,i)=>i);
  for(let n=0;n<indices.length;n+=3){const tri=indices.slice(n,n+3),vertex=tri[0],weights=o.geometry.attributes.skinWeight,skin=o.geometry.attributes.skinIndex;let slot=0;for(let k=1;k<4;k++)if(weights.getComponent(vertex,k)>weights.getComponent(vertex,slot))slot=k;const bone=o.skeleton.bones[skin.getComponent(vertex,slot)].name;const key=/clip/.test(bone)?'magazine':/bolt/.test(bone)?'bolt':'body';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(...tri);}
  for(const [key,ids]of groups){const seen=new Map(),outIndices=[],data={position:[],normal:[],uv:[]};for(const idx of ids){if(!seen.has(idx)){seen.set(idx,seen.size);for(const [name,values]of Object.entries(data)){const a=geo.attributes[name];for(let k=0;k<a.itemSize;k++)values.push(a.getComponent(idx,k));}}outIndices.push(seen.get(idx));}const g=new THREE.BufferGeometry();for(const [name,values]of Object.entries(data))g.setAttribute(name,new THREE.Float32BufferAttribute(values,name==='uv'?2:3));g.setIndex(outIndices);parts.push({geo:g,matIndex,part:key,name:o.name});}
 }else parts.push({geo,matIndex,part,name:o.name});});
 const scale=length/(bounds.max.z-bounds.min.z);let bx=0,by=0,count=0;
 for(const {geo}of parts){const a=geo.attributes.position;for(let i=0;i<a.count;i++)if(a.getZ(i)<bounds.min.z+(bounds.max.z-bounds.min.z)*.025){bx+=a.getX(i);by+=a.getY(i);count++;}}
 bx/=count;by/=count;const tip=-length*.68;
 for(const {geo}of parts){geo.translate(-bx,-by,-bounds.min.z);geo.scale(scale,scale,scale);geo.translate(0,.025,tip);}
 if(['shotgun','lmg','revolver','autoshot','smg'].includes(id)){
  const refined=[];for(const original of parts)for(const geo of components(original.geo)){const b=geo.boundingBox;let part=original.part;
   if(id==='shotgun'&&b.min.z>-.45&&b.max.z<-.18&&b.min.y<-.04&&b.min.x<-.017)part='bolt';
   // Replace the supplied opaque M249 scope with an unobstructed optical sight.
   if(id==='lmg'&&b.min.y>.078&&b.min.z>-.15&&b.max.z<.10)continue;
   if(id==='lmg'&&b.min.y<-.14&&b.max.y<-.035&&b.min.z>-.20&&b.max.z<-.12)part='magazine';
   // Detach connected geometry for the supplied rigid cylinder/drum/MP5 models.
   if(id==='revolver'&&b.min.z>-.10&&b.max.z<-.007&&b.min.y>-.032&&b.max.y<.036)part='magazine';
   if(id==='autoshot'&&b.min.x<-.065&&b.max.x>.065&&b.min.z>-.15&&b.max.z<-.06&&b.max.y<.01)part='magazine';
   if(id==='smg'&&b.min.y<-.10&&b.max.z<-.18&&b.min.z>-.29)part='magazine';
   refined.push({...original,geo,part});
  }parts.splice(0,parts.length,...refined);
 }
 const out={asset:{...j.asset,generator:'Neon Yard weapon compiler',extras:{...j.asset.extras,sourceFile:file+'.glb'}},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:j.materials,textures:j.textures,samplers:j.samplers,images:[],accessors:[],bufferViews:[],buffers:[],extensionsUsed:j.extensionsUsed?.filter(e=>!['KHR_draco_mesh_compression','EXT_meshopt_compression'].includes(e))};
 const chunks=[];let bytes=0;function view(data){const pad=Buffer.alloc(Math.ceil(data.length/4)*4);data.copy(pad);const v=out.bufferViews.length;out.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:data.length});chunks.push(pad);bytes+=pad.length;return v;}
 function attr(a,type){const idx=out.accessors.length;const item={bufferView:view(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)),componentType:a.array instanceof Float32Array?5126:a.array instanceof Uint16Array?5123:5125,count:a.count,type};if(type==='VEC3'){item.min=[0,1,2].map(k=>{let v=Infinity;for(let i=k;i<a.array.length;i+=3)v=Math.min(v,a.array[i]);return v;});item.max=[0,1,2].map(k=>{let v=-Infinity;for(let i=k;i<a.array.length;i+=3)v=Math.max(v,a.array[i]);return v;});}out.accessors.push(item);return idx;}
 const buckets=new Map();for(const p of parts){const key=p.part+':'+p.matIndex;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p.geo.index?p.geo:p.geo.toNonIndexed());}
 for(const [key,geos]of buckets){const [part,m]=key.split(':');const indexed=geos.every(g=>g.index);const geo=mergeGeometries(indexed?geos:geos.map(g=>g.index?g.toNonIndexed():g));const primitive={attributes:{POSITION:attr(geo.attributes.position,'VEC3'),NORMAL:attr(geo.attributes.normal,'VEC3'),TEXCOORD_0:attr(geo.attributes.uv,'VEC2')},material:Number(m)};if(geo.index)primitive.indices=attr(geo.index,'SCALAR');out.scenes[0].nodes.push(out.nodes.length);out.nodes.push({name:part,mesh:out.meshes.length});out.meshes.push({primitives:[primitive]});}
 for(const im of j.images||[]){if(im.bufferView===undefined)throw Error('External texture: '+file);const v=j.bufferViews[im.bufferView];out.images.push({mimeType:im.mimeType,bufferView:view(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))});}
 out.buffers=[{byteLength:bytes}];const raw=Buffer.from(JSON.stringify(out)),jp=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(jp);const h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+jp.length+bytes,8);h.writeUInt32LE(jp.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bytes);bh.writeUInt32LE(0x004e4942,4);const target='public/weapons/'+id+'.glb';fs.writeFileSync(target,Buffer.concat([h,jp,bh,...chunks]));execFileSync('python3',['scripts/optimize-weapon-textures.py',target]);const result=fs.readFileSync(target),gz=zlib.gzipSync(result,{level:9});fs.writeFileSync(target+'.gz',gz);
 report.weapons[id]={source:file+'.glb',sourceBytes:b.length,bytes:result.length,gzipBytes:gz.length,meshes:out.meshes.length,tip,length,sightHeight:id==='sniper'?.0795:['pistol','revolver'].includes(id)?.115:id==='shotgun'?.13:.17,credits:j.asset.extras||null,sourceAnimations:gltf.animations.map(a=>a.name)};
 console.log(id,(b.length/1e6).toFixed(2)+' → '+(result.length/1e6).toFixed(2)+' MB',out.meshes.length+' draw calls');
}
fs.writeFileSync('public/weapons/manifest.json',JSON.stringify(report,null,2)+'\n');
