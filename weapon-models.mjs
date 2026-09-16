import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const templates=new Map();
export const WEAPON_HANDLING={
 pistol:{kick:.047,rise:.012,side:.003,return:19,flash:1,optic:'reflex'},
 rifle:{kick:.056,rise:.016,side:.005,return:15,flash:1.25,optic:'holo'},
 shotgun:{kick:.12,rise:.036,side:.006,return:11,flash:1.8,optic:'reflex'},
 sniper:{kick:.14,rise:.043,side:.004,return:9,flash:2,optic:'scope'},
 revolver:{kick:.095,rise:.03,side:.007,return:12,flash:1.55,optic:'reflex'},
 lmg:{kick:.064,rise:.02,side:.008,return:14,flash:1.5,optic:'holo'},
 dmr:{kick:.082,rise:.025,side:.005,return:12,flash:1.5,optic:'scope'},
 carbine:{kick:.044,rise:.012,side:.0035,return:18,flash:1.15,optic:'holo'},
 autoshot:{kick:.095,rise:.03,side:.006,return:13,flash:1.75,optic:'reflex'},
 smg:{kick:.032,rise:.008,side:.004,return:21,flash:.85,optic:'reflex'}
};
export function weaponLoaded(id){return templates.has(id);}
let loading;
export function preloadWeapons(onReady=()=>{}){
 if(loading)return loading;
 loading=(async()=>{const response=await fetch('/weapons/manifest.json');if(!response.ok)throw Error('Weapon manifest unavailable');const {weapons}=await response.json(),queue=Object.entries(weapons),errors=[];const loader=new GLTFLoader();
 async function worker(){while(queue.length){const [id,meta]=queue.shift();try{const {scene}=await loader.loadAsync('/weapons/'+id+'.glb');scene.traverse(o=>{if(!o.isMesh)return;o.geometry.userData.sharedWeapon=true;o.castShadow=false;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.sharedWeapon=true;if(m.map)m.map.anisotropy=4;m.roughness=Math.max(.28,m.roughness??.7);}});templates.set(id,{scene,meta});onReady(id);}catch(error){errors.push(id);console.error('Weapon model failed:',id,error);}}}
 await Promise.all([worker(),worker()]);return {loaded:templates.size,errors};})();return loading;
}
function material(color,metalness=.6){const m=new THREE.MeshStandardMaterial({color,roughness:.38,metalness});m.userData.owned=true;return m;}
function addMesh(parent,geometry,mat,position){const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(...position);parent.add(mesh);return mesh;}
function optic(root,id,height){
 const style=WEAPON_HANDLING[id].optic;if(style==='scope'&&id==='sniper')return;
 const housing=new THREE.Group();root.add(housing);housing.position.set(0,height,-.015);
 const dark=material('#151b21'),edge=material('#66727a',.8),small=['pistol','revolver'].includes(id),r=small?.036:.055;
 addMesh(housing,new THREE.BoxGeometry(r*1.65,.045,.13),dark,[0,-r-.024,0]);
 if(style==='scope'){
  const body=addMesh(housing,new THREE.CylinderGeometry(r,r,.29,24,1,true),dark,[0,0,0]);body.rotation.x=Math.PI/2;
  for(const z of [-.145,.145])addMesh(housing,new THREE.TorusGeometry(r,.008,8,32),edge,[0,0,z]);
  const turret=addMesh(housing,new THREE.CylinderGeometry(.027,.027,.043,16),dark,[0,r+.018,0]);
 }else{
  const shape=new THREE.Shape();const sides=style==='holo'?8:32;
  for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,x=Math.cos(a)*(r+.009),y=Math.sin(a)*(r+.009);i?shape.lineTo(x,y):shape.moveTo(x,y);}
  const hole=new THREE.Path();for(let i=sides;i>=0;i--){const a=i/sides*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r;i===sides?hole.moveTo(x,y):hole.lineTo(x,y);}shape.holes.push(hole);
  addMesh(housing,new THREE.ExtrudeGeometry(shape,{depth:style==='holo'?.055:.022,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:1,steps:1}),dark,[0,0,0]);
  for(const x of [-r-.014,r+.014]){const screw=addMesh(housing,new THREE.CylinderGeometry(.009,.009,.012,12),edge,[x,-.025,.025]);screw.rotation.z=Math.PI/2;}
 }
 const glass=new THREE.MeshBasicMaterial({color:'#6abbbc',transparent:true,opacity:.055,depthWrite:false,side:THREE.DoubleSide});glass.userData.owned=true;
 addMesh(housing,new THREE.CircleGeometry(r*.98,32),glass,[0,0,.06]);
 // A geometric reticle lives in the optic; it moves with the weapon, not the HUD.
 const red=new THREE.MeshBasicMaterial({color:'#ff4828',toneMapped:false,depthWrite:false});red.userData.owned=true;
 addMesh(housing,new THREE.CircleGeometry(.0016,16),red,[0,0,.062]);
 if(style==='holo')addMesh(housing,new THREE.TorusGeometry(.014,.00065,4,40),red,[0,0,.062]);
}
export function makeMuzzleFlash(tip){
 const positions=[],colors=[];
 for(let plane=0;plane<3;plane++)for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+1)/8*Math.PI*2;const points=[[0,0,0],[Math.cos(a)*(i%2?.024:.1),Math.sin(a)*(i%2?.024:.1),-.025],[Math.cos(b)*(i%2?.1:.024),Math.sin(b)*(i%2?.1:.024),-.025]];
 for(let k=0;k<3;k++){const v=new THREE.Vector3(...points[k]);if(plane===1)v.applyAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);if(plane===2)v.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);positions.push(...v);colors.push(...(k===0?[1,1,.85]:[1,.24,.015]));}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const mat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});mat.userData.owned=true;
 const flash=new THREE.Mesh(geo,mat);flash.position.set(0,.025,tip-.018);flash.visible=false;return flash;
}
export function createImportedKit(id){
 const template=templates.get(id);if(!template)return null;
 const root=new THREE.Group(),model=template.scene.clone(true),magazine=new THREE.Group(),bolt=new THREE.Group();root.add(model,magazine,bolt);
 // Compiled moving parts retain world-space vertices, with pivots at the receiver.
 for(const child of [...model.children]){if(child.name.startsWith('magazine'))magazine.add(child);if(child.name.startsWith('bolt'))bolt.add(child);}
 const {tip,sightHeight}=template.meta;
 optic(root,id,sightHeight);
 const muzzle=makeMuzzleFlash(tip);root.add(muzzle);
 root.userData={id,imported:true,magazine,bolt,boltHome:bolt.position.clone(),magazineHome:magazine.position.clone(),muzzle,tip,sightHeight,signature:template.meta.source};return root;
}
