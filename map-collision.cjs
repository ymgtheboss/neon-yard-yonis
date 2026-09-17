'use strict';
const THREE=require('three');
const {CHARACTER_SCALE}=require('./character-config.js');
// Static triangle BVH. Bounds only reject candidates; final tests use triangles,
// preserving doors, arches, sloping ground and gaps in the original geometry.
function bodyShape(p) {
 const stance=p.stance||'stand',scale=p.characterScale||CHARACTER_SCALE;
 const height=({stand:1.72,crouch:1.12,prone:.52,slide:.9}[stance]||1.72)*scale;
 return {scale,height,eye:height-.17*scale,rx:(stance==='prone'?.78:.36)*scale,rz:(stance==='prone'?.78:.36)*scale};
}
class MapCollision {
 constructor(data){this.triangles=[];const v=new THREE.Vector3();for(let i=0;i<data.length;i+=9){const t=new THREE.Triangle(new THREE.Vector3(data[i],data[i+1],data[i+2]),new THREE.Vector3(data[i+3],data[i+4],data[i+5]),new THREE.Vector3(data[i+6],data[i+7],data[i+8]));this.triangles.push({index:i/9,t,b:new THREE.Box3().setFromPoints([t.a,t.b,t.c]),normal:t.getNormal(v).clone()});}this.root=this.build(this.triangles.slice());this.box=new THREE.Box3();this.point=new THREE.Vector3();this.ray=new THREE.Ray();}
 build(items){const box=new THREE.Box3();for(const t of items)box.union(t.b);if(items.length<=12)return {box,items};const s=box.getSize(new THREE.Vector3()),axis=s.x>s.y&&s.x>s.z?'x':s.y>s.z?'y':'z';items.sort((a,b)=>(a.b.min[axis]+a.b.max[axis])-(b.b.min[axis]+b.b.max[axis]));const mid=items.length>>1;return {box,left:this.build(items.slice(0,mid)),right:this.build(items.slice(mid))};}
 intersects(box,node=this.root){if(!node.box.intersectsBox(box))return false;if(node.items)return node.items.some(a=>a.b.intersectsBox(box)&&box.intersectsTriangle(a.t));return this.intersects(box,node.left)||this.intersects(box,node.right);}
 blocked(x,y,z,r=.36*CHARACTER_SCALE,height=1.72*CHARACTER_SCALE,rz=r){this.box.min.set(x-r,y+.018,z-rz);this.box.max.set(x+r,y+height-.018,z+rz);return this.intersects(this.box);}
 projectile(x,y,z,r=.12){this.box.min.set(x-r,y-r,z-r);this.box.max.set(x+r,y+r,z+r);return this.intersects(this.box);}
 distance(o,d,max=150,walkable=false){this.ray.origin.set(o.x,o.y,o.z);this.ray.direction.set(d.x,d.y,d.z);let nearest=max;this.lastTriangle=null;const point=this.point,ray=this.ray;const visit=node=>{if(!ray.intersectBox(node.box,point)||point.distanceTo(ray.origin)>nearest&&!node.box.containsPoint(ray.origin))return;if(node.items){for(const a of node.items){if(walkable&&a.normal.y<.6)continue;if(ray.intersectTriangle(a.t.a,a.t.b,a.t.c,false,point)){const dist=point.distanceTo(ray.origin);if(dist<nearest){nearest=dist;this.lastTriangle=a;}}}}else{visit(node.left);visit(node.right);}};visit(this.root);return nearest;}
 floor(x,z,top,drop=100){const dist=this.distance({x,y:top,z},{x:0,y:-1,z:0},drop,true);return dist<drop?top-dist:-Infinity;}
 support(x,z,top,drop=.6,rx=.36*CHARACTER_SCALE,rz=.36*CHARACTER_SCALE){let y=-Infinity;for(const [dx,dz]of [[0,0],[-rx,-rz],[rx,-rz],[-rx,rz],[rx,rz]])y=Math.max(y,this.floor(x+dx,z+dz,top,drop));return y;}
 move(p,dt) {
  dt=Math.min(Math.max(dt,0),.1);
  const i=p.input||{};
  p.motionTime=(p.motionTime||0)+dt;
  p.stance=p.stance||'stand';p.vx=p.vx||0;p.vz=p.vz||0;
  if(p.ground)p.lastGroundAt=p.motionTime;
  if(i.jump&&!p.jumpHeld)p.jumpUntil=p.motionTime+.14;
  p.jumpHeld=!!i.jump;
  const crouchEdge=(i.crouch||i.slide)&&!p.crouchHeld;
  p.crouchHeld=!!(i.crouch||i.slide);
  let requested=i.prone?'prone':i.crouch?'crouch':'stand';
  if(crouchEdge&&p.ground&&i.sprint&&Math.hypot(p.vx,p.vz)>5.5&&p.motionTime>=(p.slideReadyAt||0)&&!i.prone){
   p.slideUntil=p.motionTime+.8;p.slideReadyAt=p.motionTime+1.65;
   const v=Math.hypot(p.vx,p.vz);p.vx=p.vx/v*11;p.vz=p.vz/v*11;
  }
  if(p.motionTime<(p.slideUntil||0))requested='slide';
  const desired=bodyShape({...p,stance:requested});
  // Always check the complete new volume, including the longer prone body.
  if(!this.blocked(p.x,p.y,p.z,desired.rx,desired.height,desired.rz))p.stance=requested;
  if((p.jumpUntil||0)>=p.motionTime&&(p.ground||p.motionTime-(p.lastGroundAt??-100)<.1)&&p.stance!=='prone'){
   const fromSlide=p.stance==='slide';
   p.vy=7.1;p.ground=false;p.jumpUntil=-1;p.lastGroundAt=-100;p.slideUntil=0;
   if(fromSlide){
    // Carry most of the slide's momentum once; never add another speed boost.
    p.vx*=.92;p.vz*=.92;
    const exitStance=i.crouch?'crouch':'stand',exit=bodyShape({...p,stance:exitStance});
    if(!this.blocked(p.x,p.y,p.z,exit.rx,exit.height,exit.rz))p.stance=exitStance;
   }
  }
  const shape=bodyShape(p),blocked=(x,y,z)=>this.blocked(x,y,z,shape.rx,shape.height,shape.rz);
  const support=(x,z,top,drop)=>this.support(x,z,top,drop,shape.rx,shape.rz);
  const f=Number(!!i.forward)-Number(!!i.back),s=Number(!!i.right)-Number(!!i.left),length=Math.hypot(f,s)||1;
  const speed=p.stance==='prone'?1.6:p.stance==='crouch'?3:p.stance==='slide'?(p.motionTime<(p.slideUntil||0)?10:3):i.aim?3.5:i.sprint&&f>0&&!i.fire?9:6;
  const tx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)/length*speed;
  const tz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)/length*speed;
  const steps=Math.max(1,Math.ceil(dt/.008)),sub=dt/steps;
  for(let n=0;n<steps;n++){
   if(p.stance==='slide'&&p.motionTime<(p.slideUntil||0)){
    // Turn gently without generating speed; airborne slides retain momentum.
    const velocity=Math.hypot(p.vx,p.vz);
    if((f||s)&&velocity>.1){const turn=1-Math.exp(-2.2*sub),dx=p.vx+(tx/speed*velocity-p.vx)*turn,dz=p.vz+(tz/speed*velocity-p.vz)*turn,len=Math.hypot(dx,dz);if(len>.001){p.vx=dx/len*velocity;p.vz=dz/len*velocity;}}
    const friction=Math.exp(-(p.ground?1.25:.12)*sub);p.vx*=friction;p.vz*=friction;
   } else {
    if(p.ground){
     const reversing=p.vx*tx+p.vz*tz<0;
     const blend=1-Math.exp(-(f||s?(reversing?30:20):28)*sub);
     p.vx+=(tx-p.vx)*blend;p.vz+=(tz-p.vz)*blend;
    }else if(f||s){
     // Turn the velocity vector instead of blending opposing vectors to a stop.
     // Steering has an angular limit and cannot multiply carried slide speed.
     const velocity=Math.hypot(p.vx,p.vz),heading=Math.atan2(p.vz,p.vx),wish=Math.atan2(tz,tx);
     const angle=Math.atan2(Math.sin(wish-heading),Math.cos(wish-heading));
     const turn=Math.max(-2.8*sub,Math.min(2.8*sub,angle));
     const nextSpeed=velocity<speed?Math.min(speed,velocity+4*sub):velocity*Math.exp(-.08*sub);
     const direction=velocity<.05?wish:heading+turn;
     p.vx=Math.cos(direction)*nextSpeed;p.vz=Math.sin(direction)*nextSpeed;
    }else{p.vx*=Math.exp(-.12*sub);p.vz*=Math.exp(-.12*sub);}
   }
   for(const axis of ['x','z']){
    const velocity=axis==='x'?'vx':'vz',next=p[axis]+p[velocity]*sub;
    const x=axis==='x'?next:p.x,z=axis==='z'?next:p.z;
    if(!blocked(x,p.y,z)){p[axis]=next;continue;}
    if(p.ground&&p.stance!=='prone'){
     const top=support(x,z,p.y+.29,.58);
     if(top>p.y+.001&&top<=p.y+.285&&!blocked(x,top,z)&&!blocked(p.x,top,p.z)){p.y=top;p[axis]=next;continue;}
    }
    p[velocity]=0;
   }
   const old=p.y,wasGround=p.ground;
   p.vy-=(p.vy>0?19.5:24)*sub;
   let next=old+p.vy*sub;p.ground=false;
   if(p.vy<=0){
    const floor=support(p.x,p.z,old+.025,Math.max(.06,old-next+.03)+(wasGround?.27:0));
    if(floor>=next-(wasGround?.27:0)&&floor<=old+.025&&!blocked(p.x,floor,p.z)){next=floor;p.vy=0;p.ground=true;}
   }
   if(blocked(p.x,next,p.z)){
    let safe=old,bad=next;
    for(let k=0;k<10;k++){const mid=(safe+bad)/2;if(blocked(p.x,mid,p.z))bad=mid;else safe=mid;}
    next=safe;if(p.vy<0)p.ground=true;p.vy=0;
   }
   p.y=next;
  }
 }
}
module.exports={MapCollision,bodyShape};
