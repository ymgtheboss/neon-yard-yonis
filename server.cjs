const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT || 8000);
const ROUND = Math.max(1000, Number(process.env.ROUND_MS) || 210000);
const RESPAWN = 5000;
const players = new Map();
const clients = new Map();

const WEAPONS = {
  pistol: {
    name: "VOLT / Pistol",
    damage: 30, rate: 0.25, magazine: 12,
    reload: 1.15, spread: 0.012, pellets: 1,
    auto: false, color: "#ffcc66"
  },
  rifle: {
    name: "HAVOC / Rifle",
    damage: 24, rate: 0.105, magazine: 30,
    reload: 1.8, spread: 0.022, pellets: 1,
    auto: true, color: "#60e6de"
  },
  shotgun: {
    name: "BREACH / Shotgun",
    damage: 14, rate: 0.85, magazine: 6,
    reload: 2.1, spread: 0.085, pellets: 8,
    auto: false, color: "#ff9866"
  },
  sniper: {
    name: "GHOST / Sniper",
    damage: 80, rate: 1.2, magazine: 5,
    reload: 2.4, spread: 0.075, pellets: 1,
    auto: false, color: "#c0a0ff"
  },
  revolver: {name:"BASILISK / Revolver",damage:55,rate:.48,magazine:6,reload:2.2,spread:.009,pellets:1,auto:false,color:"#efbd78"},
  lmg: {name:"ATLAS / LMG",damage:25,rate:.12,magazine:70,reload:3.6,spread:.032,pellets:1,auto:true,color:"#b9cb74"},
  dmr: {name:"KESTREL / DMR",damage:46,rate:.34,magazine:15,reload:2.05,spread:.016,pellets:1,auto:false,color:"#aabcf0"},
  carbine: {name:"WRAITH / Carbine",damage:21,rate:.088,magazine:28,reload:1.65,spread:.02,pellets:1,auto:true,color:"#e791b4"},
  autoshot: {name:"MAUL / Auto shotgun",damage:10,rate:.34,magazine:12,reload:2.8,spread:.105,pellets:7,auto:true,color:"#f18468"},
  smg: {
    name: "RUSH / SMG",
    damage: 17, rate: 0.068, magazine: 36,
    reload: 1.5, spread: 0.038, pellets: 1,
    auto: true, color: "#9cf08c"
  }
};

const SKINS = {
  cyan: "#58e5e0",
  sunset: "#ff9866",
  violet: "#b99cff",
  lime: "#b7ea75",
  rose: "#ff81ac",
  ice: "#e3efff",
  obsidian:"#657088", desert:"#d1a977", woodland:"#819964", ember:"#da6744", arctic:"#bddcec", royal:"#9d80d8"
};

const { BLOCKS, DECOR, PROPS, AREAS, SPAWNS, MAP } = require('./world-data.cjs');

const {CHARACTER_SCALE}=require('./character-config.js');
const {MapCollision,bodyShape}=require('./map-collision.cjs');
const mapCollision=MAP?(()=>{const b=fs.readFileSync(path.join(__dirname,'public/maps/subzero-collision.bin'));return new MapCollision(new Float32Array(b.buffer,b.byteOffset,b.byteLength/4));})():null;

let phase = "lobby";
let roundEnd = 0;
let host = null;
let grenades = [];
let smokes = [];
let serial = 0;

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify(data));
}

function broadcast(data) {
  for (const ws of clients.values()) send(ws, data);
}

function event(data) {
  broadcast({ type: "event", ...data });
}

function finite(n, fallback = 0) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function direction(yaw, pitch = 0) {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch)
  };
}

function cleanLoadout(v) {
  const ids = Array.isArray(v) ? v.filter(x => WEAPONS[x]) : [];
  const result = [...new Set(ids)].slice(0, 2);
  for (const id of ["rifle", "pistol"])
    if (result.length < 2 && !result.includes(id)) result.push(id);
  return result;
}

function cleanGrenades(v) {
  return [0, 1].map(i =>
    v && ["smoke","flash","frag","medkit"].includes(v[i]) ? v[i] : "flash"
  );
}

function overlaps(x, z, radius, b) {
  return x + radius > b.x - b.w / 2 &&
    x - radius < b.x + b.w / 2 &&
    z + radius > b.z - b.d / 2 &&
    z - radius < b.z + b.d / 2;
}

function blocked(x,y,z,radius=.36*CHARACTER_SCALE) {
  if(mapCollision)return mapCollision.blocked(x,y,z,radius);
  return BLOCKS.some(b =>
    y+1.72*CHARACTER_SCALE>b.y+.015 &&
    y<b.y+b.h-.015 &&
    overlaps(x,z,radius,b)
  );
}

function spawn(p, now) {
  const enemies = [...players.values()].filter(q => q !== p && q.hp > 0);
  const ranked = SPAWNS.filter(s=>!blocked(s[0],groundAt(s[0],s[1]),s[1])).map(s => ({
    s,
    distance: spawnSafety(s, enemies)
  })).sort((a, b) => b.distance - a.distance);

  // Random choice among the safer spawn points.
  const safe = ranked.filter(r=>r.distance >= ranked[0].distance*.8);
  const options = safe.slice(0, 3);
  const s = options[Math.floor(Math.random() * options.length)].s;

  Object.assign(p, {
    x: s[0], y: groundAt(s[0],s[1]), ground: true, z: s[1], vy: 0,
    vx:0,vz:0,stance:'stand',motionTime:0,slideUntil:0,slideReadyAt:0,jumpHeld:false,crouchHeld:false,jumpUntil:-1,lastGroundAt:-100,
    hp: 100, aliveAt: 0, shield: now + 1500,
    slot: 0, reloadAt: 0, nextShot: 0,
    grenades: (p.gearReadyAt||[0,0]).map(t=>now>=t),
    gearReadyAt:p.gearReadyAt||[0,0],
    guns: [...p.loadout],
    ammo: p.loadout.map(id => WEAPONS[id].magazine),
    input: {}, lastInput: now, wasFire: false,
    streak: 0, flashUntil: 0
  });
}

function rayBox(o, d, lo, hi) {
  let near = 0, far = 150;
  for (const axis of ["x", "y", "z"]) {
    if (Math.abs(d[axis]) < 0.000001) {
      if (o[axis] < lo[axis] || o[axis] > hi[axis]) return Infinity;
    } else {
      let a = (lo[axis] - o[axis]) / d[axis];
      let b = (hi[axis] - o[axis]) / d[axis];
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a);
      far = Math.min(far, b);
      if (near > far) return Infinity;
    }
  }
  return near;
}

function wallDistance(o,d) {
  if(mapCollision)return mapCollision.distance(o,d);
  let result=150;

  for(const b of BLOCKS)
    result=Math.min(result,rayBox(o,d,
      {x:b.x-b.w/2,y:b.y,z:b.z-b.d/2},
      {x:b.x+b.w/2,y:b.y+b.h,z:b.z+b.d/2}
    ));

  return result;
}

function raySphere(o, d, c, radius) {
  const x = o.x - c.x, y = o.y - c.y, z = o.z - c.z;
  const dot = x * d.x + y * d.y + z * d.z;
  const disc = dot * dot - (x*x + y*y + z*z - radius*radius);
  if (disc < 0) return Infinity;
  const a = -dot - Math.sqrt(disc);
  const b = -dot + Math.sqrt(disc);
  return a >= 0 ? a : b >= 0 ? b : Infinity;
}

function reload(p, now) {
  const w = WEAPONS[p.guns[p.slot]];
  if (!p.reloadAt && p.ammo[p.slot] < w.magazine) {
    p.reloadAt = now + w.reload * 1000;
    event({kind:'reload',id:p.id,gun:p.guns[p.slot],x:p.x,y:playerEye(p).y,z:p.z,duration:w.reload});
  }
}

function shoot(p, now) {
  const id = p.guns[p.slot];
  const w = WEAPONS[id];

  if (p.reloadAt || now < p.nextShot) return;
  if (p.ammo[p.slot] <= 0) return reload(p, now);

  p.nextShot = now + w.rate * 1000;

  
  const eye=playerEye(p);
  const forward=direction(p.yaw,p.pitch);
  const right={x:Math.cos(p.yaw),z:-Math.sin(p.yaw)};

  const o={
    x:eye.x+(right.x*.18+forward.x*.45)*CHARACTER_SCALE,
    y:eye.y+(-.15+forward.y*.45)*CHARACTER_SCALE,
    z:eye.z+(right.z*.18+forward.z*.45)*CHARACTER_SCALE
  };

  const mx=o.x-eye.x,my=o.y-eye.y,mz=o.z-eye.z;
  const muzzleLength=Math.hypot(mx,my,mz);

  // Do not let the muzzle fire through a wall it is pressed against.
  if(wallDistance(eye,{
    x:mx/muzzleLength,y:my/muzzleLength,z:mz/muzzleLength
  })<muzzleLength) {
    send(clients.get(p.id),{type:"event",kind:"obstructed"});
    return;
  }
  
  p.ammo[p.slot]--;p.shots=(p.shots||0)+1;
  p.shield = 0;
  const shots = [];
  const damage = new Map();

  for (let pellet = 0; pellet < w.pellets; pellet++) {
    let spread = w.spread;
    if (p.input.aim) spread *= id === "sniper" ? 0.012 : 0.45;
    if (!p.ground) spread *= 1.7;
    if(p.stance==='crouch')spread*=.8;
    if(p.stance==='prone')spread*=.55;
    if(p.stance==='slide')spread*=1.5;

    const yaw = p.yaw + (Math.random() - 0.5) * spread;
    const pitch = p.pitch + (Math.random() - 0.5) * spread;
    const d=muzzleRay(p,yaw,pitch,o,now);
    let distance = wallDistance(o, d);
    let victim = null, headshot = false;

    for (const q of players.values()) {
      if (q === p || q.hp <= 0 || q.shield > now) continue;

      const {head,body}=playerHit(q,o,d);

      const hit = Math.min(head, body);
      if (hit < distance) {
        distance = hit;
        victim = q;
        headshot = head < body;
      }
    }

    shots.push({
      x: o.x + d.x * distance,
      y: o.y + d.y * distance,
      z: o.z + d.z * distance, surface:victim?"player":surfaceAt(o,d,distance)
    });

    if (victim) {
      const falloff = (id === "shotgun" || id === "autoshot")
        ? clamp(1 - distance / 50, 0.2, 1)
        : id === "smg" ? clamp(1 - distance / 140, 0.45, 1) : 1;

      const hit = damage.get(victim.id) || { amount: 0, head: false };
      hit.amount += Math.round(w.damage * falloff * (headshot ? 1.8 : 1));
      hit.head ||= headshot;
      damage.set(victim.id, hit);
    }
  }

  if(damage.size)p.hits=(p.hits||0)+1;
  event({ kind: "shot", id: p.id, gun: id, origin: o, ends: shots });

  for (const [id, hit] of damage) {
    const q = players.get(id);
    if (!q || q.hp <= 0) continue;
    applyDamage(p,q,hit.amount,now,p.guns[p.slot],hit.head);
  }
}

function playerEye(p){const h=bodyShape(p).eye;return {x:p.x,y:p.y+h,z:p.z};}
function playerHead(p){const h=bodyShape(p).height;return {x:p.x-(p.stance==='prone'?Math.sin(p.yaw)*.48*CHARACTER_SCALE:0),y:p.y+h-.2*CHARACTER_SCALE,z:p.z-(p.stance==='prone'?Math.cos(p.yaw)*.48*CHARACTER_SCALE:0)};}
function playerBounds(p){const h=bodyShape(p);return {lo:{x:p.x-h.rx,y:p.y+.04*CHARACTER_SCALE,z:p.z-h.rz},hi:{x:p.x+h.rx,y:p.y+(p.stance==='prone'?h.height:h.height-.4*CHARACTER_SCALE),z:p.z+h.rz}};}
function playerHit(p,o,d){
 const head=raySphere(o,d,playerHead(p),Math.min(.24*CHARACTER_SCALE,bodyShape(p).height*.28));
 if(p.stance==='prone'){
  const c=Math.cos(p.yaw),s=Math.sin(p.yaw),x=o.x-p.x,z=o.z-p.z;
  const origin={x:c*x-s*z,y:o.y-p.y,z:s*x+c*z};
  const direction={x:c*d.x-s*d.z,y:d.y,z:s*d.x+c*d.z};
  return {head,body:rayBox(origin,direction,{x:-.3*CHARACTER_SCALE,y:.04*CHARACTER_SCALE,z:-.35*CHARACTER_SCALE},{x:.3*CHARACTER_SCALE,y:.3*CHARACTER_SCALE,z:.78*CHARACTER_SCALE})};
 }
 const bounds=playerBounds(p);return {head,body:rayBox(o,d,bounds.lo,bounds.hi)};
}
function applyDamage(attacker,victim,amount,now,gun,head=false){
 if(victim.hp<=0||victim.shield>now)return;
 const dealt=Math.min(victim.hp,Math.max(0,Math.round(amount)));
 if(attacker&&attacker!==victim)attacker.damage+=dealt;
 victim.hp-=dealt;
 if(attacker&&attacker!==victim)send(clients.get(attacker.id),{type:'event',kind:'hit',head,kill:victim.hp===0});
 send(clients.get(victim.id),{type:'event',kind:'hurt',amount:dealt});
 if(victim.hp===0){
  victim.deaths++;victim.aliveAt=now+RESPAWN;victim.reloadAt=0;
  if(attacker&&attacker!==victim){attacker.kills++;attacker.streak++;attacker.bestStreak=Math.max(attacker.bestStreak||0,attacker.streak);}
  event({kind:'kill',killer:attacker?.name||'Explosion',victim:victim.name,gun,head,streak:attacker?.streak||0,killerId:attacker?.id,victimId:victim.id});
 }
}
function refreshEquipment(p,now){
 p.gearReadyAt=p.gearReadyAt||[0,0];
 for(let i=0;i<2;i++)if(!p.grenades[i]&&now>=p.gearReadyAt[i])p.grenades[i]=true;
}
function changeLoadout(p,m,now){
 if(phase==='playing'){send(clients.get(p.id),{type:'error',message:'Loadout locked until this round ends.'});return false;}
 p.loadout=cleanLoadout(m.loadout);p.grenadeLoadout=cleanGrenades(m.grenades);
 if(SKINS[m.skin])p.skin=m.skin;spawn(p,now);return true;
}

function throwGrenade(p, index, now) {
  refreshEquipment(p,now);
  if (!p.grenades[index]||p.hp<=0) return;
  if(p.grenadeLoadout[index]==='medkit'&&p.hp>=100){send(clients.get(p.id),{type:'event',kind:'notice',message:'Health is already full.'});return;}
  p.grenades[index] = false;p.gearReadyAt[index]=now+15000;
  if(p.grenadeLoadout[index]==='medkit'){
   const amount=Math.min(45,100-p.hp);p.hp+=amount;
   event({kind:'heal',id:p.id,x:p.x,y:p.y+.7,z:p.z,amount});return;
  }
  p.shield = 0;
  const d = direction(p.yaw, clamp(p.pitch + 0.16, -1.2, 1.3));

  event({kind:"throw",id:p.id,x:p.x,y:playerEye(p).y,z:p.z});
  grenades.push({
    id: ++serial, owner: p.id,
    kind: p.grenadeLoadout[index],
    x: p.x, y: p.y + bodyShape(p).eye-.08*CHARACTER_SCALE, z: p.z,
    vx: d.x * 16, vy: d.y * 16 + 3, vz: d.z * 16,
    explodeAt: now + 1350
  });
}

function detonate(g, now) {
  if(g.kind==='frag'){
    event({kind:'explosion',x:g.x,y:g.y,z:g.z});
    const owner=players.get(g.owner);
    for(const p of players.values()){
      if(p.hp<=0||p.shield>now)continue;
      const center={x:p.x,y:p.y+bodyShape(p).height*.5,z:p.z};
      const dx=center.x-g.x,dy=center.y-g.y,dz=center.z-g.z,dist=Math.hypot(dx,dy,dz);
      if(dist>=8)continue;
      if(dist>.01&&wallDistance(g,{x:dx/dist,y:dy/dist,z:dz/dist})<dist-.04)continue;
      applyDamage(owner,p,110*Math.pow(1-dist/8,1.25),now,'frag');
    }
    return;
  }
  if (g.kind === "smoke") {
    smokes.push({
      id: g.id, x: g.x, y: g.y, z: g.z,
      start: now, until: now + 10000, radius: 5.5
    });
    event({ kind: "smoke", x: g.x, y: g.y, z: g.z });
    return;
  }

  event({ kind: "flashbang", x: g.x, y: g.y, z: g.z });

  for (const p of players.values()) {
    if (p.hp <= 0) continue;
    const o = playerEye(p);
    const dx = g.x - o.x, dy = g.y - o.y, dz = g.z - o.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > 24) continue;
    const d = distance > 0.01
      ? { x: dx / distance, y: dy / distance, z: dz / distance }
      : { x: 0, y: 1, z: 0 };

    if (wallDistance(o, d) + 0.15 < distance) continue;
    const f = direction(p.yaw, p.pitch);
    const facing = f.x*d.x + f.y*d.y + f.z*d.z;
    const strength = (1 - distance / 24) * (facing > 0.25 ? 1 : 0.3);
    const duration = 350 + strength * 2700;
    p.flashUntil = Math.max(p.flashUntil, now + duration);
    send(clients.get(p.id), {
      type: "event", kind: "flash", duration, strength
    });
  }
}

function move(p,dt) {
  if(mapCollision){
    mapCollision.move(p,dt);
    const b=MAP.bounds;
    if(p.y<MAP.killY||p.x<b.minX||p.x>b.maxX||p.z<b.minZ||p.z>b.maxZ){
      const s=SPAWNS.reduce((a,s)=>Math.hypot(s[0]-p.x,s[1]-p.z)<Math.hypot(a[0]-p.x,a[1]-p.z)?s:a);
      Object.assign(p,{x:s[0],z:s[1],y:s[2],vx:0,vz:0,vy:0,ground:true,stance:"stand"});
    }
    return;
  }
  const i=p.input;
  const f=Number(!!i.forward)-Number(!!i.back);
  const s=Number(!!i.right)-Number(!!i.left);
  const length=Math.hypot(f,s)||1;
  const speed=i.aim?3.5:i.sprint&&!i.fire?9:6;

  const dx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)/length*speed*dt;
  const dz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)/length*speed*dt;

  if(i.jump&&p.ground) {
    p.vy=7.8;
    p.ground=false;
  }

  const steps=Math.max(1,Math.ceil(dt/.016));
  const sub=dt/steps;

  for(let n=0;n<steps;n++) {
    for(const axis of ["x","z"]) {
      const next=p[axis]+(axis==="x"?dx:dz)/steps;
      const x=axis==="x"?next:p.x;
      const z=axis==="z"?next:p.z;

      if(!blocked(x,p.y,z)) {
        p[axis]=next;
        continue;
      }

      // Step onto shallow ledges and stairs, with a headroom check.
      if(p.ground) {
        let top=p.y;

        for(const b of BLOCKS)
          if(overlaps(x,z,.36*CHARACTER_SCALE,b) &&
             b.y+b.h>p.y &&
             b.y+b.h<=p.y+.27)
            top=Math.max(top,b.y+b.h);

        if(top>p.y&&!blocked(x,top,z)) {
          p.y=top;
          p[axis]=next;
        }
      }
    }

    const old=p.y;
    p.vy-=23*sub;

    let next=p.y+p.vy*sub;
    p.ground=false;

    for(const b of BLOCKS) {
      if(!overlaps(p.x,p.z,.34*CHARACTER_SCALE,b)) continue;

      const top=b.y+b.h;

      if(p.vy<=0&&old>=top-.025&&next<=top) {
        next=Math.max(next,top);
        p.vy=0;
        p.ground=true;
      } else if(
        p.vy>0 &&
        old+1.72*CHARACTER_SCALE<=b.y+.025 &&
        next+1.72*CHARACTER_SCALE>=b.y
      ) {
        next=Math.min(next,b.y-1.72*CHARACTER_SCALE);
        p.vy=0;
      }
    }

    p.y=Math.max(0,next);

    if(p.y===0) {
      p.vy=0;
      p.ground=true;
    }
  }
}

function startRound() {
  const now = Date.now();
  phase = "playing";
  roundEnd = now + ROUND;
  grenades = [];
  smokes = [];

  for (const p of players.values()) {
    p.gearReadyAt=[0,0];p.shots=0;p.hits=0;p.bestStreak=0;p.kills = p.deaths = p.damage = 0;
    spawn(p, now);
  }

  event({ kind: "round", message: "ROUND STARTED" });
}

function publicPlayer(p) {
  return {
    id: p.id, name: p.name, skin: p.skin,
    x: p.x, y: p.y, z: p.z,
    yaw: p.yaw, pitch: p.pitch,
    hp: p.hp, kills: p.kills, deaths: p.deaths,
    damage: p.damage, streak: p.streak,bestStreak:p.bestStreak||0,accuracy:p.shots?Math.round((p.hits||0)/p.shots*100):0,
    aliveAt: p.aliveAt, shield: p.shield,
    stance:p.stance||'stand',vx:p.vx||0,vz:p.vz||0,
    gun: p.guns[p.slot], ground:p.ground, vy:p.vy, aim:!!p.input.aim, sprint:!!p.input.sprint, reloadAt:p.reloadAt
  };
}

const app = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;

  if (pathname === "/world.js") {
    res.writeHead(200, {
      "Content-Type": "text/javascript",
      "Cache-Control": "no-store"
    });
    return res.end(
      `export const MAP=${JSON.stringify(MAP)};\n` +
      `export const WEAPONS=${JSON.stringify(WEAPONS)};\n` +
      `export const SKINS=${JSON.stringify(SKINS)};\n` +
      `export const DECOR=${JSON.stringify(DECOR)};export const PROPS=${JSON.stringify(PROPS)};export const AREAS=${JSON.stringify(AREAS)};\n` +
      `export const BLOCKS=${JSON.stringify(BLOCKS)};\n`
    );
  }

  if(pathname==='/character-config.js'){
    const code=fs.readFileSync(path.join(__dirname,'character-config.js'),'utf8').replace('module.exports = { CHARACTER_SCALE };','export { CHARACTER_SCALE };');
    res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end(code);
  }
  if(pathname==='/map-collision.js'){
    const code=fs.readFileSync(path.join(__dirname,'map-collision.cjs'),'utf8')
      .replace("const THREE=require('three');","import * as THREE from '/three.module.js';")
      .replace("const {CHARACTER_SCALE}=require('./character-config.js');","import {CHARACTER_SCALE} from '/character-config.js';")
      .replace('module.exports={MapCollision,bodyShape};','export {MapCollision,bodyShape};');
    res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(code);
  }
  const routes = {
    '/maps/subzero.glb':['public/maps/subzero.glb','model/gltf-binary'],
    '/maps/subzero-collision.bin':['public/maps/subzero-collision.bin','application/octet-stream'],
    '/addons/loaders/GLTFLoader.js':['node_modules/three/examples/jsm/loaders/GLTFLoader.js','text/javascript'],
    '/addons/utils/BufferGeometryUtils.js':['node_modules/three/examples/jsm/utils/BufferGeometryUtils.js','text/javascript'],
    '/addons/utils/SkeletonUtils.js':['node_modules/three/examples/jsm/utils/SkeletonUtils.js','text/javascript'],
    "/": ["index.html", "text/html"],
    "/index.html": ["index.html", "text/html"],
    '/combat-visuals.js':['combat-visuals.mjs','text/javascript'],
    '/combat.css':['combat.css','text/css'],
    "/district.css": ["district.css", "text/css"],
    "/three.module.js": [
      "node_modules/three/build/three.module.js", "text/javascript"
    ],
    "/three.core.js": [
      "node_modules/three/build/three.core.js", "text/javascript"
    ]
  };

  const route = routes[pathname];
  if (!route) {
    res.writeHead(404);
    return res.end("Not found");
  }

  const mapAsset=pathname.startsWith('/maps/');
  const compressed=mapAsset && /\bgzip\b/.test(req.headers['accept-encoding']||'');
  fs.readFile(path.join(__dirname, route[0]+(compressed?'.gz':'')), (error, data) => {
    if (error) {
      res.writeHead(500);
      return res.end("Missing game file. Run npm install three ws.");
    }
    const etag='"'+crypto.createHash('sha256').update(data).digest('hex').slice(0,24)+'"';
    if(mapAsset && req.headers['if-none-match']===etag){res.writeHead(304,{'ETag':etag,'Vary':'Accept-Encoding','Cache-Control':'public, max-age=0, must-revalidate'});return res.end();}
    res.writeHead(200, {
      ...(mapAsset?{'ETag':etag,'Vary':'Accept-Encoding','X-File-Size':fs.statSync(path.join(__dirname,route[0])).size}:{}),
      ...(compressed?{'Content-Encoding':'gzip'}:{}),
      'Content-Length':data.length,
      "Content-Type": route[1],
      "Cache-Control": pathname.startsWith("/maps/") ? "public, max-age=0, must-revalidate" : "no-store"
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server: app, maxPayload: 8192 });

wss.on("connection", ws => {
  let id = null;
  let count = 0;
  let windowStart = Date.now();
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", raw => {
    const now = Date.now();
    if (now - windowStart > 1000) {
      windowStart = now;
      count = 0;
    }
    if (++count > 100) return ws.close(1008, "Too many messages");

    let m;
    try { m = JSON.parse(raw.toString()); }
    catch { return; }
    if (!m || typeof m !== "object") return;

    if (m.type === "ping") { send(ws, {type:"pong", stamp:finite(m.stamp)}); return; }

    if (m.type === "join" && !id) {
      if (players.size >= 16) {
        send(ws, { type: "error", message: "The arena is full (16 players)." });
        return;
      }

      id = crypto.randomBytes(8).toString("hex");
      const p = {
        id,
        name: String(m.name || "Player")
          .replace(/[\x00-\x1f<>]/g, "").trim().slice(0, 18) || "Player",
        skin: SKINS[m.skin] ? m.skin : "cyan",
        loadout: cleanLoadout(m.loadout),
        grenadeLoadout: cleanGrenades(m.grenades),
        yaw: 0, pitch: 0,
        kills: 0, deaths: 0, damage: 0
      };

      spawn(p, now);
      players.set(id, p);
      clients.set(id, ws);
      if (!host) host = id;

      send(ws, { type: "welcome", id });
      event({ kind: "notice", message: `${p.name} joined the arena` });
      return;
    }

    const p = players.get(id);
    if (!p) return;

    if (m.type === "input") {
      p.inputSeq=clamp(Math.floor(finite(m.seq)),0,1e9);
      p.input = {
        forward: !!m.forward, back: !!m.back,
        left: !!m.left, right: !!m.right,
        sprint: !!m.sprint, jump: !!m.jump,
        crouch:!!m.crouch,prone:!!m.prone,slide:!!m.slide,
        fire: !!m.fire, aim: !!m.aim
      };
      p.yaw = finite(m.yaw, p.yaw) % (Math.PI * 2);
      p.pitch = clamp(finite(m.pitch, p.pitch), -1.45, 1.45);
      p.lastInput = now;
    }

    if (m.type === "start" && id === host && phase !== "playing")
      startRound();

    if (m.type === "loadout") changeLoadout(p,m,now);

    if (phase !== "playing" || p.hp <= 0) return;

    if (m.type === "switch" && (m.slot === 0 || m.slot === 1)) {
      if (p.slot !== m.slot) {
        p.slot = m.slot;
        p.reloadAt = 0;
        p.nextShot = Math.max(p.nextShot, now + 220);
      }
    }

    if (m.type === "reload") reload(p, now);

    if (m.type === "grenade" && (m.slot === 0 || m.slot === 1))
      throwGrenade(p, m.slot, now);
  });

  ws.on("close", () => {
    if (!id) return;
    const p = players.get(id);
    players.delete(id);
    clients.delete(id);
    if (host === id) { host = players.keys().next().value || null; if(host)event({kind:"notice",message:`${players.get(host).name} is now the host`}); }
    if (p) event({ kind: "notice", message: `${p.name} left the arena` });

    if (!players.size) {
      phase = "lobby";
      grenades = [];
      smokes = [];
    }
  });

  ws.on("error", () => {});
});

let previousTick = Date.now();

setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - previousTick) / 1000, 0.1);
  previousTick = now;

  if (phase === "playing" && now >= roundEnd) {
    phase = "ended";
    grenades = [];
    event({ kind: "round", message: "ROUND COMPLETE" });
  }

  if (phase === "playing") {
    for (const p of players.values()) {
      refreshEquipment(p,now);
      if (p.hp <= 0) {
        if (now >= p.aliveAt) spawn(p, now);
        continue;
      }

      if (now - p.lastInput > 500) p.input = {};
      const wasGround=p.ground, ox=p.x,oz=p.z,oldVy=p.vy;
      move(p, dt);
      if(wasGround&&!p.ground&&p.vy>0)event({kind:'jump',id:p.id,x:p.x,y:p.y,z:p.z});
      if(!wasGround&&p.ground&&oldVy < -2)event({kind:'land',id:p.id,x:p.x,y:p.y,z:p.z});
      if(p.ground&&Math.hypot(p.x-ox,p.z-oz)>.015&&now>(p.nextStep||0)) {
        p.nextStep=now+(p.input.sprint?280:420);
        event({kind:'step',id:p.id,x:p.x,y:p.y,z:p.z,surface:floorSurface(p)});
      }

      if (p.reloadAt && now >= p.reloadAt) {
        p.ammo[p.slot] = WEAPONS[p.guns[p.slot]].magazine;
        p.reloadAt = 0;
      }

      const w = WEAPONS[p.guns[p.slot]];
      if (p.input.fire && (w.auto || !p.wasFire))
        shoot(p, now);
      p.wasFire = !!p.input.fire;
    }

    
for(const g of grenades) {
  const substeps=Math.max(1,Math.ceil(dt/.012));
  const step=dt/substeps;

  for(let n=0;n<substeps;n++) {
    g.vy-=15*step;

    for(const [axis,velocity] of [["x","vx"],["y","vy"],["z","vz"]]) {
      const next=g[axis]+g[velocity]*step;

      const x=axis==="x"?next:g.x;
      const y=axis==="y"?next:g.y;
      const z=axis==="z"?next:g.z;

      if(projectileBlocked(x,y,z)) {
        if(Math.abs(g[velocity])>2&&now>(g.bounceAt||0)){g.bounceAt=now+100;event({kind:'bounce',x:g.x,y:g.y,z:g.z});}
        g[velocity]*=-.38;

        if(axis==="y") {
          g.vx*=.78;
          g.vz*=.78;
          if(Math.abs(g.vy)<.5)g.vy=0;
        }
      } else {
        g[axis]=next;
      }
    }
  }

  if(now>=g.explodeAt)detonate(g,now);
}


    grenades = grenades.filter(g => now < g.explodeAt);
  }

  smokes = smokes.filter(s => now < s.until);
  const list = [...players.values()].map(publicPlayer);

  for (const [id, ws] of clients) {
    if (ws.bufferedAmount > 500000) continue;
    const p = players.get(id);
    send(ws, {
      type: "state",
      now, phase, end: roundEnd, host,
      players: list, grenades, smokes,
      self: {
        slot: p.slot, guns: p.guns,
        ammo: p.ammo, reloadAt: p.reloadAt,
        grenades: p.grenades,
        grenadeLoadout: p.grenadeLoadout,gearReadyAt:p.gearReadyAt,inputSeq:p.inputSeq||0,
        motion:{motionTime:p.motionTime,slideUntil:p.slideUntil,slideReadyAt:p.slideReadyAt,jumpUntil:p.jumpUntil,jumpHeld:p.jumpHeld,crouchHeld:p.crouchHeld,lastGroundAt:p.lastGroundAt}
      }
    });
  }
}, 1000 / 30);

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 10000);

app.on("error",error=>{console.error(error.code==="EADDRINUSE"?`Port ${PORT} is busy. Stop the old server with Control+C, then try again.`:error.message);process.exit(1);});

app.listen(PORT, "0.0.0.0", () => {
  console.log("\nNEON YARD — "+(MAP?.name||"Mill District"));
  console.log(`This computer: http://localhost:${PORT}`);
  console.log("Friends can try one of these local addresses:");

  let interfaces={};
  try { interfaces=os.networkInterfaces(); } catch { console.log("  Use your computer’s local IP address with port "+PORT); }
  for (const values of Object.values(interfaces))
    for (const n of values || [])
      if ((n.family === "IPv4" || n.family === 4) && !n.internal)
        console.log(`  http://${n.address}:${PORT}`);

  console.log("\nFirst player to join controls round starts.");
  console.log("Leave this terminal running. Ctrl+C stops the server.\n");
});

function groundAt(x,z) {
  if(mapCollision){const s=SPAWNS.find(s=>s[0]===x&&s[1]===z);return s?s[2]:mapCollision.support(x,z,3.5,10);}
  let floor=0;

  for(const b of BLOCKS)
    if(overlaps(x,z,.34*CHARACTER_SCALE,b)&&b.y+b.h<=.3)
      floor=Math.max(floor,b.y+b.h);

  return floor;
}

function projectileBlocked(x,y,z,r=.12) {
  if(mapCollision)return mapCollision.projectile(x,y,z,r);
  return BLOCKS.some(b =>
    x+r>b.x-b.w/2 && x-r<b.x+b.w/2 &&
    z+r>b.z-b.d/2 && z-r<b.z+b.d/2 &&
    y+r>b.y && y-r<b.y+b.h
  );
}

function muzzleRay(p,yaw,pitch,o,now) {
  const eye=playerEye(p);
  const d=direction(yaw,pitch);
  let length=wallDistance(eye,d);

  for(const q of players.values()) {
    if(q===p||q.hp<=0||q.shield>now) continue;

    const hit=playerHit(q,eye,d);length=Math.min(length,hit.body,hit.head);
  }

  const x=eye.x+d.x*length-o.x;
  const y=eye.y+d.y*length-o.y;
  const z=eye.z+d.z*length-o.z;
  const norm=Math.hypot(x,y,z)||1;

  return {x:x/norm,y:y/norm,z:z/norm};
}

function spawnSafety(s,enemies) {
 if(!enemies.length)return 100;
 const o={x:s[0],y:groundAt(s[0],s[1])+1.55*CHARACTER_SCALE,z:s[1]};
 return Math.min(...enemies.map(q=>{
   const x=q.x-o.x,y=playerEye(q).y-o.y,z=q.z-o.z,d=Math.hypot(x,y,z)||.01;
   return d+(wallDistance(o,{x:x/d,y:y/d,z:z/d})<d?25:0);
 }));
}

function surfaceAt(o,d,dist) {
 if(mapCollision)return dist<150?'concrete':'air';
 for(const b of BLOCKS) {
 const hit=rayBox(o,d,{x:b.x-b.w/2,y:b.y,z:b.z-b.d/2},{x:b.x+b.w/2,y:b.y+b.h,z:b.z+b.d/2});
 if(Math.abs(hit-dist)<.015)return b.mat;
 }return 'air';
}

function floorSurface(p){
 if(mapCollision)return 'concrete';
 const surfaces=BLOCKS.filter(b=>overlaps(p.x,p.z,.2,b)&&Math.abs(b.y+b.h-p.y)<.08);
 if(p.y<.1){if(p.x<-10)return 'grass';if(Math.abs(p.x-3)<4.5||Math.abs(p.z)<3.5)return 'tile';return 'dirt';}
 return surfaces.at(-1)?.mat||'concrete';
}
