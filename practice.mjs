import * as THREE from '/three.module.js';
import {WEAPONS} from '/world.js';
import {preloadWeapons,createImportedKit,WEAPON_HANDLING} from '/weapon-models.mjs';
import {disposeKit} from '/combat-visuals.js';
import {MapCollision,bodyShape} from '/map-collision.js';
import {weaponDamage,weaponSpread,sampleSpread,spreadDiameter} from '/weapon-rules.js';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let savedSettings={};try{savedSettings=JSON.parse(localStorage.getItem('ny-settings'))||{};}catch{}
const settings={fov:clamp(Number(savedSettings.fov)||110,65,110),sensitivity:clamp(Number(savedSettings.sensitivity)||1,.2,3),aimSensitivity:clamp(Number(savedSettings.aimSensitivity)||.55,.1,2),scopeSensitivity:clamp(Number(savedSettings.scopeSensitivity)||.55,.1,2),volume:clamp(Number(savedSettings.volume??.45),0,1),invert:savedSettings.invert==='yes'};
const scene=new THREE.Scene();scene.background=new THREE.Color('#a5bdc7');scene.fog=new THREE.Fog('#a5bdc7',55,100);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(settings.fov,innerWidth/innerHeight,.04,120);camera.rotation.order='YXZ';
const view=new THREE.Scene(),viewCamera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.01,10);viewCamera.rotation.order='YXZ';
for(const s of [scene,view]){s.add(new THREE.HemisphereLight('#ecfaff','#414854',2.6));const sun=new THREE.DirectionalLight('#fff4df',3);sun.position.set(-5,10,8);s.add(sun);}
const triangles=[],targetMeshes=[],targets=[],trails=[];
function box(x,y,z,w,h,d,color,solid=false){const g=new THREE.BoxGeometry(w,h,d),m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.85}));m.position.set(x,y+h/2,z);scene.add(m);if(solid){const geo=g.toNonIndexed(),p=geo.attributes.position;for(let i=0;i<p.count;i++)triangles.push(p.getX(i)+x,p.getY(i)+y+h/2,p.getZ(i)+z);geo.dispose();}return m;}
box(0,-.3,-20,30,.3,68,'#53636d',true);box(-15,0,-20,.5,4,68,'#263e4c',true);box(15,0,-20,.5,4,68,'#263e4c',true);box(0,0,-54,30,5,.5,'#263e4c',true);box(0,0,14,30,3,.5,'#263e4c',true);
for(const x of [-12,-6,0,6,12])box(x,.004,-20,.04,.006,65,'#89cdbb');
for(const z of [0,-10,-20,-30,-40,-50])box(0,.006,z,29,.008,.04,'#789494');
function sign(text,x,y,z){const c=document.createElement('canvas');c.width=256;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#142b38';ctx.fillRect(0,0,256,96);ctx.fillStyle='#a0f0d7';ctx.font='bold 38px system-ui';ctx.textAlign='center';ctx.fillText(text,128,62);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.6),new THREE.MeshBasicMaterial({map:tex}));mesh.position.set(x,y,z);scene.add(mesh);}
const scale=1/1.5;
for(const [i,distance]of [8,15,25,40,50].entries()){
 const x=[-10,-5,0,5,10][i],z=6-distance,group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
 const body=new THREE.Mesh(new THREE.BoxGeometry(.72*scale,1.28*scale,.5*scale),new THREE.MeshStandardMaterial({color:'#d5e5e2',roughness:.6}));body.position.y=.68*scale;
 const head=new THREE.Mesh(new THREE.SphereGeometry(.24*scale,14,10),new THREE.MeshStandardMaterial({color:'#f4ad73',roughness:.55}));head.position.y=1.52*scale;group.add(body,head);
 const target={id:i,group,body,head,hp:100,resetAt:0,homeX:x,distance,firstHit:0,flashUntil:0};body.userData={target,head:false};head.userData={target,head:true};targets.push(target);targetMeshes.push(body,head);sign(distance+' M',x,2,z);box(x,0,z,.9,.06,.8,'#20394a');
}
const collision=new MapCollision(new Float32Array(triangles));
const player={x:0,y:0,z:6,yaw:0,pitch:0,vx:0,vy:0,vz:0,ground:true,stance:'stand',characterScale:scale,input:{}};
let recoilPitch=0,recoilYaw=0;
let yaw=0,pitch=0,keys=new Set(),fire=false,aim=false,trigger=false,nextShot=0,reloadAt=0,slot=0,guns=['rifle','pistol'],ammo=[30,12],kit=null,gunId='',kick=0,shotAt=-1000,hitUntil=0,readoutUntil=0,jumpSeq=0,slideSeq=0;
let ready=false,shots=0,hits=0,kills=0,streak=0,audio=null,voices=0,previous=performance.now(),lastMenuFrame=0,eyeHeight=bodyShape(player).eye;
const samples=new Map(),raycaster=new THREE.Raycaster(),temp=new THREE.Vector3();
const isActive=()=>ready&&document.pointerLockElement===renderer.domElement;
for(const id of ['primary','secondary'])for(const [key,w]of Object.entries(WEAPONS)){const o=document.createElement('option');o.value=key;o.textContent=w.name.split(' / ')[1];$(id).append(o);}
try{const saved=JSON.parse(localStorage.getItem('ny-loadout'));if(saved?.length===2&&saved.every(id=>WEAPONS[id])&&saved[0]!==saved[1])guns=saved;}catch{}
$('primary').value=guns[0];$('secondary').value=guns[1];
function selectLoadout(changed){let next=[$('primary').value,$('secondary').value];if(next[0]===next[1]){const other=changed==='primary'?1:0;next[other]=guns[changed==='primary'?0:1];if(next[0]===next[1])next[other]=Object.keys(WEAPONS).find(id=>id!==next[1-other]);$('primary').value=next[0];$('secondary').value=next[1];}guns=next;ammo=guns.map(id=>WEAPONS[id].magazine);slot=0;reloadAt=0;nextShot=0;equip();}
for(const id of ['primary','secondary'])$(id).onchange=()=>selectLoadout(id);
function equip(){if(kit){view.remove(kit);disposeKit(kit);}gunId=guns[slot];kit=createImportedKit(gunId);if(kit){kit.scale.setScalar(.85);view.add(kit);}kick=0;updateHUD();}
function updateHUD(){$('gunName').textContent=WEAPONS[guns[slot]].name;$('role').textContent=WEAPONS[guns[slot]].role;$('ammo').textContent=ammo[slot]+' / '+WEAPONS[guns[slot]].magazine;$('accuracy').textContent=(shots?Math.round(hits/shots*100):0)+'% accuracy';$('targetsDown').textContent=kills+' targets down';$('shots').textContent=shots+' shots fired';}
function resetTargets(){for(const t of targets){t.hp=100;t.resetAt=0;t.firstHit=0;t.group.visible=true;}shots=hits=kills=streak=0;ammo=guns.map(id=>WEAPONS[id].magazine);reloadAt=0;hitUntil=readoutUntil=0;updateHUD();}
function release(){keys.clear();fire=aim=trigger=false;}
function setup(){release();document.exitPointerLock?.();$('rangeMenu').hidden=false;$('hud').hidden=true;}
$('setupButton').onclick=setup;
$('enter').onclick=async()=>{if(!ready)return;audio ||=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();loadAudio();try{await renderer.domElement.requestPointerLock();}catch{$('loadStatus').textContent='Mouse capture failed. Click Enter range again.';}};
document.addEventListener('pointerlockchange',()=>{const active=isActive();$('rangeMenu').hidden=active;$('hud').hidden=!active;if(!active)release();});
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)setup();});
document.addEventListener('keydown',e=>{if(!isActive())return;if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','KeyR','Digit1','Digit2','KeyQ','ControlLeft','KeyC'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='Space')jumpSeq++;if(['KeyC','ControlLeft'].includes(e.code))slideSeq++;if(e.code==='KeyR'&&!reloadAt&&ammo[slot]<WEAPONS[guns[slot]].magazine)reloadAt=performance.now()+WEAPONS[guns[slot]].reload*1000;if(['Digit1','Digit2'].includes(e.code)){slot=e.code==='Digit1'?0:1;reloadAt=0;nextShot=performance.now()+220;equip();}if(e.code==='KeyQ')resetTargets();});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('mousemove',e=>{if(isActive()){const factor=settings.sensitivity*(aim?(['sniper','dmr'].includes(guns[slot])?settings.scopeSensitivity:settings.aimSensitivity):1);yaw-=e.movementX*.002*factor;pitch=clamp(pitch-e.movementY*.002*factor*(settings.invert?-1:1),-1.45,1.45);}});
document.addEventListener('mousedown',e=>{if(!isActive())return;if(e.button===0){fire=true;shoot(performance.now());}if(e.button===2)aim=true;});document.addEventListener('mouseup',e=>{if(e.button===0){fire=false;trigger=false;}if(e.button===2)aim=false;});document.addEventListener('contextmenu',e=>e.preventDefault());
let audioLoading=false;
async function loadAudio(){if(audioLoading)return;audioLoading=true;await Promise.all(Object.keys(WEAPONS).map(async id=>{try{const r=await fetch('/audio/'+id+'.wav');if(r.ok)samples.set(id,await audio.decodeAudioData(await r.arrayBuffer()));}catch{}}));}
function tone(hz,length,volume){if(!audio||audio.state!=='running'||!settings.volume)return;const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=hz;g.gain.setValueAtTime(Math.max(.001,volume*settings.volume),audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+length);o.onended=()=>{o.disconnect();g.disconnect();};}
function gunSound(id){if(!audio)return;const b=samples.get(id);if(!b){tone(100,.09,.06);return;}if(voices>=12)return;voices++;const src=audio.createBufferSource(),gain=audio.createGain();src.buffer=b;gain.gain.value=.5*settings.volume;src.connect(gain);gain.connect(audio.destination);src.start();src.onended=()=>{voices--;src.disconnect();gain.disconnect();};}
function damageTarget(target,amount,head,distance,now){const damage=Math.min(target.hp,amount);if(!target.firstHit)target.firstHit=now;target.hp-=damage;target.flashUntil=now+90;const kill=target.hp===0;
 hitUntil=now+(kill?300:160);readoutUntil=now+1200;$('hit').textContent=head?'✧':'×';$('hit').style.color=kill?'#9affd1':head?'#ffda76':'#fff';
 $('readout').textContent=(head?'HEADSHOT':'BODY')+' · '+damage+' DMG · '+Math.round(distance)+' m\n'+(kill?'TARGET DOWN · '+((now-target.firstHit)/1000).toFixed(2)+' s':target.hp+' HP remaining');
 tone(head?1450:620,.05,.035);if(head)tone(2175,.09,.018);if(kill){kills++;streak++;tone(880,.12,.025);tone(1320,.2,.02);target.resetAt=now+1100;target.group.visible=false;}return damage;}
function shoot(now){const id=guns[slot],w=WEAPONS[id];if(!ready||(!w.auto&&trigger)||now<nextShot||reloadAt||ammo[slot]<=0)return false;
 trigger=true;nextShot=now+w.rate*1000;ammo[slot]--;shots++;shotAt=now;gunSound(id);
 const eye=new THREE.Vector3(player.x,player.y+bodyShape(player).eye,player.z);scene.updateMatrixWorld(true);const damage=new Map();
 for(let i=0;i<w.pellets;i++){const spread=weaponSpread(w,id,aim,player.ground,player.stance),scatter=sampleSpread(spread),sy=yaw+scatter.yaw,sp=pitch+scatter.pitch;const d=new THREE.Vector3(-Math.sin(sy)*Math.cos(sp),Math.sin(sp),-Math.cos(sy)*Math.cos(sp));
  const wall=collision.distance(eye,d,100);raycaster.set(eye,d);raycaster.far=wall;const hit=raycaster.intersectObjects(targetMeshes,false).find(h=>h.object.userData.target.hp>0&&h.object.userData.target.group.visible);const distance=hit?hit.distance:wall;
  if(hit){const {target,head}=hit.object.userData,entry=damage.get(target)||{amount:0,head:false,distance};entry.amount+=weaponDamage(w,distance,head);entry.head ||=head;damage.set(target,entry);}
  if(i===0){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([eye.clone().add(new THREE.Vector3(.12,-.08,0)),eye.clone().addScaledVector(d,distance)]),new THREE.LineBasicMaterial({color:'#ffe8a5',transparent:true,opacity:.6}));scene.add(line);trails.push({line,until:now+65});}
 }
 if(damage.size)hits++;for(const [target,hit]of damage)damageTarget(target,hit.amount,hit.head,hit.distance,now);
 const handling=WEAPON_HANDLING[id],control=(aim?.72:1)*(player.stance==='crouch'?.8:1);kick=Math.min(.24,kick+handling.kick*control);const oldPitch=pitch,side=(Math.random()-.5)*2*handling.side*control;pitch=clamp(pitch+handling.rise*control,-1.45,1.45);yaw+=side;recoilPitch+=pitch-oldPitch;recoilYaw+=side;updateHUD();return true;}
function update(now){requestAnimationFrame(update);const dt=Math.min((now-previous)/1000,.05);previous=now;
 if(!isActive()&&now-lastMenuFrame<100)return;lastMenuFrame=now;
 if(isActive()){
  player.input={forward:keys.has('KeyW'),back:keys.has('KeyS'),left:keys.has('KeyA'),right:keys.has('KeyD'),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),jump:keys.has('Space'),jumpSeq,slideSeq,crouch:keys.has('ControlLeft'),slide:keys.has('KeyC'),aim,fire};player.yaw=yaw;collision.move(player,dt);
  if(player.y< -3){Object.assign(player,{x:0,y:0,z:6,vy:0,vx:0,vz:0,ground:true});}
  if(fire)shoot(now);
 }
 if(reloadAt&&now>=reloadAt){ammo[slot]=WEAPONS[guns[slot]].magazine;reloadAt=0;updateHUD();}
 for(const t of targets){if(t.resetAt&&now>=t.resetAt){t.hp=100;t.resetAt=0;t.firstHit=0;t.group.visible=true;}t.group.position.x=t.homeX+($('moving').checked?Math.sin(now*.0017+t.id)*1.7:0);for(const mesh of [t.body,t.head])mesh.material.emissive.setHex(now<t.flashUntil?0x467568:0);}
 if(now-shotAt>Math.max(140,WEAPONS[guns[slot]].rate*1000+50)){const recover=1-Math.exp(-9*dt);pitch=clamp(pitch-recoilPitch*recover,-1.45,1.45);yaw-=recoilYaw*recover;recoilPitch*=1-recover;recoilYaw*=1-recover;}
 const height=bodyShape(player).eye;eyeHeight+=(height-eyeHeight)*(1-Math.exp(-24*dt));camera.position.set(player.x,player.y+eyeHeight,player.z);camera.rotation.set(pitch,yaw,0);
 const scoped=aim&&!reloadAt&&['sniper','dmr'].includes(guns[slot]);const fov=aim&&!reloadAt?(scoped?(guns[slot]==='sniper'?24:36):settings.fov*.76):settings.fov;camera.fov+=(fov-camera.fov)*(1-Math.exp(-18*dt));camera.updateProjectionMatrix();$('scope').hidden=!scoped;$('reticle').hidden=aim&&!reloadAt;const diameter=spreadDiameter(weaponSpread(WEAPONS[guns[slot]],guns[slot],false,player.ground,player.stance),camera.fov,innerHeight);$('reticle').style.width=$('reticle').style.height=(diameter+16)+'px';$('reticle').classList.toggle('wide-spread',['sniper','shotgun','autoshot'].includes(guns[slot]));
 if(kit){const w=WEAPONS[guns[slot]],ads=aim&&!reloadAt,progress=reloadAt?clamp(1-(reloadAt-now)/(w.reload*1000),0,1):0;const dip=Math.sin(progress*Math.PI);kick*=Math.exp(-WEAPON_HANDLING[guns[slot]].return*dt);(kit.userData.pose ||= new THREE.Vector3(.23,-.245,-.68)).lerp(temp.set(ads?0:.23,ads?-kit.userData.sightHeight*.85:-.245-dip*.14,ads?kit.userData.adsZ:-.68),1-Math.exp(-22*dt));kit.position.copy(kit.userData.pose);kit.position.z+=kick*.7;kit.rotation.set(kick*1.4,0,-dip*.35);kit.visible=!scoped;kit.userData.muzzle.visible=now-shotAt<65;kit.userData.muzzle.rotation.z=now*.03;}
 $('ammo').textContent=reloadAt?'RELOADING':ammo[slot]+' / '+WEAPONS[guns[slot]].magazine;$('hit').style.opacity=clamp((hitUntil-now)/70,0,1);$('readout').style.opacity=clamp((readoutUntil-now)/200,0,1);
 for(let i=trails.length-1;i>=0;i--)if(now>trails[i].until){const {line}=trails.splice(i,1)[0];scene.remove(line);line.geometry.dispose();line.material.dispose();}
 renderer.autoClear=true;renderer.render(scene,camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(view,viewCamera);
}
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=viewCamera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();viewCamera.updateProjectionMatrix();});
try{const result=await preloadWeapons();if(result.errors.length)throw Error('Some weapons failed to load. Refresh to retry.');ready=true;selectLoadout('primary');$('enter').disabled=false;$('enter').textContent='Enter range →';$('loadStatus').textContent='Ready · practice stays separate from multiplayer';$('hud').hidden=true;requestAnimationFrame(update);}catch(e){$('loadStatus').textContent=e.message;console.error(e);}
// Exported state also supports deterministic smoke checks of the standalone range.
export const range={get ready(){return ready;},player,targets,shoot,resetTargets,selectLoadout,get stats(){return {shots,hits,kills,ammo:[...ammo],guns:[...guns]};},aimAt(target,head=false){yaw=Math.atan2(-(target.group.position.x-player.x),-(target.group.position.z-player.z));const horizontal=Math.hypot(target.group.position.x-player.x,target.group.position.z-player.z);pitch=Math.atan2((head?target.head.position.y:target.body.position.y)-(player.y+bodyShape(player).eye),horizontal);aim=true;trigger=false;},release};
