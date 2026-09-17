import {createImportedKit} from './weapon-models.mjs';
export {preloadWeapons,weaponLoaded,WEAPON_HANDLING} from './weapon-models.mjs';
import * as THREE from 'three';
import {CHARACTER_SCALE} from './character-config.js';
export {CHARACTER_SCALE};
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Shared primitives and materials; static detail is baked by material so bolts,
// rails and panel seams do not each cost another draw call during combat.
const cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,12),sphere=new THREE.SphereGeometry(1,12,8);
const materials=new Map();
function mat(color,metal=.25){const key=color+':'+metal;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,metalness:metal,roughness:metal>.5?.36:.78}));return materials.get(key);}
const ringGeometry=new THREE.TorusGeometry(1,.13,6,16),openCylinder=new THREE.CylinderGeometry(1,1,1,16,1,true);
const M={steel:mat('#798591',.85),dark:mat('#202a35',.65),rubber:mat('#111923',.05),wood:mat('#82583b',.05),bone:mat('#b6b1a0',.35),brass:mat('#cba466',.8)};
function mesh(parent,g,m,x,y,z,sx,sy,sz){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;parent.add(o);return o;}
function box(p,x,y,z,w,h,d,m=M.dark,rx=0){const o=mesh(p,cube,m,x,y,z,w,h,d);o.rotation.x=rx;return o;}
function tube(p,x,y,z,r,l,m=M.steel,axis='z'){const o=mesh(p,cylinder,m,x,y,z,r,l,r);if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;return o;}
function ball(p,x,y,z,rx,ry,rz,m){return mesh(p,sphere,m,x,y,z,rx,ry,rz);}
function pivot(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function bake(group){const groups=new Map();group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert();for(const o of [...group.children]){if(!o.isMesh)continue;const g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);group.remove(o);if(![cube,cylinder,sphere,ringGeometry,openCylinder].includes(o.geometry))o.geometry.dispose();}for(const [m,geos]of groups){const g=mergeGeometries(geos);geos.forEach(v=>v.dispose());g.computeBoundingSphere();const o=new THREE.Mesh(g,m);o.castShadow=true;group.add(o);}return group;}
export function disposeKit(root,excluded=[]){const seen=new Set(),owned=new Set();root.traverse(o=>{if(o.geometry&&!o.geometry.userData.sharedWeapon&&!seen.has(o.geometry)&&![cube,cylinder,sphere,ringGeometry,openCylinder,...excluded].includes(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}if(o.material?.userData?.owned&&!owned.has(o.material)){owned.add(o.material);o.material.dispose();}});}
function rail(p,z,len){box(p,0,.102,z,.085,.024,len);for(let i=0;i<len/.028;i++)box(p,0,.12,z+len/2-i*.028,.098,.013,.012,M.steel);}
function grip(p,z,m=M.rubber){box(p,0,-.15,z,.09,.21,.105,m,-.22);for(let i=0;i<6;i++)box(p,.047,-.085-i*.027,z,.005,.009,.075,M.steel);box(p,0,-.11,z-.09,.072,.017,.12);box(p,0,-.08,z-.14,.07,.065,.015);}
function barrel(p,z,length,r=.026){tube(p,0,.025,z-length/2,r,length);tube(p,0,.025,z-length-.035,r*1.4,.07,M.dark);tube(p,0,.025,z-length-.072,r*.64,.006,M.rubber);return z-length-.085;}
function scope(p,z=0,long=false){
 const r=long?.052:.043,len=long?.34:.15;box(p,0,.15,z,.07,.07,.14);
 const shell=mesh(p,openCylinder,M.dark,0,.22,z,r,len,r);shell.rotation.x=Math.PI/2;
 for(const dz of [-len/2,len/2])mesh(p,ringGeometry,M.steel,0,.22,z+dz,r,r,r);
 const lensMaterial=new THREE.MeshBasicMaterial({color:'#71c8d5',transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide});lensMaterial.userData.owned=true;
 const lens=mesh(p,new THREE.CircleGeometry(r*.88,16),lensMaterial,0,.22,z+len/2,1,1,1);
 tube(p,.065,.22,z,.022,.045,M.dark,'x');tube(p,0,.28,z,.022,.04,M.dark,'y');
 for(let i=0;i<5;i++)box(p,.065,.196+i*.011,z,.045,.004,.012,M.steel);
 box(p,0,.22,z-len/2,.004,.004,.004,mat('#f08068',.1));
}
function stock(p,z=.28,wood=false){box(p,0,0,z,.058,.065,.28);box(p,0,-.035,z+.16,.1,.17,.19,wood?M.wood:M.rubber,-.18);box(p,0,-.04,z+.26,.11,.19,.025);}
function vents(p,z,count=6){for(let i=0;i<count;i++)for(const x of [-.071,.071])box(p,x,.015,z-i*.038,.009,.045,.021,M.rubber);}
function bipod(p,z){for(const side of [-1,1]){const o=tube(p,side*.075,-.12,z,.012,.28,M.dark,'y');o.rotation.z=side*.28;box(p,side*.11,-.26,z,.065,.025,.085,M.rubber);}}
const DESIGNS={
 pistol(p,a,mag,bolt){box(p,0,-.045,0,.115,.075,.29,a);grip(p,.095);box(bolt,0,.037,-.018,.12,.1,.33,M.steel);for(let i=0;i<8;i++)box(bolt,.062,.037,.115-i*.012,.006,.068,.005);box(p,0,.11,.11,.075,.027,.022);box(p,0,.105,-.17,.018,.025,.02,a);box(mag,0,-.08,0,.062,.15,.07);return barrel(p,-.15,.085,.022);},
 rifle(p,a,mag,bolt){box(p,0,-.015,.06,.15,.2,.62,a);box(p,0,.027,-.11,.13,.08,.36);box(p,0,-.02,.36,.16,.23,.065,M.rubber);grip(p,-.12);mag.position.z=.2;box(mag,0,-.095,0,.088,.24,.125,M.bone,.14);box(p,0,.16,.03,.085,.05,.39);for(const z of [-.13,.17])box(p,0,.12,z,.04,.12,.035);box(bolt,.08,.03,.1,.014,.035,.12,M.steel);vents(p,-.12,7);scope(p,-.035);return barrel(p,-.29,.31);},
 shotgun(p,a,mag,bolt){box(p,0,0,.035,.14,.15,.32,M.steel);stock(p,.29,true);grip(p,.12,M.wood);for(const x of [-.037,.037])tube(p,x,-.062,-.37,.027,.54,M.dark);bolt.position.z=-.37;box(bolt,0,-.065,0,.16,.095,.23,a);for(let i=0;i<8;i++)box(bolt,0,-.119,-.1+i*.028,.165,.011,.01,M.rubber);for(let i=0;i<5;i++){tube(p,-.092,.015,.12-i*.05,.02,.12,mat('#b94d38'),'y');tube(p,-.092,.073,.12-i*.05,.021,.023,M.brass,'y');}mag.visible=false;box(p,0,.105,.07,.08,.03,.05);return barrel(p,-.13,.57,.034);},
 sniper(p,a,mag,bolt){box(p,0,0,0,.105,.12,.4,M.steel);box(p,0,-.078,.04,.14,.07,.42,a);grip(p,.14);for(const x of [-.043,.043])box(p,x,0,.34,.025,.06,.4,M.steel);box(p,0,.055,.4,.1,.04,.18,M.rubber);box(p,0,-.015,.56,.12,.21,.04);mag.position.z=-.075;box(mag,0,-.04,0,.083,.095,.11);rail(p,-.02,.34);scope(p,0,true);bipod(p,-.55);tube(bolt,.115,.015,.125,.014,.12,M.steel,'x');ball(bolt,.176,-.008,.125,.023,.023,.023,M.rubber);for(let i=0;i<5;i++)tube(p,0,.025,-.36-i*.09,.033,.02,M.dark);return barrel(p,-.2,.7,.023);},
 smg(p,a,mag,bolt){box(p,0,0,-.02,.12,.15,.36,a);grip(p,.045);mag.position.set(0,.12,-.08);box(mag,0,0,0,.1,.072,.37,M.bone);for(let i=0;i<10;i++)box(mag,0,.04,.08-i*.027,.063,.009,.01,M.brass);for(const x of [-.055,.055])tube(p,x,0,.29,.009,.3,M.steel);box(p,0,-.025,.45,.12,.13,.025);box(bolt,.065,.028,.045,.02,.025,.08);box(p,0,.19,.08,.07,.02,.05);tube(p,0,.025,-.39,.051,.27,M.rubber);for(let i=0;i<5;i++)tube(p,0,.025,-.3-i*.04,.054,.012,M.steel);return -.54;},
 revolver(p,a,mag,bolt){box(p,0,0,.005,.09,.135,.25,M.steel);grip(p,.12,M.wood);mag.position.set(0,.018,.015);tube(mag,0,0,0,.079,.13,a);for(let i=0;i<6;i++){const t=i*Math.PI/3;tube(mag,Math.cos(t)*.052,Math.sin(t)*.052,-.069,.016,.009,M.rubber);}box(p,0,.085,-.17,.07,.045,.38,a);tube(bolt,0,.065,.14,.014,.07,M.steel,'y');box(p,0,.12,-.33,.019,.035,.025);return barrel(p,-.08,.3,.028);},
 lmg(p,a,mag,bolt){box(p,0,0,.03,.18,.19,.45,a);box(bolt,0,.12,0,.2,.06,.34,M.steel);grip(p,.16);stock(p,.39);mag.position.set(-.08,-.16,-.03);box(mag,0,-.045,0,.23,.19,.19,M.rubber);for(let i=0;i<9;i++){tube(p,-.13-i*.022,.105-Math.pow(i/8,2)*.1,-.045,.016,.095,M.brass);box(p,-.13-i*.022,.115-Math.pow(i/8,2)*.1,-.005,.019,.018,.025);}box(p,0,.015,-.3,.14,.11,.26);vents(p,-.2,7);rail(p,.025,.28);bipod(p,-.6);return barrel(p,-.23,.48,.032);},
 dmr(p,a,mag,bolt){box(p,0,-.055,.12,.125,.13,.5,M.wood);box(p,0,.02,-.02,.105,.1,.42,M.steel);box(p,0,-.035,.45,.12,.18,.29,M.wood,-.13);box(p,0,-.11,.27,.055,.09,.13,M.rubber,-.38);grip(p,.15,M.wood);mag.position.z=-.055;box(mag,0,-.055,0,.08,.13,.105,a);box(p,0,-.02,-.34,.11,.11,.27,M.wood);for(let i=0;i<7;i++)box(p,.058,-.018,-.24-i*.032,.006,.065,.01);scope(p,0,true);tube(bolt,.092,.025,.12,.011,.08,M.steel,'x');return barrel(p,-.24,.5,.024);},
 carbine(p,a,mag,bolt){box(p,0,.015,0,.13,.15,.38,M.bone);grip(p,.095);stock(p,.28);mag.position.z=-.075;box(mag,0,-.09,.015,.076,.21,.12,a,-.27);box(p,0,.025,-.32,.145,.145,.33,a);vents(p,-.19,8);rail(p,-.12,.5);box(bolt,.071,.03,.08,.015,.028,.105,M.steel);tube(p,0,.025,-.56,.046,.23,M.dark);for(const x of [-.11,.11])box(p,x,.005,-.32,.065,.07,.12,M.dark);scope(p,.04);return -.69;},
 autoshot(p,a,mag,bolt){box(p,0,.005,.035,.2,.19,.35,a);grip(p,.13);stock(p,.3);mag.position.set(0,-.19,-.045);tube(mag,0,0,0,.14,.15,M.dark,'x');tube(mag,-.08,0,0,.1,.015,a,'x');for(let i=0;i<8;i++){const t=i*Math.PI/4;box(mag,0,Math.sin(t)*.14,Math.cos(t)*.14,.16,.018,.022,M.steel);}box(bolt,.105,.045,.02,.022,.05,.12);box(p,0,.02,-.25,.18,.12,.22,M.rubber);rail(p,0,.25);tube(p,0,.025,-.43,.059,.19,M.steel);for(let i=0;i<4;i++)box(p,.06,.025,-.36-i*.04,.007,.03,.02,M.rubber);return -.54;}
};
export function createWeaponKit(id,color='#6ad6d2'){
 const imported=createImportedKit(id);if(imported)return imported;
 if(!DESIGNS[id])throw Error('Unknown weapon '+id);
 const root=new THREE.Group(),staticPart=pivot(root),magazine=pivot(root,0,-.115,.09),bolt=pivot(root);
 const finish='#'+new THREE.Color(color).multiplyScalar(.48).getHexString();
 const tip=DESIGNS[id](staticPart,mat(finish,.6),magazine,bolt);
 // Panel seams, selector markings, grip stippling and inset fasteners.
 const accent=mat(color,.45);
 for(const side of [-1,1]){
  box(staticPart,side*.077,-.026,.025,.006,.011,.16,M.rubber);
  box(staticPart,side*.08,.048,.02,.006,.008,.11,accent);
  for(let i=0;i<4;i++)box(staticPart,side*.08,-.012,.075-i*.014,.004,.018,.004,M.bone);
  tube(staticPart,side*.083,-.04,.105,.012,.009,M.steel,'x');
 }
 // Hardware is located along the actual receiver, independent of silhouette.
 for(const z of [-.1,.07])for(const x of [-.08,.08])tube(staticPart,x,-.022,z,.008,.008,M.steel,'x');
 bake(staticPart);bake(magazine);bake(bolt);
 const flash=new THREE.Mesh(new THREE.OctahedronGeometry(.06,0),new THREE.MeshBasicMaterial({color:'#ffe6a6',transparent:true,opacity:.92,depthWrite:false}));flash.material.userData.owned=true;flash.position.set(0,.025,tip);flash.scale.z=2.5;flash.visible=false;root.add(flash);
 root.userData={id,magazine,bolt,boltHome:bolt.position.clone(),magazineHome:magazine.position.clone(),muzzle:flash,tip,sightHeight:['sniper','dmr','rifle','carbine'].includes(id)?.22:id==='smg'?.19:.105,signature:id};
 return root;
}
export const SKIN_STYLES={
 cyan:{name:'RECON / Field Operator',base:'#354851',armor:'#637763',trim:'#d4c8a7',hat:'helmet',outfit:'vest',skin:'#bc8a69'},
 sunset:{name:'RANGER / Outback',base:'#8a6749',armor:'#c7a071',trim:'#edddba',hat:'hat',outfit:'rolled',skin:'#d7a77e'},
 violet:{name:'RUNNER / Streetwear',base:'#4e445d',armor:'#b0a3b9',trim:'#ece6e0',hat:'hood',outfit:'hoodie',skin:'#78543f'},
 lime:{name:'SCOUT / Light Infantry',base:'#596346',armor:'#849371',trim:'#c8c1a0',hat:'cap',outfit:'rolled',skin:'#e0b38d'},
 rose:{name:'MEDIC / Rescue',base:'#e6dfce',armor:'#a84443',trim:'#f4efdf',hat:'ponytail',outfit:'medic',skin:'#a56e50'},
 ice:{name:'ALPINE / Mountain Patrol',base:'#c5cacc',armor:'#717d87',trim:'#ecebe1',hat:'beanie',outfit:'parka',skin:'#cfa07c'},
 obsidian:{name:'BREACHER / Tactical',base:'#252b32',armor:'#414952',trim:'#9da4a4',hat:'helmet',outfit:'heavy',skin:'#71503e'},
 desert:{name:'NOMAD / Expedition',base:'#a79473',armor:'#6f654f',trim:'#d8cbb0',hat:'scarf',outfit:'pack',skin:'#ae7c58'},
 woodland:{name:'TRACKER / Woodland',base:'#475c41',armor:'#887b54',trim:'#c6b798',hat:'hat',outfit:'pack',skin:'#b88563'},
 ember:{name:'MECHANIC / Workshop',base:'#985c37',armor:'#3d4249',trim:'#dec8a0',hat:'mohawk',outfit:'overalls',skin:'#d3a17c'},
 arctic:{name:'MARKSMAN / Winter',base:'#aab9bf',armor:'#e1e1d7',trim:'#6a828b',hat:'hood',outfit:'longcoat',skin:'#805a43'},
 royal:{name:'OFFICER / Command',base:'#34425b',armor:'#697486',trim:'#c9ac68',hat:'beret',outfit:'coat',skin:'#bf916f'}
};
export function createOperatorRig(p){
 const style=SKIN_STYLES[p.skin]||SKIN_STYLES.cyan,base=mat(style.base,.05),armor=mat(style.armor,.35),trim=mat(style.trim,.4);
 const root=new THREE.Group();root.scale.setScalar(p.characterScale||CHARACTER_SCALE);const hips=pivot(root,0,.79,0),torso=pivot(hips,0,.15,0);
 const skinMat=mat(style.skin,0),hair=mat('#34271f',0),cloth=mat(style.armor,0);
 box(hips,0,0,0,.34,.17,.24,base);box(hips,0,.065,0,.36,.055,.255,M.rubber);
 box(torso,0,.17,0,.4,.4,.24,base);tube(torso,0,.43,0,.065,.13,skinMat,'y');
 if(['vest','heavy','medic'].includes(style.outfit)){
  box(torso,0,.18,-.145,.35,.32,.075,cloth);
  for(const x of [-.11,0,.11])box(torso,x,.07,-.2,.09,.12,.06,cloth);
 }
 if(style.outfit==='heavy'){box(torso,0,.15,.15,.39,.39,.12,cloth);for(const x of [-.22,.22])box(torso,x,.33,0,.09,.12,.29,cloth);}
 if(style.outfit==='medic'){box(torso,0,.28,-.188,.045,.12,.012,mat('#f1efdf',0));box(torso,0,.28,-.19,.12,.045,.012,mat('#f1efdf',0));box(hips,.24,-.02,0,.16,.2,.18,cloth);}
 if(['coat','longcoat','parka'].includes(style.outfit)){box(torso,0,-.04,.015,.43,.22,.27,base);for(const x of [-.14,.14])box(torso,x,.08,-.132,.1,.1,.015,cloth);box(torso,0,.2,-.13,.012,.36,.015,trim);}
 if(style.outfit==='pack'){box(torso,0,.18,.2,.31,.38,.19,cloth);for(const x of [-.14,.14])box(torso,x,.2,-.13,.035,.4,.03,cloth);tube(torso,.2,.25,.23,.045,.25,M.steel,'y');}
 if(style.outfit==='overalls'){box(torso,0,.13,-.128,.26,.28,.025,cloth);for(const x of [-.12,.12])box(torso,x,.33,-.13,.045,.18,.025,cloth);box(hips,.23,-.05,0,.1,.18,.08,M.wood);}
 if(style.outfit==='hoodie'){box(torso,0,-.01,-.14,.26,.1,.03,cloth);for(const x of [-.055,.055])box(torso,x,.3,-.14,.008,.12,.008,trim);}
 const head=pivot(torso,0,.55,0);ball(head,0,0,0,.125,.165,.12,skinMat);
 box(head,0,-.01,-.122,.036,.065,.033,skinMat);for(const x of [-.045,.045]){box(head,x,.03,-.116,.025,.012,.012,M.rubber);ball(head,x*2.9,-.005,0,.021,.044,.026,skinMat);}
 box(head,0,-.075,-.111,.055,.009,.013,hair);ball(head,0,.105,.025,.128,.066,.115,hair);
 if(style.hat==='helmet'){ball(head,0,.09,.025,.15,.09,.145,cloth);box(head,0,.065,-.122,.27,.025,.09,cloth);}
 if(style.hat==='cap'){ball(head,0,.1,.02,.13,.065,.12,cloth);box(head,0,.085,-.135,.22,.018,.15,cloth);}
 if(style.hat==='hat'){tube(head,0,.09,0,.21,.018,cloth,'y');tube(head,0,.14,.012,.123,.085,cloth,'y');}
 if(style.hat==='beret'){const hat=ball(head,.027,.126,.016,.16,.05,.13,cloth);hat.rotation.z=-.2;box(head,-.065,.116,-.102,.032,.037,.012,trim);}
 if(style.hat==='beanie'){ball(head,0,.125,.014,.137,.07,.127,cloth);box(head,0,.082,-.113,.23,.04,.024,cloth);}
 if(style.hat==='hood'){ball(head,0,.06,.07,.153,.14,.12,cloth);for(const x of [-.128,.128])box(head,x,.005,.01,.035,.2,.17,cloth);}
 if(style.hat==='scarf'){box(torso,0,.43,-.005,.25,.085,.25,cloth);box(torso,.1,.25,-.145,.075,.3,.04,cloth);}
 if(style.hat==='ponytail')ball(head,0,.06,.17,.047,.1,.09,hair);
 if(style.hat==='mohawk')box(head,0,.17,0,.035,.06,.2,hair);
 const legs=[],knees=[],arms=[],elbows=[];
 for(const side of [-1,1]){
  const leg=pivot(hips,side*.155,-.015,0),knee=pivot(leg,0,-.36,0),arm=pivot(torso,side*.265,.34,0),elbow=pivot(arm,0,-.28,0);
  box(leg,0,-.17,0,.145,.33,.17,base);box(knee,0,-.155,0,.125,.31,.145,base);box(knee,0,-.32,-.04,.15,.1,.24,M.rubber);
  const rolled=style.outfit==='rolled'||style.outfit==='overalls';
  box(arm,0,-.12,0,.13,.25,.15,base);box(elbow,0,-.13,0,.105,.24,.12,rolled?skinMat:base);ball(elbow,0,-.265,-.012,.055,.065,.05,skinMat);
  if(style.outfit==='heavy')box(knee,0,-.025,-.086,.13,.13,.04,cloth);
  legs.push(leg);knees.push(knee);arms.push(arm);elbows.push(elbow);
 }
 for(const g of [head,...legs,...knees,...arms,...elbows,torso,hips])bake(g);
 const weaponPivot=pivot(torso,.22,.1,-.32),kit=createWeaponKit(p.gun||'rifle',style.trim);kit.scale.setScalar(.72);weaponPivot.add(kit);
 const shield=new THREE.Mesh(new THREE.SphereGeometry(1.1,12,8),new THREE.MeshBasicMaterial({color:style.trim,wireframe:true,transparent:true,opacity:.09}));shield.position.y=.85;root.add(shield);
 return {root,hips,torso,head,legs,knees,arms,elbows,left:legs[0],right:legs[1],armLeft:arms[0],armRight:arms[1],weaponPivot,kit,remoteScope:{visible:false},remoteFlash:kit.userData.muzzle,shield,skin:p.skin,last:new THREE.Vector3(p.x,p.y,p.z),stride:0,stanceBlend:0};
}
export function animateOperator(a,p,dt,now,shotAge,reloadProgress){
 a.root.scale.setScalar(p.characterScale||CHARACTER_SCALE);
 const stance=p.stance||'stand',prone=stance==='prone',low=stance==='crouch'||stance==='slide',slide=stance==='slide';
 const speed=Math.hypot(p.vx||0,p.vz||0),blend=1-Math.exp(-14*Math.min(dt,.1));
 const forward=-((p.vx||0)*Math.sin(p.yaw||0)+(p.vz||0)*Math.cos(p.yaw||0));
 const lateral=(p.vx||0)*Math.cos(p.yaw||0)-(p.vz||0)*Math.sin(p.yaw||0);
 const grounded=p.ground!==false,walk=grounded&&!slide;
 a.gait=THREE.MathUtils.lerp(a.gait||0,walk?Math.min(1,speed/4):0,blend);
 if(walk)a.stride+=Math.min(dt,.1)*speed*(prone?3.5:2.15);
 if(grounded&&a.wasGround===false)a.landing=Math.min(.065,Math.abs(a.lastVy||0)*.008);
 a.wasGround=grounded;a.lastVy=p.vy||0;a.landing=(a.landing||0)*Math.exp(-12*dt);
 const crouchBob=prone||low?0:Math.abs(Math.sin(a.stride))*a.gait*.018;
 a.hips.position.y=THREE.MathUtils.lerp(a.hips.position.y,(prone?.255:slide?.23:low?.29:.79)-a.landing-crouchBob,blend);
 a.hips.rotation.x=THREE.MathUtils.lerp(a.hips.rotation.x,prone?-Math.PI/2:slide?-1:0,blend);
 const turn=prone||low?0:THREE.MathUtils.clamp(lateral*.075,-.55,.55);
 a.hips.rotation.y=THREE.MathUtils.lerp(a.hips.rotation.y,turn,blend);
 a.torso.rotation.y=-a.hips.rotation.y;
 a.torso.rotation.x=THREE.MathUtils.lerp(a.torso.rotation.x,prone?.08:slide?0:low?.8:p.sprint&&!p.aim?.13:0,blend);
 a.head.rotation.x=-a.hips.rotation.x-a.torso.rotation.x+(p.pitch||0)*.4;
 const kick=Math.max(0,1-shotAge/140)*.09;
 for(let i=0;i<2;i++){
  const sign=i?1:-1,cycle=Math.sin(a.stride+Math.PI*i),swing=cycle*.62*a.gait;
  const direction=Math.abs(forward)<.1?0:Math.sign(forward);
  const leg=prone?swing*.17:slide?-.57:low?1.25+swing*.12:!grounded?.25+sign*.18:swing*direction;
  a.legs[i].rotation.x=THREE.MathUtils.lerp(a.legs[i].rotation.x,leg,blend);
  a.legs[i].rotation.z=THREE.MathUtils.lerp(a.legs[i].rotation.z,prone||low?0:cycle*a.gait*THREE.MathUtils.clamp(lateral*.07,-.3,.3),blend);
  a.knees[i].rotation.x=THREE.MathUtils.lerp(a.knees[i].rotation.x,prone?.12:slide?.13:low?-2.5:!grounded?-.45:Math.min(0,-swing)*.9-a.landing*3,blend);
  a.arms[i].rotation.x=THREE.MathUtils.lerp(a.arms[i].rotation.x,(prone?2.8:1.02)+(p.pitch||0)*.55+kick-(i===0?reloadProgress*.45:0),blend);
  a.arms[i].rotation.z=THREE.MathUtils.lerp(a.arms[i].rotation.z,i?-.2:.55,blend);
  a.elbows[i].rotation.x=THREE.MathUtils.lerp(a.elbows[i].rotation.x,(prone?.2:.65)+(i===0?reloadProgress*.6:0),blend);
 }
 a.weaponPivot.position.lerp(new THREE.Vector3(.12,prone?.5:slide?.2:.2,(prone?.1:slide?.12:-.16)+kick*.25),blend);
 a.weaponPivot.rotation.x=(p.pitch||0)-a.hips.rotation.x-a.torso.rotation.x-kick;
 a.weaponPivot.rotation.z=-reloadProgress*.45;
 // Two-bone arm posing keeps gloves on the actual weapon instead of swinging above it.
 for(let i=0;i<2;i++){
  a.ik ||= [null,null];
  const v=a.ik[i] ||= Array.from({length:8},()=>new THREE.Vector3());
  const [target,axis,bend,elbow,upper,lower,down,helper]=v;
  const side=i?1:-1,shortGun=['pistol','revolver'].includes(p.gun||a.kit.userData.id);
  target.set(i?.04:-.055,-.11,i?.13:shortGun?.08:-.28).multiplyScalar(.72).applyQuaternion(a.weaponPivot.quaternion).add(a.weaponPivot.position);
  if(i===0&&reloadProgress>0){target.x-=reloadProgress*.08;target.y-=reloadProgress*.16;target.z+=reloadProgress*.12;}
  axis.copy(target).sub(a.arms[i].position);const distance=THREE.MathUtils.clamp(axis.length(),.035,.549);axis.normalize();
  bend.set(side*.8,-1,.35);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const along=(.28*.28-.27*.27+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,.28*.28-along*along));
  elbow.copy(a.arms[i].position).addScaledVector(axis,along).addScaledVector(bend,height);
  upper.copy(elbow).sub(a.arms[i].position).normalize();down.set(0,-1,0);
  a.arms[i].quaternion.setFromUnitVectors(down,upper);
  helper.copy(a.arms[i].position).addScaledVector(axis,distance);
  lower.copy(helper).sub(elbow).normalize().applyQuaternion(a.arms[i].quaternion.clone().invert());
  a.elbows[i].quaternion.setFromUnitVectors(down,lower);
 }
 a.remoteFlash.visible=shotAge<65;
 a.kit.userData.bolt.position.z=a.kit.userData.boltHome.z+Math.max(0,1-shotAge/110)*.06;
}
