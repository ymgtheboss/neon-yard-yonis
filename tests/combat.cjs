'use strict';
const {CHARACTER_SCALE}=require('../character-config.js');
process.env.WORLD_MAP='mill';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events');
const root=path.join(__dirname,'..'),req=createRequire(path.join(root,'server.cjs'));
const fakeServer={on(){return this},listen(){return this}};
const ctx={require:n=>n==='http'?{createServer:()=>fakeServer}:n==='ws'?{WebSocketServer:class extends EventEmitter{},WebSocket:{OPEN:1}}:req(n),console,process:{env:{},exit(){throw Error('Unexpected exit')}},__dirname:root,setInterval(){},Date,Math};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'server.cjs'),'utf8')+'\nglobalThis.e={WEAPONS,SKINS,players,clients,spawn,shoot,applyDamage,startRound,cleanGrenades,throwGrenade,refreshEquipment,detonate,changeLoadout,playerHit,playerEye,publicPlayer,getGrenades:()=>grenades};',ctx);const e=ctx.e;
function p(id,x=3,z=20){return {id,name:id,skin:'cyan',x,y:0,z,yaw:0,pitch:0,vy:0,ground:true,hp:100,shield:0,input:{aim:true},loadout:['rifle','pistol'],grenadeLoadout:['frag','medkit'],guns:['rifle','pistol'],slot:0,ammo:[30,12],reloadAt:0,nextShot:0,kills:0,deaths:0,damage:0,grenades:[true,true],streak:0,flashUntil:0};}
function reset(){e.players.clear();e.clients.clear();}
function add(p){const messages=[];e.players.set(p.id,p);e.clients.set(p.id,{readyState:1,send:s=>messages.push(JSON.parse(s))});return messages;}
let count=0;function test(name,fn){fn();count++;console.log('PASS',name);}
test('Ten distinct weapons and twelve cosmetic skin choices are validated',()=>{assert.equal(Object.keys(e.WEAPONS).length,10);assert.equal(Object.keys(e.SKINS).length,12);assert.deepEqual(Array.from(e.cleanGrenades(['frag','medkit'])),['frag','medkit']);assert.deepEqual(Array.from(e.cleanGrenades(['invalid','smoke'])),['flash','smoke']);});
test('Every weapon fires through the authoritative shooting path and consumes one round',()=>{for(const id of Object.keys(e.WEAPONS)){reset();const a=p('a'),b=p('b',3,14),m=add(a);add(b);a.guns=[id,'pistol'];a.ammo=[e.WEAPONS[id].magazine,12];e.shoot(a,10000);assert.equal(a.ammo[0],e.WEAPONS[id].magazine-1,id);assert.ok(m.some(m=>m.kind==='shot'&&m.gun===id));assert.ok(b.hp<100,id);}});
test('Medkits heal at most 45, never overheal, and full-health use does not consume a slot',()=>{reset();const a=p('a');add(a);e.throwGrenade(a,1,10000);assert.ok(a.grenades[1]);a.hp=80;e.throwGrenade(a,1,10001);assert.equal(a.hp,100);assert.equal(a.gearReadyAt[1],25001);assert.ok(!a.grenades[1]);a.hp=10;e.throwGrenade(a,1,10002);assert.equal(a.hp,10);e.throwGrenade(a,1,25001);assert.equal(a.hp,55);});
test('Equipment refills at 15 seconds, preserves weapon ammo and keeps cooldown through death',()=>{const a=p('a');e.throwGrenade(a,0,10000);a.ammo[0]=7;e.refreshEquipment(a,24999);assert.ok(!a.grenades[0]);e.spawn(a,20000);assert.ok(!a.grenades[0]);a.ammo[0]=7;e.refreshEquipment(a,25000);assert.ok(a.grenades[0]);assert.equal(a.ammo[0],7);});
test('Frag damage falls off with distance and solid cover blocks blast damage',()=>{reset();const a=p('a'),near=p('near',3,18),far=p('far',3,12),covered=p('covered',30,24);add(a);add(near);add(far);add(covered);e.detonate({kind:'frag',owner:'a',x:3,y:.8,z:20},10000);assert.ok(near.hp<far.hp);assert.ok(a.hp<100);e.detonate({kind:'frag',owner:'a',x:33,y:1,z:24},10000);assert.equal(covered.hp,100);});
test('Frag kills credit the owner, respect spawn shields and do not award self-kills',()=>{reset();const a=p('a',3,25),b=p('b',3,20),c=p('c',3,20);c.shield=20000;add(a);add(b);add(c);e.detonate({kind:'frag',owner:'a',x:3,y:.86*CHARACTER_SCALE,z:20},10000);assert.equal(b.hp,0);assert.equal(c.hp,100);assert.equal(a.kills,1);a.hp=1;e.detonate({kind:'frag',owner:'a',x:3,y:.86*CHARACTER_SCALE,z:25},10000);assert.equal(a.hp,0);assert.equal(a.kills,1);});
test('Stance-aware hitboxes allow bullets above a crouched or prone operator to pass',()=>{const a=p('a',0,0),o={x:0,y:1.5*CHARACTER_SCALE,z:-5},d={x:0,y:0,z:1};assert.ok(e.playerHit(a,o,d).head<150);a.stance='crouch';assert.equal(e.playerHit(a,o,d).body,Infinity);assert.equal(e.playerHit(a,o,d).head,Infinity);a.stance='prone';assert.ok(e.playerEye(a).y<.4);const head=e.playerHit(a,{x:0,y:.4*CHARACTER_SCALE,z:-5},d);assert.ok(head.head<150);});
test('Round start refills equipment and locks loadout changes, including pending-respawn changes',()=>{reset();const a=p('a');add(a);a.gearReadyAt=[Date.now()+15000,Date.now()+15000];e.startRound();assert.ok(a.grenades.every(Boolean));const original=[...a.loadout];assert.equal(e.changeLoadout(a,{loadout:['sniper','lmg'],grenades:['smoke','flash'],skin:'ember'},Date.now()),false);e.spawn(a,Date.now()+6000);assert.deepEqual([...a.guns],original);assert.equal(a.skin,'cyan');assert.deepEqual([...a.grenadeLoadout],['frag','medkit']);});
const {MapCollision,bodyShape}=require('../map-collision.cjs');const tris=[];function quad(a,b,c,d){tris.push(...a,...b,...c,...a,...c,...d)}quad([-20,0,-20],[-20,0,20],[20,0,20],[20,0,-20]);quad([-2,1.28*CHARACTER_SCALE,-5],[-2,1.28*CHARACTER_SCALE,0],[2,1.28*CHARACTER_SCALE,0],[2,1.28*CHARACTER_SCALE,-5]);const collision=new MapCollision(new Float32Array(tris));
function step(a,n){for(let i=0;i<n;i++)collision.move(a,1/60);}
test('Crouch can enter low cover and releasing crouch cannot stand into the ceiling',()=>{const a=p('a',0,1);a.input={forward:true,crouch:true};step(a,45);assert.equal(a.stance,'crouch');assert.ok(a.z<0);a.input={};step(a,20);assert.equal(a.stance,'crouch');assert.ok(!collision.blocked(a.x,a.y,a.z,.36,bodyShape(a).height));});
test('Prone uses a lower, wider collision volume and moves more slowly',()=>{const a=p('a',6,5);a.input={prone:true,forward:true};step(a,60);assert.equal(a.stance,'prone');assert.ok(a.z>3&&a.z<5);assert.equal(bodyShape(a).height,.52*CHARACTER_SCALE);a.input={};step(a,2);assert.equal(a.stance,'stand');});
test('Sprint-to-slide boosts momentum then expires, with no immediate repeated boost',()=>{const a=p('a',6,10);a.input={forward:true,sprint:true};step(a,40);a.input.slide=true;step(a,1);assert.equal(a.stance,'slide');assert.ok(Math.hypot(a.vx,a.vz)>10);step(a,55);assert.equal(a.stance,'stand');a.input.slide=false;step(a,1);a.input.slide=true;step(a,1);assert.notEqual(a.stance,'slide');});
test('Jump is buffered, follows a smooth arc and does not repeatedly trigger while held',()=>{const a=p('a',6,5);a.input={jump:true};let takeoffs=0,max=0,last=true;for(let i=0;i<180;i++){collision.move(a,1/60);if(last&&!a.ground)takeoffs++;last=a.ground;max=Math.max(max,a.y);}assert.equal(takeoffs,1);assert.ok(max>1&&max<1.6);assert.ok(a.ground);});
test('Airborne release preserves momentum and grounded release stops responsively',()=>{const a=p('a',6,10);a.input={forward:true,sprint:true};step(a,30);a.input.jump=true;step(a,1);const speed=Math.hypot(a.vx,a.vz);a.input={};step(a,12);assert.ok(!a.ground);assert.ok(Math.hypot(a.vx,a.vz)>speed*.9);step(a,100);assert.ok(a.ground);assert.ok(Math.hypot(a.vx,a.vz)<.01);});
test('Direction reversal responds quickly without exceeding sprint speed',()=>{const a=p('a',6,10);a.input={forward:true};step(a,30);a.input={back:true};step(a,8);assert.ok(a.vz>0);assert.ok(Math.hypot(a.vx,a.vz)<=6.01);});


test('Confirmed hit feedback reports capped damage, source direction and headshot kills once',()=>{
 reset();const a=p('a'),b=p('b',3,14),am=add(a),bm=add(b);b.hp=30;
 e.applyDamage(a,b,90,10000,'sniper',true);
 assert.equal(a.headshots,1);assert.equal(a.damage,30);assert.equal(a.kills,1);
 const hit=am.find(m=>m.kind==='hit');assert.equal(hit.amount,30);assert.equal(hit.head,true);assert.equal(hit.kill,true);assert.equal(hit.victim,'b');assert.equal(hit.victimId,'b');
 assert.deepEqual(bm.find(m=>m.kind==='hurt').source,{x:a.x,z:a.z});
 e.applyDamage(a,b,90,10001,'sniper',true);assert.equal(a.headshots,1);
 e.startRound();assert.equal(a.headshots,0);assert.equal(e.publicPlayer(a).headshots,0);
});

test('Slide steering turns gradually without creating extra speed',()=>{
 const a=p('a',6,10);a.input={forward:true,sprint:true};step(a,40);a.input.slide=true;step(a,1);
 const speed=Math.hypot(a.vx,a.vz);a.input={right:true,slide:true};step(a,12);
 assert.equal(a.stance,'slide');assert.ok(a.vx>0&&a.vz<0);assert.ok(Math.hypot(a.vx,a.vz)<speed);
});
test('Movement converges across 30, 60 and 120 Hz updates',()=>{
 const results=[30,60,120].map(hz=>{const a=p('a',6,10);a.input={forward:true,sprint:true};for(let i=0;i<hz/2;i++)collision.move(a,1/hz);return a;});
 for(const a of results){assert.ok(Math.abs(a.z-results[0].z)<.045);assert.ok(Math.abs(a.vz-results[0].vz)<.01);}
});
test('Smaller bodies retain the same jump apex while reducing collision dimensions',()=>{
 const normal=p('a',6,10),small=p('b',6,10);small.characterScale=CHARACTER_SCALE/1.3;
 assert.ok(Math.abs(bodyShape(small).height*1.3-bodyShape(normal).height)<1e-9);
 assert.ok(Math.abs(bodyShape(small).rx*1.3-bodyShape(normal).rx)<1e-9);
 normal.input=small.input={jump:true};let high=0,low=0;for(let i=0;i<90;i++){collision.move(normal,1/60);collision.move(small,1/60);high=Math.max(high,normal.y);low=Math.max(low,small.y);}
 assert.ok(Math.abs(high-low)<1e-9);assert.ok(high>1);
});
test('Capture teammates cannot damage each other, but enemies and self explosions still can',()=>{
 reset();const a=p('a'),b=p('b');a.team=b.team='blue';add(a);add(b);e.applyDamage(a,b,40,10000,'rifle');assert.equal(b.hp,100);b.team='red';e.applyDamage(a,b,40,10000,'rifle');assert.equal(b.hp,60);e.applyDamage(a,a,20,10000,'frag');assert.equal(a.hp,80);
});
test('Air steering turns smoothly, preserves speed and cannot stack speed through circling',()=>{
 const a=p('a',6,10);a.y=1000;a.ground=false;a.vz=-9;a.vx=0;a.input={forward:true,right:true,sprint:true};step(a,12);
 assert.ok(a.vx>2);assert.ok(a.vz<0);assert.ok(Math.hypot(a.vx,a.vz)>8.8);assert.ok(Math.hypot(a.vx,a.vz)<=9.001);
 for(let i=0;i<240;i++){a.yaw+=.08;collision.move(a,1/60);assert.ok(Math.hypot(a.vx,a.vz)<=9.001);}
});
test('Slide jumping carries momentum once and retains the ordinary jump apex',()=>{
 const a=p('a',6,10);a.input={forward:true,sprint:true};step(a,30);a.input.slide=true;step(a,1);const entry=Math.hypot(a.vx,a.vz);a.input.jump=true;step(a,1);
 assert.equal(a.stance,'stand');assert.equal(a.slideUntil,0);assert.ok(!a.ground);assert.ok(Math.hypot(a.vx,a.vz)>entry*.9);assert.ok(Math.hypot(a.vx,a.vz)<entry);
 let apex=a.y;for(let i=0;i<70;i++){collision.move(a,1/60);apex=Math.max(apex,a.y);}const normal=p('n',10,10);normal.input={jump:true};let ordinary=0;for(let i=0;i<71;i++){collision.move(normal,1/60);ordinary=Math.max(ordinary,normal.y);}assert.ok(Math.abs(apex-ordinary)<.005);
});
console.log(`${count} combat upgrade checks passed.`);
