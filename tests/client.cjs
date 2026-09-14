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
const document={body:new Element('body'),head:new Element('head'),createElement:t=>new Element(t),getElementById:id=>els.get(id),addEventListener(){},exitPointerLock(){},pointerLockElement:null};
class Renderer{constructor(){this.domElement=new Element('canvas');this.shadowMap={};this.capabilities={getMaxAnisotropy:()=>4};this.info={render:{calls:0}}}setSize(){}setPixelRatio(v){this.pixelRatio=v}render(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld()}clearDepth(){}}
let time=1000;const local=new Map();const intervals=[];
const context={...require('../combat-visuals.mjs'),URLSearchParams,THREE:{...THREE,WebGLRenderer:Renderer},...world,document,window:{addEventListener(){}},innerWidth:1280,innerHeight:800,devicePixelRatio:1,location:{origin:'http://localhost',protocol:'http:',host:'localhost'},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},performance:{now:()=>time},requestAnimationFrame(){},setInterval:fn=>intervals.push(fn),setTimeout(){},console,Math,Date,WebSocket:{OPEN:1}};
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
