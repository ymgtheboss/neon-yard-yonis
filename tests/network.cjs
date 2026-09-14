'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const WS=require('ws');
const port=18281,url=`http://127.0.0.1:${port}`,sockets=[];
const server=spawn(process.execPath,[path.join(__dirname,'..','server.cjs')],{env:{...process.env,PORT:String(port),ROUND_MS:'1300'},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<100;i++){const v=fn();if(v)return v;await delay(30)}throw Error('Timed out: '+label+'\n'+logs);}
async function join(name){const ws=new WS(url),c={ws,events:[],states:[],id:null};sockets.push(ws);ws.on('message',raw=>{const m=JSON.parse(raw);c.events.push(m);if(m.type==='state')c.states.push(m);if(m.type==='welcome')c.id=m.id});await new Promise((r,j)=>{ws.on('open',r);ws.on('error',j)});ws.send(JSON.stringify({type:'join',name,loadout:['rifle','pistol'],grenades:['flash','smoke']}));await until(()=>c.id,'join');return c;}
const send=(c,m)=>c.ws.send(JSON.stringify(m));
(async()=>{
 await until(()=>logs.includes('This computer:'),'server startup');
 for(const route of ['/','/world.js','/three.module.js','/three.core.js','/district.css']){const r=await fetch(url+route);assert.equal(r.status,200);assert.ok((await r.text()).length>20)}
 console.log('PASS all five locally served asset routes');
 assert.equal((await fetch(url+'/server.cjs')).status,404);console.log('PASS server source is not publicly served');
 const a=await join('Test A'),b=await join('Test B');await until(()=>b.states.at(-1)?.players.length===2,'two player state');assert.equal(b.states.at(-1).host,a.id);
 send(b,{type:'start'});await delay(100);assert.equal(b.states.at(-1).phase,'lobby');console.log('PASS only the host can start rounds');
 send(a,{type:'ping',stamp:123});await until(()=>a.events.some(m=>m.type==='pong'&&m.stamp===123),'ping');console.log('PASS round-trip ping');
 send(a,{type:'start'});await until(()=>b.states.at(-1)?.phase==='playing','round start');
 send(a,{type:'switch',slot:1});await until(()=>a.states.at(-1)?.self.slot===1,'weapon switch');console.log('PASS live round and server weapon switching');
 send(a,{type:'grenade',slot:0});await until(()=>!a.states.at(-1)?.self.grenades[0],'grenade inventory');console.log('PASS live grenade inventory update');
 await until(()=>b.states.at(-1)?.phase==='ended','round end');send(a,{type:'start'});await until(()=>b.states.at(-1)?.phase==='playing','rematch');assert.equal(a.states.at(-1).self.slot,0);console.log('PASS round timer, results and rematch reset');
 a.ws.close();await until(()=>b.states.at(-1)?.host===b.id,'host transfer');assert.equal(b.states.at(-1).players.length,1);console.log('PASS disconnect removes player and transfers host');
 // Fourteen more connections exercise snapshots near room capacity.
 for(let i=0;i<14;i++)await join('Load '+i);
 await until(()=>b.states.at(-1)?.players.length===15,'15 players');console.log('PASS state broadcast with 15 concurrent clients');
 console.log('\n9 network checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{for(const ws of sockets)ws.terminate();server.kill();});
