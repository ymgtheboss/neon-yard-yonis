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
export function disposeKit(root,excluded=[]){const seen=new Set(),owned=new Set();root.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)&&![cube,cylinder,sphere,ringGeometry,openCylinder,...excluded].includes(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}if(o.material?.userData?.owned&&!owned.has(o.material)){owned.add(o.material);o.material.dispose();}});}
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
 cyan:{name:'ION / Recon',base:'#25404c',armor:'#57d9d7',trim:'#cdf8ef',helmet:0},sunset:{name:'DUNE / Ranger',base:'#624e3d',armor:'#d5915c',trim:'#f5d6a6',helmet:1},violet:{name:'PHANTOM / Infiltrator',base:'#373447',armor:'#9e86cb',trim:'#e4d5ff',helmet:2},lime:{name:'VIPER / Scout',base:'#303d2f',armor:'#99b365',trim:'#dbe9b4',helmet:0},rose:{name:'SAKURA / Medic',base:'#443944',armor:'#bc7d96',trim:'#f8e6ef',helmet:1},ice:{name:'POLAR / Sentinel',base:'#617079',armor:'#d7e3e6',trim:'#7ad8ed',helmet:2},obsidian:{name:'ONYX / Breacher',base:'#202834',armor:'#535e73',trim:'#e5a765',helmet:2},desert:{name:'NOMAD / Pathfinder',base:'#695747',armor:'#c4a275',trim:'#e9d4ad',helmet:1},woodland:{name:'FERN / Tracker',base:'#34483a',armor:'#7d9463',trim:'#c4cd8e',helmet:0},ember:{name:'CINDER / Assault',base:'#423b37',armor:'#be6146',trim:'#f4c37c',helmet:2},arctic:{name:'GLACIER / Marksman',base:'#4c6576',armor:'#b2cfdf',trim:'#e6f4fb',helmet:1},royal:{name:'REGENT / Elite',base:'#302a43',armor:'#8268b3',trim:'#e2c28e',helmet:0}
};
export function createOperatorRig(p){
 const style=SKIN_STYLES[p.skin]||SKIN_STYLES.cyan,base=mat(style.base,.05),armor=mat(style.armor,.35),trim=mat(style.trim,.4);
 const root=new THREE.Group();root.scale.setScalar(CHARACTER_SCALE);const hips=pivot(root,0,.79,0),torso=pivot(hips,0,.15,0);
 ball(hips,0,0,0,.25,.14,.16,base);box(hips,0,.04,0,.48,.07,.33,M.rubber);
 // Tapered torso, layered chest/back plates, collar and asymmetric radio pack.
 ball(torso,0,.16,0,.26,.29,.16,base);box(torso,0,.2,-.14,.39,.36,.065,armor,.06);box(torso,0,.2,.15,.38,.38,.075,armor);
 for(const side of [-1,1])box(torso,side*.2,.3,-.1,.045,.3,.04,M.rubber);
 for(let n=0;n<3;n++){box(torso,(n-1)*.13,.07,-.205,.105,.13,.065,base);box(torso,(n-1)*.13,.13,-.242,.11,.023,.018,trim);}
 box(torso,.26,.28,.07,.09,.14,.085,M.dark);tube(torso,.27,.43,.08,.007,.22,M.dark,'y');
 box(torso,-.115,.33,-.19,.075,.035,.015,trim);box(torso,.115,.22,-.188,.09,.016,.012,trim);
 const head=pivot(torso,0,.55,0);ball(head,0,0,0,.16,.18,.155,mat('#a98166',.05));
 ball(head,0,.07,.014,.2,.14,.19,armor);box(head,0,.016,-.156,.32,.095,.045,M.rubber);box(head,0,.018,-.184,.255,.055,.013,mat(style.trim,.75));
 if(style.helmet===2){box(head,0,-.105,-.095,.29,.15,.16,armor);for(const x of [-.06,.06])tube(head,x,-.09,-.18,.032,.03,M.dark);}
 if(style.helmet===1){box(head,0,.08,-.18,.36,.026,.14,base);box(torso,0,.43,0,.34,.1,.3,base);}
 for(const x of [-.195,.195])tube(head,x,-.005,.012,.065,.025,M.dark,'x');
 const legs=[],knees=[],arms=[],elbows=[];
 for(const side of [-1,1]){
  const leg=pivot(hips,side*.155,-.015,0),knee=pivot(leg,0,-.36,0),arm=pivot(torso,side*.32,.34,0),elbow=pivot(arm,0,-.28,0);
  ball(leg,0,-.16,0,.115,.205,.12,base);box(leg,side*.09,-.13,0,.08,.15,.14,armor);ball(knee,0,0,-.035,.1,.095,.075,armor);ball(knee,0,-.16,0,.083,.19,.09,base);box(knee,0,-.32,-.045,.19,.1,.29,M.rubber);box(knee,0,-.272,-.09,.14,.035,.15,M.steel);
  ball(arm,0,-.025,0,.13,.11,.13,armor);ball(arm,0,-.16,0,.085,.15,.09,base);ball(elbow,0,-.02,0,.08,.07,.085,armor);ball(elbow,0,-.15,0,.073,.14,.08,base);ball(elbow,0,-.27,-.015,.075,.075,.07,M.rubber);box(arm,side*.09,-.05,-.04,.018,.055,.075,trim);
  legs.push(leg);knees.push(knee);arms.push(arm);elbows.push(elbow);
 }
 for(const g of [head,...legs,...knees,...arms,...elbows,torso,hips])bake(g);
 const weaponPivot=pivot(torso,.22,.1,-.32),kit=createWeaponKit(p.gun||'rifle',style.trim);kit.scale.setScalar(.72);weaponPivot.add(kit);
 const shield=new THREE.Mesh(new THREE.SphereGeometry(1.1,12,8),new THREE.MeshBasicMaterial({color:style.trim,wireframe:true,transparent:true,opacity:.09}));shield.position.y=.85;root.add(shield);
 return {root,hips,torso,head,legs,knees,arms,elbows,left:legs[0],right:legs[1],armLeft:arms[0],armRight:arms[1],weaponPivot,kit,remoteScope:{visible:false},remoteFlash:kit.userData.muzzle,shield,skin:p.skin,last:new THREE.Vector3(p.x,p.y,p.z),stride:0,stanceBlend:0};
}
export function animateOperator(a,p,dt,now,shotAge,reloadProgress){
 const stance=p.stance||'stand',prone=stance==='prone',low=stance==='crouch'||stance==='slide',slide=stance==='slide';
 const speed=Math.hypot(p.vx||0,p.vz||0),blend=1-Math.exp(-14*dt);a.stride+=dt*speed*(prone?3.5:2.15);
 a.hips.position.y=THREE.MathUtils.lerp(a.hips.position.y,prone?.255:slide?.23:low?.29:.79,blend);
 a.hips.rotation.x=THREE.MathUtils.lerp(a.hips.rotation.x,prone?-Math.PI/2:slide?-1:0,blend);
 a.torso.rotation.x=THREE.MathUtils.lerp(a.torso.rotation.x,prone?.08:slide?0:low?.8:p.sprint?.13:0,blend);
 a.head.rotation.x=-a.hips.rotation.x-a.torso.rotation.x+p.pitch*.4;
 for(let i=0;i<2;i++){
  const sign=i?1:-1,swing=Math.sin(a.stride+Math.PI*i)*Math.min(.65,speed*.075);
  a.legs[i].rotation.x=prone?swing*.17:slide?-.57:low?1.25+swing*.12:!p.ground?.25+sign*.18:swing;
  a.knees[i].rotation.x=prone?.12:slide?.13:low?-2.5:Math.min(0,-swing)*.75;
  a.arms[i].rotation.x=prone?2.8:.4+p.pitch*.25;
  a.arms[i].rotation.z=i?-.2:.55;a.elbows[i].rotation.x=(prone?.2:.65)+(i===0?reloadProgress*.6:0);
 }
 a.weaponPivot.position.set(.22,prone?.5:slide?.2:.1,prone?.1:slide?.12:-.32);
 a.weaponPivot.rotation.x=p.pitch-a.hips.rotation.x-a.torso.rotation.x;a.weaponPivot.rotation.z=-reloadProgress*.45;
 a.remoteFlash.visible=shotAge<65;
 a.kit.userData.bolt.position.z=a.kit.userData.boltHome.z+Math.max(0,1-shotAge/110)*.06;
}
