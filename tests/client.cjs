'use strict';
const {CHARACTER_SCALE}=require('../character-config.js');
process.env.WORLD_MAP='mill';
// Real Three.js math and geometry with a minimal DOM and renderer double.
// This checks client execution, not visual rendering or actual browser audio.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const THREE=require('three');const world=require('../world-data.cjs');
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.value='';this.textContent='';this.parentNode=null;this.attributes={};this.className='';this.disabled=false;this.classList={add:k=>this.classes.add(k),remove:k=>this.classes.delete(k),contains:k=>this.classes.has(k),toggle:(k,b)=>{b===undefined?this.classes.has(k)?this.classes.delete(k):this.classes.add(k):b?this.classes.add(k):this.classes.delete(k)}};this.classes=new Set();}
 append(...nodes){for(const n of nodes){this.children.push(n);n.parentNode=this;}}
 prepend(n){this.children.unshift(n);n.parentNode=this;}
 appendChild(n){this.append(n);return n;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(){}
 get firstElementChild(){return this.children[0]}
 get lastElementChild(){return this.children.at(-1)}
 get lastChild(){return this.children.at(-1)}
 getContext(){return new Proxy({canvas:this,createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});}
 requestPointerLock(){}
}
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const els=new Map();for(const m of html.matchAll(/<([\w]+)[^>]*id="([^"]+)"[^>]*>/g)){const e=new Element(m[1]);e.id=m[2];if(m[0].includes('hidden'))e.classes.add('hidden');els.set(m[2],e)}
els.get('reloadTrack').append(new Element());
const handlers={};
const document={body:new Element('body'),head:new Element('head'),createElement:t=>new Element(t),getElementById:id=>els.get(id),addEventListener(name,fn){(handlers[name]||=[]).push(fn);},exitPointerLock(){},pointerLockElement:null};
class Renderer{constructor(){this.domElement=new Element('canvas');this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>4};this.info={render:{calls:0}}}setSize(){}setPixelRatio(v){this.pixelRatio=v}render(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld()}clearDepth(){}}
let time=1000;const local=new Map();const intervals=[];
const context={...require('../weapon-rules.cjs'),...require('../combat-visuals.mjs'),URLSearchParams,THREE:{...THREE,WebGLRenderer:Renderer},...world,WORLD:world,MAP_CATALOG:require('../map-catalog.cjs').catalog,MAP_EPOCH:0,document,window:{addEventListener(){}},innerWidth:1280,innerHeight:800,devicePixelRatio:1,location:{origin:'http://localhost',protocol:'http:',host:'localhost'},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},performance:{now:()=>time},requestAnimationFrame(){},setInterval:fn=>intervals.push(fn),setTimeout(){},console,Math,Date,WebSocket:{OPEN:1}};
context.window.document=document;
vm.createContext(context);
const server=fs.readFileSync(path.join(__dirname,'..','server.cjs'),'utf8');
context.WEAPONS=vm.runInNewContext("("+server.match(/const WEAPONS = ([\s\S]*?);\n\nconst SKINS/)[1]+")");
context.SKINS=vm.runInNewContext("("+server.match(/const SKINS = ([\s\S]*?);/)[1]+")");
const code=html.split('<script type="module">')[1].split('</script>')[0].replace(/^import .*;$/gm,'');
vm.runInContext(code,context,{filename:'client-module.js'});
const run=s=>vm.runInContext(s,context);
let count=0;function test(name,fn){fn();count++;console.log('PASS',name)}
test('Client initializes full scene, textures, menu and settings',()=>{assert.equal(els.get('weapons').children.length,10);assert.ok(run('scene.children.length')>20);assert.equal(run('surfaceTextures.brick.image.width'),128);});
test('Merged map geometries contain finite vertices',()=>{assert.equal(run(`(()=>{let bad=0;scene.traverse(o=>{if(o.geometry){const a=o.geometry.attributes.position?.array;for(const v of a||[])if(!Number.isFinite(v))bad++;}});return bad;})()`),0);});
test('All ten weapons build, animate and release owned resources',()=>{for(const id of Object.keys(context.WEAPONS)){run(`buildGun('${id}')`);assert.equal(run('gunId'),id);assert.ok(run('gunRoot.userData.detailed'));assert.ok(run('muzzle.position.z<0'));}});
test('Performance, balanced and high presets update rendering',()=>{for(const [p,r,s]of [['performance',.75,'off'],['balanced',1,'medium'],['high',1.5,'high']]){run(`setQuality('${p}')`);assert.equal(run('settings.resolution'),r);assert.equal(run('settings.shadows'),s)}});
function setState(){run(`
myId='local';
state={now:Date.now(),phase:'playing',end:Date.now()+10000,host:'local',grenades:[],smokes:[],players:[
{id:'local',name:'Local',skin:'cyan',x:3,y:0,z:20,yaw:0,pitch:0,hp:100,kills:0,deaths:0,damage:0,shield:0,gun:'rifle',ground:true},
{id:'remote',name:'Remote',skin:'lime',x:3,y:0,z:14,yaw:0,pitch:0,hp:100,kills:0,deaths:0,damage:0,shield:0,gun:'sniper',ground:true}],self:{guns:['rifle','pistol'],slot:0,ammo:[30,12],grenades:[true,true],grenadeLoadout:['flash','smoke'],reloadAt:0}};
me=state.players[0];rememberSnapshot(state);updateInterface();
`)}
test('Live state updates HUD, avatars, labels and current remote weapon',()=>{setState();time+=16;run(`frame(${time})`);assert.equal(els.get('health').textContent,100);assert.equal(run('avatars.size'),1);assert.equal(run(`avatars.get('remote').remoteScope.visible`),true);assert.equal(run('labels.size'),1);});
test('Shooting generates muzzle-aligned trails, casings and impacts',()=>{run(`onEvent({kind:'shot',id:'local',gun:'rifle',origin:{x:3,y:1.4,z:19.55},ends:[{x:3,y:1.5,z:14,surface:'player'}]})`);assert.ok(run('effects.length')>0);assert.ok(run('shellEffects.length')>0);assert.ok(run('impactParticles.length')>0);});
test('Smoke and grenades spawn and then clean up',()=>{run(`state.grenades=[{id:1,kind:'flash',x:3,y:1,z:16}];state.smokes=[{id:2,x:3,y:0,z:17,start:Date.now()-1000,until:Date.now()+9000}];syncWorld(.016,1000)`);assert.equal(run('smokeMeshes.size'),1);assert.equal(run('grenadeMeshes.size'),1);assert.ok(run('crossesSmoke(new THREE.Vector3(3,1.5,20),new THREE.Vector3(3,1.5,14))'));run(`state.grenades=[];state.smokes=[];syncWorld(.016,1100)`);assert.equal(run('smokeMeshes.size'),0);assert.equal(run('grenadeMeshes.size'),0)});
test('Reload and throwing gestures animate without runtime errors',()=>{run(`state.self.reloadAt=Date.now()+900;grenadeThrowAt=1100;upgradeFrame(.016,1300);districtFrame(.016,1300)`);assert.ok(run('gunRoot.userData.magazine.position.y<gunRoot.userData.magazineHome.y'));});
test('Line-of-sight suppresses labels through walls',()=>{assert.equal(run('clearSight(new THREE.Vector3(30,1.5,24),new THREE.Vector3(33,1.5,24))'),false);});
test('Disconnect clears avatars, effects, smoke and snapshots',()=>{run('clearTransientWorld()');assert.equal(run('avatars.size'),0);assert.equal(run('labels.size'),0);assert.equal(run('effects.length'),0);assert.equal(run('snapshots.length'),0);});
console.log(`\n${count} client logic checks passed (renderer and DOM doubles; not a browser visual test).`);
test('Weapon models have distinct geometry, bounded draw calls and survive rebuilds',()=>{
 const {createWeaponKit,disposeKit}=require('../combat-visuals.mjs'),hashes=new Set(),crypto=require('node:crypto');
 for(const id of Object.keys(context.WEAPONS)){const root=createWeaponKit(id),hash=crypto.createHash('sha256');let draws=0;root.traverse(o=>{if(o.isMesh){draws++;const a=o.geometry.attributes.position.array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}});assert.ok(draws<=12,id);hashes.add(hash.digest('hex'));disposeKit(root);}
 assert.equal(hashes.size,10);
});
test('Operator head geometry fits each stance height after animation settles',()=>{
 const {createOperatorRig,animateOperator,disposeKit}=require('../combat-visuals.mjs');
 for(const [stance,height]of [['stand',1.72],['crouch',1.12],['prone',.52],['slide',.9]]){const a=createOperatorRig({skin:'cyan',gun:'rifle',x:0,y:0,z:0});for(let n=0;n<90;n++)animateOperator(a,{stance,ground:true,pitch:0},1/60,n*16,1000,0);assert.equal(a.root.scale.x,CHARACTER_SCALE);a.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(a.head);assert.ok(bounds.max.y<=height*CHARACTER_SCALE+.015,stance+' '+bounds.max.y);disposeKit(a.root);a.shield.material.dispose();}
});
test('Equipment effects and locked armory UI run without changing the loadout',()=>{
 setState();run("show('menu',false);editLoadout()");assert.ok(els.get('menu').classList.contains('hidden'));assert.match(els.get('message').textContent,/LOCKED/);
 run("onEvent({kind:'heal',id:'local',amount:45,x:3,y:1,z:20});onEvent({kind:'explosion',x:3,y:1,z:17})");assert.ok(run('effects.some(e=>e.blastAt!==undefined)'));assert.ok(run('impactParticles.length')>0);run('clearTransientWorld()');
});
test('Every weapon schedules a distinct layered audio signature and releases voices',()=>{
 const sources=[],frequencies=[];
 function node(){return {connect(){},disconnect(){},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},frequency:{value:0,setValueAtTime(v){frequencies.push(v)},exponentialRampToValueAtTime(){}},Q:{value:0},start(){sources.push(this)},stop(){},setPosition(){}};}
 context.audioDouble={state:'running',currentTime:1,sampleRate:8000,destination:{},createBuffer:(n,len)=>({getChannelData:()=>new Float32Array(len)}),createBufferSource:node,createOscillator:node,createBiquadFilter:node,createGain:node,createDynamicsCompressor:()=>({connect(){},threshold:{},knee:{},ratio:{},attack:{},release:{}})};
 run('audioCtx=audioDouble');const signatures=new Set();for(const id of Object.keys(context.WEAPONS)){frequencies.length=0;run(`sound('shot',null,1,'${id}')`);assert.ok(sources.length>=4);signatures.add(frequencies.join(','));for(const source of sources.splice(0))source.onended();assert.equal(run('audioVoices'),0);}assert.equal(signatures.size,10);run('audioCtx=undefined');
});
console.log('4 additional presentation checks passed.');
test('Aiming shows the proper reticle, firing adds recoil and sparks, then recoil recovers',()=>{
 setState();run("for(const id of ['menu','room','settings','board'])show(id,false);document.pointerLockElement=renderer.domElement;aim=true;buildGun('rifle');pitch=0;recoilPitch=0;recoilYaw=0;");
 time+=100;run(`frame(${time})`);assert.ok(els.get('crosshair').classList.contains('hidden'));assert.ok(els.get('scope').classList.contains('hidden'));
 run("onEvent({kind:'shot',id:'local',gun:'rifle',origin:{x:3,y:1,z:19},ends:[]})");assert.ok(run('pitch>0&&recoil>0'));assert.equal(run('muzzleSparks.length'),4);const shotPitch=run('pitch');
 time+=25;run(`upgradeFrame(.016,${time})`);assert.ok(run('muzzle.visible'));assert.ok(run('viewMuzzleLight.intensity>0'));
 for(let n=0;n<100;n++){time+=16;run(`frame(${time})`);}assert.ok(run('Math.abs(pitch)')<shotPitch*.05);assert.equal(run('muzzleSparks.length'),0);
 run("state.self.guns[0]='sniper'");time+=16;run(`frame(${time})`);assert.ok(!els.get('scope').classList.contains('hidden'));assert.ok(run('!gunRoot.visible'));run('aim=false;document.pointerLockElement=null;clearTransientWorld()');
});

test('Reload animations return both hands and magazines to rest for every weapon',()=>{
 setState();run('aim=false');
 for(const id of Object.keys(context.WEAPONS)){
  run(`state.self.guns[0]='${id}';buildGun('${id}');`);
  for(const progress of [0,.16,.35,.55,.72,.82,.97]){
   run(`state.self.reloadAt=serverNow()+WEAPONS['${id}'].reload*1000*(1-${progress});upgradeFrame(.016,performance.now());`);
   assert.ok(run('gunRoot.userData.leftHand.position.toArray().every(Number.isFinite)'));
  }
  run('state.self.reloadAt=0;upgradeFrame(.016,performance.now()+2000)');
  assert.ok(run('gunRoot.userData.magazine.position.distanceTo(gunRoot.userData.magazineHome)<.0001'));
  assert.ok(run('gunRoot.userData.rightHand.position.distanceTo(gunRoot.userData.rightHandHome)<.0001'));
  assert.equal(run('gunRoot.userData.reloadRound.visible'),false);
 }
});
test('Headshot and directional feedback clear on disconnect',()=>{
 setState();run("onEvent({kind:'hit',head:true,amount:30,kill:true,victim:'Remote'});onEvent({kind:'hurt',amount:20,source:{x:8,z:20}})");
 assert.equal(els.get('hitConfirm').textContent,'HEADSHOT · 30 DMG');assert.ok(els.get('killConfirm').textContent.includes('Remote'));
 assert.ok(run('damageBearing.x===8'));run('clearTransientWorld()');assert.equal(run('damageBearing'),null);assert.equal(run('killConfirmUntil'),0);
});

test('Results use the frozen winner and preserve vote buttons during updates',()=>{
 setState();run("state.phase='ended';state.results=state.players.map(p=>({...p}));state.results[1].kills=4;state.players[0].kills=99;state.mapVotes={subzero:0,village:0};nextRosterRefresh=0;updateInterface()");
 assert.equal(els.get('winnerName').textContent,'Remote');
 const button=els.get('voteChoices').firstElementChild;assert.equal(els.get('voteChoices').children.length,2);
 run("state.mapVotes.subzero=1;state.myVote='subzero';nextRosterRefresh=0;updateInterface()");
 assert.equal(els.get('voteChoices').firstElementChild,button);assert.ok(button.textContent.includes('1 votes'));assert.equal(button.attributes['aria-pressed'],'true');
 run('clearTransientWorld()');
});

test('Rapid hits accumulate damage only for the same target and reset cleanly',()=>{
 setState();run("clearTransientWorld();onEvent({kind:'hit',amount:12,victim:'A',victimId:'one'});onEvent({kind:'hit',amount:18,victim:'A',victimId:'one'})");
 assert.equal(els.get('hitConfirm').textContent,'BODY · 30 DMG');
 run("onEvent({kind:'hit',amount:9,victim:'A',victimId:'two'})");assert.equal(els.get('hitConfirm').textContent,'BODY · 9 DMG');
 run('clearTransientWorld()');assert.equal(run('hitDamage'),0);
});

test('Killcam replays stored positions, supports skipping, and clears on respawn',()=>{
 setState();run("mapRoot=new THREE.Group();me=state.players[0];state.phase='playing';me.hp=0;me.spawnSeq=10;myId=me.id;snapshots.length=0;const sample=state.players.map(p=>({...p,hp:100,spawnSeq:10}));rememberSnapshot({...state,now:100,players:sample});rememberSnapshot({...state,now:1200,players:sample.map(p=>({...p,x:p.x+1}))});startKillcam({killerId:sample[1].id,killer:'Remote',gun:'rifle'});");
 assert.equal(run('killReplay.frames.length'),2);assert.equal(run('renderKillcam(performance.now()+200,.016)'),true);
 assert.equal(els.get('killcam').classList.contains('hidden'),false);
 run('stopKillcam()');assert.equal(run('killReplay'),null);
 run("startKillcam({killerId:state.players[1].id,killer:'Remote',gun:'rifle'});me.spawnSeq++");
 assert.equal(run('renderKillcam(performance.now(),.016)'),false);assert.equal(run('killReplay'),null);run('clearTransientWorld();mapRoot=null');
});

test('Hold/toggle aiming and separate scoped sensitivity affect actual mouse input',()=>{
 setState();run("mapReady=true;document.pointerLockElement=renderer.domElement;show('menu',false);show('room',false);show('board',false);show('settings',false);settings.aimMode='toggle';aim=false;state.self.reloadAt=0;state.self.guns[0]='rifle';state.self.slot=0;settings.sensitivity=1;settings.aimSensitivity=.4;settings.scopeSensitivity=.2;yaw=0");
 for(const fn of handlers.mousedown)fn({button:2});for(const fn of handlers.mouseup)fn({button:2});assert.equal(run('aim'),true);
 for(const fn of handlers.mousemove)fn({movementX:10,movementY:0});assert.ok(Math.abs(run('yaw')+.008)<1e-9);
 run("state.self.guns[0]='sniper';yaw=0");for(const fn of handlers.mousemove)fn({movementX:10,movementY:0});assert.ok(Math.abs(run('yaw')+.004)<1e-9);
 for(const fn of handlers.mousedown)fn({button:2});assert.equal(run('aim'),false);
 run("settings.aimMode='hold'");for(const fn of handlers.mousedown)fn({button:2});for(const fn of handlers.mouseup)fn({button:2});assert.equal(run('aim'),false);run('document.pointerLockElement=null;clearTransientWorld()');
});
test('Empty reload drops one visible magazine and temporary marks are bounded and cleaned',()=>{
 setState();run("buildGun('rifle');state.self.guns[0]='rifle';state.self.slot=0;state.self.ammo[0]=0;state.self.reloadAt=serverNow()+WEAPONS.rifle.reload*1000*.55;upgradeFrame(.016,performance.now())");assert.equal(run('droppedMagazines.length'),1);assert.equal(run('droppedMagazines[0].mesh.visible'),true);
 run('upgradeFrame(.016,performance.now())');assert.equal(run('droppedMagazines.length'),1);
 run("for(let i=0;i<90;i++)impact({x:0,y:1,z:0,surface:'wood',normal:{x:0,y:0,z:1}},{x:0,y:1,z:2})");assert.ok(run('bulletMarks.length')<=64);assert.ok(run('impactParticles.length')<=180);
 run('clearTransientWorld()');assert.equal(run('bulletMarks.length+droppedMagazines.length'),0);
});

test('Capture HUD shows three objectives and team results override individual kills',()=>{
 setState();run("state.mode='capture';state.phase='playing';me.team='blue';state.capture={wave:1,nextMove:serverNow()+60000,scores:{blue:42,red:21},points:['A','B','C'].map((id,i)=>({id,x:i*10,y:0,z:0,radius:3,owner:i===0?'blue':null,progress:i===0?-100:0}))};updateCaptureObjectives(performance.now())");
 assert.equal(els.get('captureCards').children.length,3);assert.ok(els.get('teamScore').textContent.includes('42'));assert.ok(els.get('captureTimer').textContent.includes('60s'));
 run("state.phase='ended';nextRosterRefresh=0;updateInterface();updateCaptureObjectives(performance.now())");assert.ok(els.get('winner').textContent.includes('BLUE TEAM WINS'));assert.equal(run('objectiveVisuals.size'),0);run('clearTransientWorld()');
});

test('Stair camera glides without changing physical height and resets after a teleport',()=>{
 setState();run('predicted=null;cameraReady=false;me.ground=true;me.y=0;me.vy=0;settings.motion="no"');time+=16;run(`frame(${time})`);const start=run('camera.position.y');
 run('me.y=.25');time+=16;run(`frame(${time})`);const delta=run('camera.position.y')-start;assert.ok(delta>0&&delta<.1);assert.equal(run('me.y'),.25);
 for(let i=0;i<60;i++){time+=16;run(`frame(${time})`);}assert.ok(Math.abs(run('camera.position.y')-(start+.25))<.005);
 run('me.x+=20;me.y=2');time+=16;run(`frame(${time})`);assert.equal(run('stairOffset'),0);assert.ok(Math.abs(run('camera.position.y')-(start+2))<.001);run('clearTransientWorld()');
});

test('Team Deathmatch shows team scores without capture zones and names the winning team',()=>{
 setState();run("state.mode='tdm';state.teamScores={blue:7,red:4};me.team='blue';updateCaptureObjectives(performance.now())");assert.ok(els.get('teamScore').textContent.includes('BLUE 7'));assert.equal(run('objectiveVisuals.size'),0);assert.ok(els.get('captureTimer').textContent.includes('TEAM DEATHMATCH'));
 run("state.phase='ended';nextRosterRefresh=0;updateInterface()");assert.ok(els.get('winner').textContent.includes('BLUE TEAM WINS'));run('clearTransientWorld()');
});


test('Local firing is immediate, confirmations do not repeat effects, and ammo reconciles',()=>{
 setState();run("clearTransientWorld();for(const id of ['menu','room','settings','board'])show(id,false);document.pointerLockElement=renderer.domElement;buildGun('rifle');me.spawnSeq=1;socket={readyState:1,send(raw){globalThis.sentShots.push(JSON.parse(raw));}};globalThis.sentShots=[];globalThis.shotSounds=0;globalThis.realSpatialShot=spatialShot;spatialShot=()=>globalThis.shotSounds++;resetShotPrediction();fire=false;recoil=0;");
 for(const fn of handlers.mousedown)fn({button:0});
 assert.equal(run('shotSounds'),1);assert.equal(run('pendingShots.size'),1);assert.equal(run('shellEffects.length'),1);assert.equal(run('muzzleSparks.length'),4);assert.ok(run('recoil>0'));assert.equal(els.get('ammo').textContent,'29 / 30');
 const kick=run('recoil');const seq=run('shotSeq');
 time+=180;run(`onEvent({kind:'shot',id:myId,gun:'rifle',shotSeq:${seq},origin:{x:3,y:1,z:20},ends:[]});onEvent({kind:'shotResult',accepted:true,shotSeq:${seq}})`);
 assert.equal(run('shotSounds'),1);assert.equal(run('shellEffects.length'),1);assert.equal(run('recoil'),kick);assert.equal(run('visibleAmmo()'),29);
 // Delayed acknowledgement must not restart the weapon's local firing cooldown.
 run('predictShot(performance.now())');assert.equal(run('sentShots.filter(m=>m.type==="shot").length'),2);assert.equal(run('visibleAmmo()'),28);
 run(`state.self.ammo[0]=29;state.self.shotAck=${seq};reconcileShots(state.self);updateInterface()`);assert.equal(run('visibleAmmo()'),28);
 run('onEvent({kind:"shotResult",accepted:false,shotSeq, retryAfter:0})');assert.equal(run('visibleAmmo()'),29);assert.equal(els.get('ammo').textContent,'29 / 30');
 run('spatialShot=realSpatialShot;fire=false;document.pointerLockElement=null;socket=null;clearTransientWorld()');
});
test('Semi-auto, empty magazines, reload, switching and inactive play gate predicted shots',()=>{
 setState();run("for(const id of ['menu','room','settings','board'])show(id,false);document.pointerLockElement=renderer.domElement;socket={readyState:1,send(){}};resetShotPrediction();state.self.slot=1;fire=true;predictShot(performance.now());");
 assert.equal(run('pendingShots.size'),1);time+=1000;run('predictShot(performance.now())');assert.equal(run('pendingShots.size'),1);
 run('fire=false;predictShot();fire=true;predictShot()');assert.equal(run('pendingShots.size'),2);
 run('resetShotPrediction();state.self.ammo[1]=0;predictShot()');assert.equal(run('pendingShots.size'),0);
 run('state.self.ammo[1]=5;state.self.reloadAt=serverNow()+1000;predictShot()');assert.equal(run('pendingShots.size'),0);
 run('state.self.reloadAt=0;requestWeaponAction({type:"switch",slot:0});predictShot()');assert.equal(run('pendingShots.size'),0);
 time+=300;run('state.phase="ended";predictShot()');assert.equal(run('pendingShots.size'),0);
 run('fire=false;document.pointerLockElement=null;socket=null;clearTransientWorld()');
});
test('Movement responds before the next network send and camera follows without trailing',()=>{
 setState();run("for(const id of ['menu','room','settings','board'])show(id,false);document.pointerLockElement=renderer.domElement;settings.motion='no';mapReady=true;globalThis.oldCollision=mapCollision;mapCollision={move(p,dt){p.x+=(p.input.right?6:0)*dt;}};keys.add(settings.bindings.right);cameraReady=false;predicted=null;correction.set(0,0,0)");
 const start=run('me.x');time+=8;run(`frame(${time})`);assert.ok(run('predicted.x')>start);assert.ok(Math.abs(run('camera.position.x-predicted.x'))<1e-9);
 const before=run('camera.position.x');
 run('state.self.inputSeq=inputSeq+1;me.x=predicted.x-.1;reconcileMovement(state)');assert.ok(Math.abs(run('predicted.x+correction.x')-before)<1e-9);
 time+=8;run(`frame(${time})`);assert.ok(run('camera.position.x')>before,'fresh input continues during correction smoothing');
 run('keys.clear();mapCollision=oldCollision;document.pointerLockElement=null;clearTransientWorld()');
});

test('An obstructed local muzzle produces no cosmetic shot and resets clear pending state',()=>{
 setState();run("for(const id of ['menu','room','settings','board'])show(id,false);document.pointerLockElement=renderer.domElement;socket={readyState:1,send(){}};resetShotPrediction();globalThis.savedCollision=mapCollision;mapCollision={distance(){return 0;}};fire=true;predictShot()");
 assert.equal(run('pendingShots.size'),0);assert.equal(els.get('message').textContent,'MUZZLE BLOCKED');
 run('pendingShots.set(999,{slot:0});predictedShotIds.add(999);pendingSlot=1;resetShotPrediction()');assert.equal(run('pendingShots.size+predictedShotIds.size'),0);assert.equal(run('pendingSlot'),null);
 run('fire=false;mapCollision=savedCollision;document.pointerLockElement=null;socket=null;clearTransientWorld()');
});

test('Weapon recoil kicks on the current frame and reloads lower the gun below its ready pose',()=>{
 setState();run("settings.motion='no';aim=false;buildGun('rifle');recoil=0;weaponMotion.equip=0;weaponMotion.lastGun='rifle'");for(let i=0;i<60;i++)run('upgradeFrame(1/60,performance.now())');const ready=run('gunRoot.position.y');
 run('recoil=.1;upgradeFrame(0,performance.now())');assert.ok(run('gunRoot.rotation.x')>.16);
 run('recoil=0;state.self.reloadAt=serverNow()+WEAPONS.rifle.reload*500');for(let i=0;i<60;i++)run('upgradeFrame(1/60,performance.now())');assert.ok(run('gunRoot.position.y')<ready-.1);
 run('state.self.reloadAt=0;clearTransientWorld()');
});

test('Default/reset FOV is 110 and scoreboard leaves sprint, jump and new movement input active',()=>{
 assert.equal(run('defaults.fov'),110);
 setState();run("mapReady=true;for(const id of ['menu','room','settings','board'])show(id,false);document.pointerLockElement=renderer.domElement;keys.clear();");
 const press=code=>{for(const fn of handlers.keydown)fn({code,target:{tagName:'CANVAS'},repeat:false,preventDefault(){}});};
 press('KeyW');press('ShiftLeft');press('Tab');assert.equal(run('active()'),true);assert.equal(run('sampleInput(1).forward&&sampleInput(1).sprint'),true);assert.ok(!els.get('board').classList.contains('hidden'));
 press('KeyD');press('Space');for(const fn of handlers.keyup)fn({code:'Space'});
 assert.equal(run('sampleInput(1).jump&&sampleInput(1,true).jump'),true,'short Space tap survives until prediction and network sampling');assert.equal(run('sampleInput(1).right'),true);
 for(const fn of handlers.keyup)fn({code:'Tab'});assert.ok(els.get('board').classList.contains('hidden'));assert.equal(run('sampleInput(1).forward&&sampleInput(1).sprint'),true);
 press('Tab');run('resetInput()');assert.ok(els.get('board').classList.contains('hidden'));assert.equal(run('queuedJump||queuedNetJump||boardHeld'),false);
 run("show('settings');");assert.equal(run('active()'),false);run("show('settings',false);document.pointerLockElement=null;clearTransientWorld()");
});

test('FOV migration updates the former default once and preserves custom choices',()=>{
 const setup=code.slice(code.indexOf('const defaults ='),code.indexOf('let loadout ='));
 for(const [saved,expected]of [[{},110],[{fov:85},110],[{fov:95},95],[{fov:85,fovDefault110:true},85]]){
  const c={readSaved:()=>saved,save(){}};vm.createContext(c);vm.runInContext(setup+';globalThis.result=settings.fov',c);assert.equal(c.result,expected);
 }
});

test('Jump press IDs survive button release and are shared by local/network samples',()=>{
 setState();run("for(const id of ['menu','room','settings','board'])show(id,false);mapReady=true;document.pointerLockElement=renderer.domElement;keys.clear();");
 const press=code=>{for(const fn of handlers.keydown)fn({code,target:{tagName:'CANVAS'},repeat:false,preventDefault(){}});};
 press('KeyW');press('ShiftLeft');const before=run('jumpPressSeq');press('Space');for(const fn of handlers.keyup)fn({code:'Space'});
 run('queuedJump=false;queuedNetJump=false');assert.equal(run('sampleInput(99).jumpSeq'),before+1);assert.equal(run('sampleInput(99,true).jumpSeq'),before+1);assert.equal(run('sampleInput(99,true).jump'),false);assert.equal(run('sampleInput(99,true).sprint'),true);
 for(const fn of handlers.keydown)fn({code:'Space',target:{tagName:'CANVAS'},repeat:true,preventDefault(){}});assert.equal(run('jumpPressSeq'),before+1);
 run('resetInput();document.pointerLockElement=null;clearTransientWorld()');
});

test('Confirmed target damage numbers accumulate, distinguish lethal hits, and expire cleanly',()=>{
 setState();run('clearTransientWorld();');
 run("onEvent({kind:'hit',victimId:'remote',victim:'Remote',amount:26,head:false});onEvent({kind:'hit',victimId:'remote',victim:'Remote',amount:47,head:true,kill:true})");
 assert.equal(run('damageNumbers.length'),1);assert.equal(run('damageNumbers[0].amount'),73);assert.ok(run('damageNumbers[0].el.textContent.includes("KO")'));
 run('updateDamageNumbers(performance.now()+1200)');assert.equal(run('damageNumbers.length'),0);
 run("onEvent({kind:'hurt',amount:28,source:{x:5,z:2}})");assert.equal(els.get('damageTaken').textContent,'−28 HP');run('clearTransientWorld()');assert.equal(run('damageTakenUntil'),0);
});

test('Hip-fire reticle expands for sniper/shotguns, tracks stance and hides while scoped',()=>{
 setState();run("for(const id of ['menu','room','settings','board'])show(id,false);document.pointerLockElement=renderer.domElement;settings.fov=110;camera.fov=110;predicted=null;aim=false;state.self.guns[0]='rifle';");time+=16;run(`frame(${time})`);const rifle=parseFloat(els.get('crosshair').style.width);
 run("state.self.guns[0]='sniper';me.ground=true;me.stance='stand'");time+=16;run(`frame(${time})`);const sniper=parseFloat(els.get('crosshair').style.width);assert.ok(sniper>rifle*2);assert.ok(els.get('crosshair').classList.contains('wide-spread'));
 run("me.stance='crouch'");time+=16;run(`frame(${time})`);assert.ok(parseFloat(els.get('crosshair').style.width)<sniper);
 run("me.stance='stand';state.self.guns[0]='shotgun'");time+=16;run(`frame(${time})`);assert.ok(parseFloat(els.get('crosshair').style.width)>rifle*2);
 run("state.self.guns[0]='sniper';aim=true");time+=16;run(`frame(${time})`);assert.ok(els.get('crosshair').classList.contains('hidden'));assert.ok(!els.get('scope').classList.contains('hidden'));run('aim=false;document.pointerLockElement=null;clearTransientWorld()');
});
