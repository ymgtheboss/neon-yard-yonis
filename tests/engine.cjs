'use strict';
const {CHARACTER_SCALE}=require('../character-config.js');
process.env.WORLD_MAP='mill';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const {EventEmitter}=require('node:events');
const root=path.join(__dirname,'..');
const actualRequire=createRequire(path.join(root,'server.cjs'));
const fakeServer={on(){return this},listen(){return this}};
const context={require:name=>name==='http'?{createServer:()=>fakeServer}:name==='ws'?{WebSocketServer:class extends EventEmitter{},WebSocket:{OPEN:1}}:actualRequire(name),console,process:{env:{},exit(){throw Error('unexpected exit')}},__dirname:root,setInterval(){},Date,Math};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'server.cjs'),'utf8')+`\nglobalThis.e={BLOCKS,SPAWNS,WEAPONS,SKINS,players,clients,blocked,groundAt,spawn,move,shoot,reload,throwGrenade,detonate,rayBox,wallDistance,projectileBlocked,startRound,publicPlayer,cleanLoadout,cleanGrenades,getGrenades:()=>grenades,getSmokes:()=>smokes,getPhase:()=>phase};`,context);
const e=context.e;
let tests=0;
function test(name,fn){fn();tests++;console.log('PASS',name)}
function player(id,x=0,y=0,z=0){return {id,name:id,x,y,z,yaw:0,pitch:0,vy:0,ground:true,hp:100,shield:0,input:{},loadout:['rifle','pistol'],grenadeLoadout:['flash','smoke'],guns:['rifle','pistol'],slot:0,ammo:[30,12],reloadAt:0,nextShot:0,kills:0,deaths:0,damage:0,grenades:[true,true],streak:0,flashUntil:0};}
function walk(p,seconds){for(let n=0;n<seconds*60;n++)e.move(p,1/60);}
function reset(){e.players.clear();e.clients.clear();}
function client(id){const messages=[];e.clients.set(id,{readyState:1,send:s=>messages.push(JSON.parse(s))});return messages;}
test('Every spawn has floor support and standing headroom',()=>{for(const [x,z]of e.SPAWNS)assert.equal(e.blocked(x,e.groundAt(x,z),z),false,`${x},${z}`)});
test('Both interior stairwells climb continuously to upper floor',()=>{for(const z of [-19,19]){const p=player('a',17.2,.2,z+6.2);p.input.forward=true;walk(p,1.8);assert.ok(p.y>=3.79,JSON.stringify(p));assert.ok(!e.blocked(p.x,p.y,p.z));}});
test('Both exterior stairways reach the roof landing',()=>{for(const z of [-19,19]){const p=player('a',13.1,0,z-10.3);p.yaw=-Math.PI/2;p.input.forward=true;walk(p,2.88);assert.ok(p.y>=7.39,JSON.stringify(p));p.yaw=Math.PI;walk(p,.55);assert.ok(p.y>=7.39,JSON.stringify(p));}});
test('Balcony doorway is open and edge railing blocks falling straight through',()=>{const p=player('a',26,3.8,25.5);p.yaw=Math.PI;p.input.forward=true;walk(p,.6);assert.ok(p.z>27.5);walk(p,1);assert.ok(p.z<29.5);});
test('Walls stop horizontal movement',()=>{const p=player('a',42,0,0);p.yaw=-Math.PI/2;p.input.forward=true;walk(p,1);assert.ok(p.x<42.5);});
test('Jump hits ceilings without penetrating the upper floor',()=>{const p=player('a',26,.2,23);p.input.jump=true;let max=0;for(let n=0;n<60;n++){e.move(p,1/60);max=Math.max(max,p.y)}assert.ok(max+1.72*CHARACTER_SCALE<=3.601);});
test('Solid walls and roof stop bullet rays',()=>{assert.ok(e.wallDistance({x:0,y:1.5,z:38},{x:0,y:0,z:1})<2);assert.ok(e.wallDistance({x:26,y:4,z:23},{x:0,y:1,z:0})<3.3);});
test('Rays pass through actual window openings',()=>{assert.ok(e.wallDistance({x:31.8,y:2,z:22},{x:-1,y:0,z:0})>1);});
test('Server shooting damages a player in clear sight and consumes ammo',()=>{reset();const a=player('a',3,0,20),b=player('b',3,0,14);a.input.aim=true;e.players.set('a',a);e.players.set('b',b);client('a');client('b');e.shoot(a,10000);assert.ok(b.hp<100);assert.equal(a.ammo[0],29);});
test('Solid cover prevents damage to players behind it',()=>{reset();const a=player('a',10,0,13),b=player('b',10,0,6);a.pitch=-.06;a.input.aim=true;e.players.set('a',a);e.players.set('b',b);client('a');client('b');for(let n=0;n<20;n++)e.shoot(a,10000+n*200);assert.equal(b.hp,100);});
test('Spawn shields prevent damage and firing clears own shield',()=>{reset();const a=player('a',3,0,20),b=player('b',3,0,14);a.shield=b.shield=20000;e.players.set('a',a);e.players.set('b',b);client('a');client('b');e.shoot(a,10000);assert.equal(b.hp,100);assert.equal(a.shield,0);});
test('Fire rate and reload prevent extra shots',()=>{reset();const a=player('a',3,0,20);e.players.set('a',a);client('a');e.shoot(a,10000);e.shoot(a,10001);assert.equal(a.ammo[0],29);e.reload(a,10100);assert.ok(a.reloadAt>10100);e.shoot(a,10300);assert.equal(a.ammo[0],29);});
test('Blocked muzzle returns feedback without silently consuming ammo',()=>{reset();const a=player('a',42.7-.45*CHARACTER_SCALE+.01,0,0);a.yaw=-Math.PI/2;e.players.set('a',a);const messages=client('a');e.shoot(a,10000);assert.equal(a.ammo[0],30);assert.ok(messages.some(m=>m.kind==='obstructed'));});
test('Grenade inventory only allows one throw per slot',()=>{reset();const a=player('a');const before=e.getGrenades().length;e.throwGrenade(a,0,10000);e.throwGrenade(a,0,10000);assert.equal(e.getGrenades().length,before+1);assert.equal(a.grenades[0],false);});
test('Grenades collide with ground and architecture',()=>{assert.ok(e.projectileBlocked(0,-.05,20));assert.ok(e.projectileBlocked(43,1,0));assert.equal(e.projectileBlocked(3,2,20),false);});
test('Flashbang checks line of sight, distance and facing',()=>{reset();const a=player('a',3,0,20),b=player('b',3,0,20),far=player('far',3,0,-20);b.yaw=Math.PI;for(const p of [a,b,far]){e.players.set(p.id,p);client(p.id)}e.detonate({kind:'flash',x:3,y:1.55,z:17},10000);assert.ok(a.flashUntil>b.flashUntil);assert.equal(far.flashUntil,0);const blocked=player('c',30,0,24);e.players.clear();e.players.set('c',blocked);client('c');e.detonate({kind:'flash',x:33,y:1.55,z:24},10000);assert.equal(blocked.flashUntil,0);});
test('Smoke creates a timed ten-second cloud',()=>{e.detonate({id:90,kind:'smoke',x:3,y:0,z:20},10000);const s=e.getSmokes().at(-1);assert.equal(s.until-s.start,10000);});
test('Round restart resets scores, inventories and transient objects',()=>{reset();const a=player('a');a.kills=10;e.players.set('a',a);client('a');e.startRound();assert.equal(e.getPhase(),'playing');assert.equal(a.kills,0);assert.equal(a.hp,100);assert.equal(a.ammo[0],30);assert.equal(e.getGrenades().length,0);assert.equal(e.getSmokes().length,0);});
console.log(`\n${tests} engine checks passed.`);
