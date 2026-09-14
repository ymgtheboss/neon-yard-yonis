'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{performance}=require('node:perf_hooks'),THREE=require('three'),{MapCollision}=require('../map-collision.cjs'),world=require('../public/maps/subzero-world.json');
const b=fs.readFileSync(require.resolve('../public/maps/subzero-collision.bin')),c=new MapCollision(new Float32Array(b.buffer,b.byteOffset,b.byteLength/4));let count=0;function test(name,fn){fn();count++;console.log('PASS',name);}
function player(s){return {x:s[0],y:s[2],z:s[1],yaw:0,vy:0,ground:true,input:{}};}
test('All Subzero spawns have support, standing clearance and stable gravity',()=>{for(const s of world.SPAWNS){const p=player(s);assert.ok(!c.blocked(p.x,p.y,p.z));assert.ok(Math.abs(c.support(p.x,p.z,p.y+.03,.1)-p.y)<.02);for(let i=0;i<120;i++)c.move(p,1/60);assert.ok(Math.abs(p.y-s[2])<.03);assert.ok(p.ground);}});
// Synthetic geometry verifies semantics independently of the implementation.
const tris=[];function quad(a,b,c,d){tris.push(...a,...b,...c,...a,...c,...d);}
quad([-10,0,-10],[-10,0,10],[10,0,10],[10,0,-10]);
// Wall with a two-metre door in its middle, ceiling, and ascending ramp.
quad([-5,0,-2],[-1,0,-2],[-1,4,-2],[-5,4,-2]);quad([1,0,-2],[5,0,-2],[5,4,-2],[1,4,-2]);quad([-1,2.5,-2],[1,2.5,-2],[1,4,-2],[-1,4,-2]);
quad([-5,2.2,0],[-5,2.2,3],[-2,2.2,3],[-2,2.2,0]);
quad([2,0,5],[4,0,5],[4,1.2,1],[2,1.2,1]);const fixture=new MapCollision(new Float32Array(tris));
test('Triangle collision stops walls and bullets while preserving door openings',()=>{assert.ok(fixture.blocked(2,0,-2));assert.ok(!fixture.blocked(0,0,-2));assert.equal(fixture.distance({x:2,y:1,z:0},{x:0,y:0,z:-1}),2);assert.equal(fixture.distance({x:0,y:1,z:0},{x:0,y:0,z:-1}),150);assert.ok(fixture.projectile(2,1,-2));assert.ok(!fixture.projectile(0,1,-2));});
test('Sprinting cannot cross a thin wall and can pass through the door',()=>{for(const x of [0,2]){const p=player([x,0,0]);p.input={forward:true,sprint:true};for(let i=0;i<30;i++)fixture.move(p,1/30);assert.ok(x===0?p.z<-5:p.z>-1.65,JSON.stringify(p));}});
test('Jumping stops at the ceiling',()=>{const p=player([-3,1,0]);p.input.jump=true;let max=0;for(let i=0;i<80;i++){fixture.move(p,1/60);max=Math.max(max,p.y);assert.ok(!fixture.blocked(p.x,p.y,p.z));}assert.ok(max<=.52);});
test('Player ascends a continuous slope',()=>{const p=player([3,5.5,0]);p.input.forward=true;for(let i=0;i<35;i++)fixture.move(p,1/60);assert.ok(p.y>.7,JSON.stringify(p));assert.ok(!fixture.blocked(p.x,p.y,p.z));});
test('Subzero movement remains finite and outside solid geometry during varied input',()=>{for(const s of world.SPAWNS){const p=player(s);for(let i=0;i<600;i++){p.yaw=Math.sin(i/71)*Math.PI;p.input={forward:true,sprint:true,jump:i%71===0};c.move(p,1/30);assert.ok(Number.isFinite(p.y));assert.ok(!c.blocked(p.x,p.y,p.z),JSON.stringify(p));}}});
const start=performance.now();for(let i=0;i<4800;i++){const s=world.SPAWNS[i%16],p=player(s);p.input.forward=true;c.move(p,1/30);}console.log(`Subzero movement benchmark: ${((performance.now()-start)/4800).toFixed(3)} ms/player tick (local CPU, not browser FPS).`);
console.log(`${count} Subzero checks passed.`);
