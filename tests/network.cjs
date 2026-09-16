'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const WS=require('ws');
const port=18281,url=`http://127.0.0.1:${port}`,sockets=[];
const server=spawn(process.execPath,[path.join(__dirname,'..','server.cjs')],{env:{...process.env,PORT:String(port),ROUND_MS:'2200'},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<400;i++){const v=fn();if(v)return v;await delay(30)}throw Error('Timed out: '+label+'\n'+logs);}
async function join(name){const ws=new WS(url),c={ws,events:[],states:[],id:null,autoReady:true};sockets.push(ws);ws.on('message',raw=>{const m=JSON.parse(raw);c.events.push(m);if(m.type==='state')c.states.push(m);if(m.type==='welcome'){c.id=m.id;ws.send(JSON.stringify({type:'mapReady',mapId:m.mapId,mapEpoch:m.mapEpoch}));}if(m.type==='mapChanged'&&c.autoReady)ws.send(JSON.stringify({type:'mapReady',mapId:m.mapId,mapEpoch:m.mapEpoch}))});await new Promise((r,j)=>{ws.on('open',r);ws.on('error',j)});ws.send(JSON.stringify({type:'join',name,loadout:['rifle','pistol'],grenades:['flash','smoke']}));await until(()=>c.id,'join');return c;}
const send=(c,m)=>c.ws.send(JSON.stringify(m));
(async()=>{
 await until(()=>logs.includes('This computer:'),'server startup');
 for(const route of ['/','/world.js','/three.module.js','/three.core.js','/district.css']){const r=await fetch(url+route);assert.equal(r.status,200);assert.ok((await r.text()).length>20)}
 console.log('PASS all five locally served asset routes');
 assert.equal((await fetch(url+'/server.cjs')).status,404);console.log('PASS server source is not publicly served');
 for(const route of ['/addons/loaders/GLTFLoader.js','/addons/utils/BufferGeometryUtils.js','/addons/utils/SkeletonUtils.js','/map-collision.js','/combat-visuals.js','/combat.css','/character-config.js','/weapon-models.mjs','/weapon-credits.html'])assert.equal((await fetch(url+route)).status,200);
 const weapons=await (await fetch(url+'/weapons/manifest.json')).json();assert.equal(Object.keys(weapons.weapons).length,10);
 for(const route of ['/maps/subzero.glb','/maps/subzero-collision.bin',...Object.keys(weapons.weapons).map(id=>'/weapons/'+id+'.glb')]){
  const r=await fetch(url+route);assert.equal(r.status,200);assert.equal(r.headers.get('content-encoding'),'gzip');const bytes=(await r.arrayBuffer()).byteLength;assert.ok(bytes>1000);assert.equal(Number(r.headers.get('x-file-size')),bytes);
  assert.equal((await fetch(url+route,{headers:{'If-None-Match':r.headers.get('etag')}})).status,304);
 }
 console.log('PASS Subzero loader dependencies, compressed map/weapon downloads and cache validation');
 const a=await join('Test A'),b=await join('Test B');await until(()=>b.states.at(-1)?.players.length===2,'two player state');assert.equal(b.states.at(-1).host,a.id);
 send(b,{type:'map',mapId:'village'});await until(()=>b.events.some(m=>m.type==='error'&&m.message.includes('host')),'non-host map denied');assert.equal(b.states.at(-1).mapId,'subzero');
 b.autoReady=false;send(a,{type:'map',mapId:'village'});await until(()=>b.states.at(-1)?.mapId==='village','host selects village');
 const epoch=b.states.at(-1).mapEpoch;send(a,{type:'start'});await until(()=>a.events.some(m=>m.type==='error'&&m.message.includes('finish loading')),'unready player blocks start');assert.equal(b.states.at(-1).phase,'lobby');
 send(b,{type:'mapReady',mapId:'village',mapEpoch:epoch-1});await delay(80);assert.equal(b.states.at(-1).readyCount,1);
 send(b,{type:'mapReady',mapId:'village',mapEpoch:epoch});b.autoReady=true;await until(()=>b.states.at(-1).readyCount===2,'both players ready');
 const worldText=await (await fetch(url+'/world.js')).text();assert.ok(worldText.includes('Bellhaven'));
 for(const route of ['/maps/village.glb','/maps/village-collision.bin']){const r=await fetch(url+route);assert.equal(r.status,200);assert.equal(r.headers.get('content-encoding'),'gzip');await r.arrayBuffer();}
 console.log('PASS host-only map selection, stale readiness rejection, loading gate and Bellhaven downloads');
 send(b,{type:'start'});await delay(100);assert.equal(b.states.at(-1).phase,'lobby');console.log('PASS only the host can start rounds');
 send(a,{type:'ping',stamp:123});await until(()=>a.events.some(m=>m.type==='pong'&&m.stamp===123),'ping');console.log('PASS round-trip ping');
 send(a,{type:'start'});await until(()=>b.states.at(-1)?.phase==='playing','round start');send(a,{type:'map',mapId:'subzero'});await delay(80);assert.equal(b.states.at(-1).mapId,'village');
 send(a,{type:'switch',slot:1});await until(()=>a.states.at(-1)?.self.slot===1,'weapon switch');console.log('PASS live round and server weapon switching');
 const lockedGuns=[...a.states.at(-1).self.guns];send(a,{type:'loadout',loadout:['lmg','revolver'],grenades:['frag','medkit'],skin:'ember'});
 await until(()=>a.events.some(m=>m.type==='error'&&m.message.includes('locked')),'loadout lock');assert.deepEqual(a.states.at(-1).self.guns,lockedGuns);console.log('PASS round loadouts reject changes over WebSocket');
 send(a,{type:'input',seq:10,crouch:true});await until(()=>a.states.at(-1).players.find(p=>p.id===a.id).stance==='crouch','crouch replication');send(a,{type:'input',seq:11});console.log('PASS stance replicates over WebSocket');
 send(a,{type:'grenade',slot:0});await until(()=>!a.states.at(-1)?.self.grenades[0],'grenade inventory');console.log('PASS live grenade inventory update');
 await until(()=>b.states.at(-1)?.phase==='ended','round end');
 const finished=JSON.stringify(b.states.at(-1).results);assert.equal(b.states.at(-1).results.length,2);
 send(b,{type:'voteMap',mapId:'subzero'});send(b,{type:'voteMap',mapId:'subzero'});
 await until(()=>b.states.at(-1).mapVotes.subzero===1,'one vote per player');
 send(b,{type:'voteMap',mapId:'village'});await until(()=>b.states.at(-1).mapVotes.village===1&&b.states.at(-1).mapVotes.subzero===0,'vote replacement');
 send(b,{type:'voteMap',mapId:'invalid'});send(b,{type:'input',yaw:1.23});await delay(100);
 assert.equal(b.states.at(-1).myVote,'village');assert.equal(JSON.stringify(b.states.at(-1).results),finished);
 console.log('PASS results remain frozen and map votes validate, replace and count once');
 send(a,{type:'map',mapId:'subzero'});await until(()=>b.states.at(-1)?.mapId==='subzero'&&b.states.at(-1).readyCount===2,'return to original map');send(a,{type:'start'});await until(()=>b.states.at(-1)?.phase==='playing','rematch');assert.equal(a.states.at(-1).self.slot,0);assert.equal(b.states.at(-1).myVote,null);assert.ok(Object.values(b.states.at(-1).mapVotes).every(v=>v===0));console.log('PASS round timer, results and rematch reset');
 a.ws.close();await until(()=>b.states.at(-1)?.host===b.id,'host transfer');assert.equal(b.states.at(-1).players.length,1);console.log('PASS disconnect removes player and transfers host');
 // Fourteen more connections exercise snapshots near room capacity.
 for(let i=0;i<14;i++)await join('Load '+i);
 await until(()=>b.states.at(-1)?.players.length===15,'15 players');console.log('PASS state broadcast with 15 concurrent clients');
 console.log('\n14 network checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{for(const ws of sockets)ws.terminate();server.kill();});
