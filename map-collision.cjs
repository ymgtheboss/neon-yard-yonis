'use strict';
const THREE=require('three');
// Static triangle BVH. Bounds only reject candidates; final tests use triangles,
// preserving doors, arches, sloping ground and gaps in the original geometry.
class MapCollision {
 constructor(data){this.triangles=[];const v=new THREE.Vector3();for(let i=0;i<data.length;i+=9){const t=new THREE.Triangle(new THREE.Vector3(data[i],data[i+1],data[i+2]),new THREE.Vector3(data[i+3],data[i+4],data[i+5]),new THREE.Vector3(data[i+6],data[i+7],data[i+8]));this.triangles.push({t,b:new THREE.Box3().setFromPoints([t.a,t.b,t.c]),normal:t.getNormal(v).clone()});}this.root=this.build(this.triangles.slice());this.box=new THREE.Box3();this.point=new THREE.Vector3();this.ray=new THREE.Ray();}
 build(items){const box=new THREE.Box3();for(const t of items)box.union(t.b);if(items.length<=12)return {box,items};const s=box.getSize(new THREE.Vector3()),axis=s.x>s.y&&s.x>s.z?'x':s.y>s.z?'y':'z';items.sort((a,b)=>(a.b.min[axis]+a.b.max[axis])-(b.b.min[axis]+b.b.max[axis]));const mid=items.length>>1;return {box,left:this.build(items.slice(0,mid)),right:this.build(items.slice(mid))};}
 intersects(box,node=this.root){if(!node.box.intersectsBox(box))return false;if(node.items)return node.items.some(a=>a.b.intersectsBox(box)&&box.intersectsTriangle(a.t));return this.intersects(box,node.left)||this.intersects(box,node.right);}
 blocked(x,y,z,r=.36){this.box.min.set(x-r,y+.018,z-r);this.box.max.set(x+r,y+1.702,z+r);return this.intersects(this.box);}
 projectile(x,y,z,r=.12){this.box.min.set(x-r,y-r,z-r);this.box.max.set(x+r,y+r,z+r);return this.intersects(this.box);}
 distance(o,d,max=150,walkable=false){this.ray.origin.set(o.x,o.y,o.z);this.ray.direction.set(d.x,d.y,d.z);let nearest=max;const point=this.point,ray=this.ray;const visit=node=>{if(!ray.intersectBox(node.box,point)||point.distanceTo(ray.origin)>nearest&&!node.box.containsPoint(ray.origin))return;if(node.items){for(const a of node.items){if(walkable&&a.normal.y<.6)continue;if(ray.intersectTriangle(a.t.a,a.t.b,a.t.c,false,point)){const dist=point.distanceTo(ray.origin);if(dist<nearest)nearest=dist;}}}else{visit(node.left);visit(node.right);}};visit(this.root);return nearest;}
 floor(x,z,top,drop=100){const dist=this.distance({x,y:top,z},{x:0,y:-1,z:0},drop,true);return dist<drop?top-dist:-Infinity;}
 support(x,z,top,drop=.6){let y=-Infinity;for(const [dx,dz]of [[0,0],[-.36,-.36],[.36,-.36],[-.36,.36],[.36,.36]])y=Math.max(y,this.floor(x+dx,z+dz,top,drop));return y;}
 move(p,dt){dt=Math.min(dt,.1);const i=p.input,f=+!!i.forward-+!!i.back,s=+!!i.right-+!!i.left,length=Math.hypot(f,s)||1,speed=i.aim?3.5:i.sprint&&!i.fire?9:6,dx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)/length*speed*dt,dz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)/length*speed*dt;if(i.jump&&p.ground){p.vy=7.8;p.ground=false;}const steps=Math.max(1,Math.ceil(dt/.008)),sub=dt/steps;
 for(let n=0;n<steps;n++){
  for(const axis of ['x','z']){const delta=(axis==='x'?dx:dz)/steps,next=p[axis]+delta,x=axis==='x'?next:p.x,z=axis==='z'?next:p.z;if(!this.blocked(x,p.y,z)){p[axis]=next;continue;}
   if(p.ground){const top=this.support(x,z,p.y+.29,.58);if(top>p.y+.001&&top<=p.y+.285&&!this.blocked(x,top,z)&&!this.blocked(p.x,top,p.z)){p.y=top;p[axis]=next;}}
  }
  const old=p.y,wasGround=p.ground;p.vy-=23*sub;let next=old+p.vy*sub;p.ground=false;
  if(p.vy<=0){const floor=this.support(p.x,p.z,old+.025,Math.max(.06,old-next+.03)+(wasGround?.27:0));if(floor>=next-(wasGround?.27:0)&&floor<=old+.025&&!this.blocked(p.x,floor,p.z)){next=floor;p.vy=0;p.ground=true;}}
  if(this.blocked(p.x,next,p.z)){let safe=old,bad=next;for(let k=0;k<10;k++){const mid=(safe+bad)/2;if(this.blocked(p.x,mid,p.z))bad=mid;else safe=mid;}next=safe;if(p.vy<0)p.ground=true;p.vy=0;}
  p.y=next;
 }
 }
}
module.exports={MapCollision};
