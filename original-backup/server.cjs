const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT || 8000);
const ROUND = 210000;
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
  ice: "#e3efff"
};

// x, z, width, depth, height, color

// NEON_YARD_MAP_V3

function makeMap() {
  const B = [];

  function block(x,y,z,w,h,d,mat="concrete",color="#a4a18f") {
    B.push({x,y,z,w,h,d,mat,color});
  }

  function wall(axis,fixed,center,length,base,height,openings=[],mat="brick",color="#a69883") {
    const min=center-length/2, max=center+length/2;
    let cursor=min;

    const piece=(a,b,y,h)=>{
      if(b-a<.01 || h<.01) return;
      if(axis==="x") block((a+b)/2,y,fixed,b-a,h,.3,mat,color);
      else block(fixed,y,(a+b)/2,.3,h,b-a,mat,color);
    };

    for(const o of [...openings].sort((a,b)=>a[0]-b[0])) {
      const a=Math.max(min,o[0]-o[1]/2);
      const b=Math.min(max,o[0]+o[1]/2);
      piece(cursor,a,base,height);
      piece(a,b,base,o[2]);
      piece(a,b,base+o[2]+o[3],height-o[2]-o[3]);
      cursor=b;
    }

    piece(cursor,max,base,height);
  }

  function stairs(x,z,width,count=16,rise=.225,run=.55) {
    for(let n=0;n<count;n++)
      block(x,.2,z-n*run,width,(n+1)*rise,run+.01,"concrete","#989b91");
  }

  function office(cx,cz) {
    const x0=cx-10,x1=cx+10,z0=cz-9,z1=cz+9;

    block(cx,0,cz,20,.2,18,"concrete","#a2a396");

    for(const base of [.2,3.8]) {
      const upper=base>1;

      wall("x",z1,cx,20,base,3.4,
        upper
        ? [[cx-3,2.5,.85,1.65],[cx+5,2.5,.85,1.65]]
        : [[cx+1,2.8,0,2.7],[cx+6,2.4,1,1.5]]);

      wall("x",z0,cx,20,base,3.4,
        upper
        ? [[cx-3,2.6,.85,1.65],[cx+5,2.6,.85,1.65]]
        : [[cx+3,2.6,0,2.7]]);

      wall("z",x0,cz,18,base,3.4,
        upper
        ? [[cz-3,2.5,1,1.5]]
        : [[cz+1,2.6,0,2.7]]);

      wall("z",x1,cz,18,base,3.4,
        [[cz-3,2.4,1,1.5],[cz+4,2.4,1,1.5]]);

      wall("x",cz,cx+2.2,15.6,base,3.4,
        [[cx+1,2.4,0,2.7]],"plaster","#b6b8a6");
    }

    // The upper floor has a real stairwell opening.
    block(cx+2.2,3.6,cz,15.6,.2,18,"wood","#aba08a");

    // Landing connects the last stair to the upper rooms.
    block(cx-7.8,3.6,cz-5.75,4.4,.2,6.5,"wood","#aba08a");

    stairs(cx-7.8,cz+5.5,3.3);

    block(cx-5.7,3.8,cz-.2,.18,.85,11.2,"metal","#64736e");

    // Solid roof and rooftop ventilation equipment.
    block(cx,7.2,cz,20.6,.24,18.6,"metal","#596f74");
    block(cx+6,7.44,cz-4,2,1.1,2,"metal","#8a9694");

    // Desks and work benches.
    block(cx+6,.2,cz+5,2.7,.9,1.2,"wood","#897c67");
    block(cx+6,3.8,cz-5,2.7,.9,1.2,"wood","#897c67");
  }

  function barn(cx,cz,w,d) {
    block(cx,0,cz,w,.2,d,"concrete","#999a8b");

    wall("x",cz+d/2,cx,w,.2,4.8,
      [[cx,5,0,3.6]],"wood","#8c5542");

    wall("x",cz-d/2,cx,w,.2,4.8,
      [[cx,2.8,0,2.8]],"wood","#8c5542");

    wall("z",cx-w/2,cz,d,.2,4.8,
      [[cz,2.2,2,1.5]],"wood","#8c5542");

    wall("z",cx+w/2,cz,d,.2,4.8,
      [[cz,2.8,0,2.8]],"wood","#8c5542");

    // Stepped roof strips provide matching visual and physical roofs.
    for(let n=0;n<22;n++) {
      const x=cx-w/2+(n+.5)*w/22;
      const roofY=5+(1-Math.abs(x-cx)/(w/2))*2.5;

      block(x,roofY,cz,w/22+.02,.18,d+.8,"metal","#526467");
    }

    // Gable ends.
    for(const z of [cz-d/2,cz+d/2]) {
      for(let n=0;n<22;n++) {
        const x=cx-w/2+(n+.5)*w/22;
        const h=(1-Math.abs(x-cx)/(w/2))*2.5;

        block(x,5,z,w/22+.02,h,.3,"wood","#8c5542");
      }
    }

    for(const x of [cx-w/2+.4,cx+w/2-.4])
      for(const z of [cz-d/2+.5,cz+d/2-.5])
        block(x,.2,z,.35,4.8,.35,"wood","#594a39");

    for(const x of [cx-5,cx+5]) {
      block(x,.2,cz-4,2.1,1.4,2,"wood","#958365");
      block(x,.2,cz+4,2.6,.9,1.8,"wood","#958365");
    }
  }

  block(0,-.4,0,100,.4,94,"asphalt","#a1a597");

  block(0,0,-47,102,7,1,"concrete","#697973");
  block(0,0,47,102,7,1,"concrete","#697973");
  block(-50,0,0,1,7,94,"concrete","#697973");
  block(50,0,0,1,7,94,"concrete","#697973");

  barn(-28,-23,22,19);
  barn(-28,22,20,17);

  office(27,-23);
  office(27,23);

  // Staggered crossroads cover.
  for(const [x,z] of [[-10,-8],[10,8],[-10,10],[10,-10]])
    block(x,0,z,4.3,1.1,1.2,"concrete","#a7a38c");

  for(const [x,z] of [[-43,-4],[-21,2],[39,0],[-6,-37],[7,38]])
    block(x,0,z,2.2,1.5,2.2,"wood","#97856a");

  // Wrecked tank: hull, tracks, turret and barrel all block bullets.
  block(-1,.35,3,3.4,1.1,5.5,"metal","#535b43");

  for(const x of [-2.8,.8])
    block(x,.05,3,.65,1.1,5.8,"metal","#353d37");

  block(-1,1.45,2.6,2.3,.75,2.6,"metal","#657051");
  block(-1,1.92,-.25,.2,.2,3.5,"metal","#3e493b");

  return B;
}

const BLOCKS=makeMap();

const SPAWNS=[
  [-44,-39],[-10,-40],[43,-40],[44,0],
  [43,40],[6,40],[-43,39],[-44,0],
  [-28,-23],[-28,22],[29,-19],[29,27]
];

let phase = "lobby";
let roundEnd = 0;
let host = null;
let grenades = [];
let smokes = [];
let serial = 0;

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN)
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
    v && v[i] === "smoke" ? "smoke" : "flash"
  );
}

function overlaps(x, z, radius, b) {
  return x + radius > b.x - b.w / 2 &&
    x - radius < b.x + b.w / 2 &&
    z + radius > b.z - b.d / 2 &&
    z - radius < b.z + b.d / 2;
}

function blocked(x,y,z,radius=.36) {
  return BLOCKS.some(b =>
    y+1.72>b.y+.015 &&
    y<b.y+b.h-.015 &&
    overlaps(x,z,radius,b)
  );
}

function spawn(p, now) {
  const enemies = [...players.values()].filter(q => q !== p && q.hp > 0);
  const ranked = SPAWNS.map(s => ({
    s,
    distance: enemies.length
      ? Math.min(...enemies.map(q => Math.hypot(q.x - s[0], q.z - s[1])))
      : 100
  })).sort((a, b) => b.distance - a.distance);

  // Random choice among the safer spawn points.
  const options = ranked.slice(0, 4);
  const s = options[Math.floor(Math.random() * options.length)].s;

  Object.assign(p, {
    x: s[0], y: groundAt(s[0],s[1]), ground: true, z: s[1], vy: 0,
    hp: 100, aliveAt: 0, shield: now + 1500,
    slot: 0, reloadAt: 0, nextShot: 0,
    grenades: [true, true],
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
  if (!p.reloadAt && p.ammo[p.slot] < w.magazine)
    p.reloadAt = now + w.reload * 1000;
}

function shoot(p, now) {
  const id = p.guns[p.slot];
  const w = WEAPONS[id];

  if (p.reloadAt || now < p.nextShot) return;
  if (p.ammo[p.slot] <= 0) return reload(p, now);

  p.ammo[p.slot]--;
  p.nextShot = now + w.rate * 1000;
  p.shield = 0;

  
  const eye={x:p.x,y:p.y+1.55,z:p.z};
  const forward=direction(p.yaw,p.pitch);
  const right={x:Math.cos(p.yaw),z:-Math.sin(p.yaw)};

  const o={
    x:eye.x+right.x*.18+forward.x*.45,
    y:eye.y-.15+forward.y*.45,
    z:eye.z+right.z*.18+forward.z*.45
  };

  const mx=o.x-eye.x,my=o.y-eye.y,mz=o.z-eye.z;
  const muzzleLength=Math.hypot(mx,my,mz);

  // Do not let the muzzle fire through a wall it is pressed against.
  if(wallDistance(eye,{
    x:mx/muzzleLength,y:my/muzzleLength,z:mz/muzzleLength
  })<muzzleLength) {
    return;
  }
  
  const shots = [];
  const damage = new Map();

  for (let pellet = 0; pellet < w.pellets; pellet++) {
    let spread = w.spread;
    if (p.input.aim) spread *= id === "sniper" ? 0.012 : 0.45;
    if (!p.ground) spread *= 1.7;

    const yaw = p.yaw + (Math.random() - 0.5) * spread;
    const pitch = p.pitch + (Math.random() - 0.5) * spread;
    const d=muzzleRay(p,yaw,pitch,o,now);
    let distance = wallDistance(o, d);
    let victim = null, headshot = false;

    for (const q of players.values()) {
      if (q === p || q.hp <= 0 || q.shield > now) continue;

      const head = raySphere(o, d,
        { x: q.x, y: q.y + 1.52, z: q.z }, 0.26);

      const body = rayBox(o, d,
        { x: q.x - 0.32, y: q.y + 0.05, z: q.z - 0.32 },
        { x: q.x + 0.32, y: q.y + 1.32, z: q.z + 0.32 });

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
      z: o.z + d.z * distance
    });

    if (victim) {
      const falloff = id === "shotgun"
        ? clamp(1 - distance / 50, 0.2, 1)
        : id === "smg" ? clamp(1 - distance / 140, 0.45, 1) : 1;

      const hit = damage.get(victim.id) || { amount: 0, head: false };
      hit.amount += Math.round(w.damage * falloff * (headshot ? 1.8 : 1));
      hit.head ||= headshot;
      damage.set(victim.id, hit);
    }
  }

  event({ kind: "shot", id: p.id, gun: id, origin: o, ends: shots });

  for (const [id, hit] of damage) {
    const q = players.get(id);
    if (!q || q.hp <= 0) continue;
    p.damage += Math.min(q.hp, hit.amount);
    q.hp = Math.max(0, q.hp - hit.amount);

    send(clients.get(p.id), {
      type: "event", kind: "hit",
      head: hit.head, kill: q.hp === 0
    });

    send(clients.get(q.id), {
      type: "event", kind: "hurt", amount: hit.amount
    });

    if (q.hp === 0) {
      q.deaths++;
      q.aliveAt = now + RESPAWN;
      q.reloadAt = 0;
      p.kills++;
      p.streak++;
      event({
        kind: "kill",
        killer: p.name, victim: q.name,
        gun: p.guns[p.slot], head: hit.head,
        streak: p.streak
      });
    }
  }
}

function throwGrenade(p, index, now) {
  if (!p.grenades[index]) return;
  p.grenades[index] = false;
  p.shield = 0;
  const d = direction(p.yaw, clamp(p.pitch + 0.16, -1.2, 1.3));

  grenades.push({
    id: ++serial, owner: p.id,
    kind: p.grenadeLoadout[index],
    x: p.x, y: p.y + 1.45, z: p.z,
    vx: d.x * 16, vy: d.y * 16 + 3, vz: d.z * 16,
    explodeAt: now + 1350
  });
}

function detonate(g, now) {
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
    const o = { x: p.x, y: p.y + 1.55, z: p.z };
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
          if(overlaps(x,z,.36,b) &&
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
      if(!overlaps(p.x,p.z,.34,b)) continue;

      const top=b.y+b.h;

      if(p.vy<=0&&old>=top-.025&&next<=top) {
        next=Math.max(next,top);
        p.vy=0;
        p.ground=true;
      } else if(
        p.vy>0 &&
        old+1.72<=b.y+.025 &&
        next+1.72>=b.y
      ) {
        next=Math.min(next,b.y-1.72);
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
    p.kills = p.deaths = p.damage = 0;
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
    damage: p.damage, streak: p.streak,
    aliveAt: p.aliveAt, shield: p.shield,
    gun: p.guns[p.slot]
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
      `export const WEAPONS=${JSON.stringify(WEAPONS)};\n` +
      `export const SKINS=${JSON.stringify(SKINS)};\n` +
      `export const BLOCKS=${JSON.stringify(BLOCKS)};\n`
    );
  }

  const routes = {
    "/": ["index.html", "text/html"],
    "/index.html": ["index.html", "text/html"],
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

  fs.readFile(path.join(__dirname, route[0]), (error, data) => {
    if (error) {
      res.writeHead(500);
      return res.end("Missing game file. Run npm install three ws.");
    }
    res.writeHead(200, {
      "Content-Type": route[1],
      "Cache-Control": "no-store"
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
      p.input = {
        forward: !!m.forward, back: !!m.back,
        left: !!m.left, right: !!m.right,
        sprint: !!m.sprint, jump: !!m.jump,
        fire: !!m.fire, aim: !!m.aim
      };
      p.yaw = finite(m.yaw, p.yaw) % (Math.PI * 2);
      p.pitch = clamp(finite(m.pitch, p.pitch), -1.45, 1.45);
      p.lastInput = now;
    }

    if (m.type === "start" && id === host && phase !== "playing")
      startRound();

    if (m.type === "loadout") {
      p.loadout = cleanLoadout(m.loadout);
      p.grenadeLoadout = cleanGrenades(m.grenades);
      if (SKINS[m.skin]) p.skin = m.skin;
      if (phase !== "playing") spawn(p, now);
    }

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
    if (host === id) host = players.keys().next().value || null;
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
      if (p.hp <= 0) {
        if (now >= p.aliveAt) spawn(p, now);
        continue;
      }

      if (now - p.lastInput > 500) p.input = {};
      move(p, dt);

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
        grenadeLoadout: p.grenadeLoadout
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

app.listen(PORT, "0.0.0.0", () => {
  console.log("\nNEON YARD — LAN deathmatch");
  console.log(`This computer: http://localhost:${PORT}`);
  console.log("Friends can try one of these local addresses:");

  for (const values of Object.values(os.networkInterfaces()))
    for (const n of values || [])
      if ((n.family === "IPv4" || n.family === 4) && !n.internal)
        console.log(`  http://${n.address}:${PORT}`);

  console.log("\nFirst player to join controls round starts.");
  console.log("Leave this terminal running. Ctrl+C stops the server.\n");
});

function groundAt(x,z) {
  let floor=0;

  for(const b of BLOCKS)
    if(overlaps(x,z,.34,b)&&b.y+b.h<=.3)
      floor=Math.max(floor,b.y+b.h);

  return floor;
}

function projectileBlocked(x,y,z,r=.12) {
  return BLOCKS.some(b =>
    x+r>b.x-b.w/2 && x-r<b.x+b.w/2 &&
    z+r>b.z-b.d/2 && z-r<b.z+b.d/2 &&
    y+r>b.y && y-r<b.y+b.h
  );
}

function muzzleRay(p,yaw,pitch,o,now) {
  const eye={x:p.x,y:p.y+1.55,z:p.z};
  const d=direction(yaw,pitch);
  let length=wallDistance(eye,d);

  for(const q of players.values()) {
    if(q===p||q.hp<=0||q.shield>now) continue;

    length=Math.min(length,
      rayBox(eye,d,
        {x:q.x-.32,y:q.y+.05,z:q.z-.32},
        {x:q.x+.32,y:q.y+1.32,z:q.z+.32}
      ),
      raySphere(eye,d,{x:q.x,y:q.y+1.52,z:q.z},.26)
    );
  }

  const x=eye.x+d.x*length-o.x;
  const y=eye.y+d.y*length-o.y;
  const z=eye.z+d.z*length-o.z;
  const norm=Math.hypot(x,y,z)||1;

  return {x:x/norm,y:y/norm,z:z/norm};
}
