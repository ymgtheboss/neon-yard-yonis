'use strict';
// Ground-level navigation audit: connected player-sized cells, not enclosed room area.
const fs=require('node:fs'),path=require('node:path'),{MapCollision,bodyShape}=require('../map-collision.cjs');
function audit(world,file){const raw=fs.readFileSync(file),c=new MapCollision(new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4)),b=world.MAP.bounds,step=1,w=Math.floor(b.maxX-b.minX),h=Math.floor(b.maxZ-b.minZ),ys=new Float32Array(w*h).fill(NaN),visited=new Uint8Array(w*h),shape=bodyShape({});
 const position=n=>({x:b.minX+(n%w)+.5,z:b.minZ+Math.floor(n/w)+.5,y:ys[n]});
 for(let n=0;n<ys.length;n++){const p=position(n),y=c.support(p.x,p.z,2.7,11);if(Number.isFinite(y)&&!c.blocked(p.x,y,p.z))ys[n]=y;}
 const index=(x,z)=>Math.floor(z-b.minZ)*w+Math.floor(x-b.minX);
 const spawnIndices=world.SPAWNS.map(s=>index(s[0],s[1]));const queue=[spawnIndices[0]];visited[queue[0]]=1;
 for(let head=0;head<queue.length;head++){const i=queue[head],p=position(i);for(const n of [i%w?i-1:-1,i%w<w-1?i+1:-1,i-w,i+w]){if(n<0||n>=ys.length||visited[n]||!Number.isFinite(ys[n]))continue;const q=position(n);if(Math.abs(q.y-p.y)>.62)continue;const dx=q.x-p.x,dz=q.z-p.z;if(Math.abs(dx)+Math.abs(dz)!==1)continue;
  if(c.distance({x:p.x,y:p.y+shape.eye*.6,z:p.z},{x:dx,y:0,z:dz},1)<.999)continue;
  let clear=true;for(const f of [.25,.5,.75]){const x=p.x+dx*f,z=p.z+dz*f,y=c.support(x,z,Math.max(p.y,q.y)+.3,1);if(!Number.isFinite(y)||c.blocked(x,y,z)){clear=false;break;}}
  if(clear){visited[n]=1;queue.push(n);}
 }}
 return {cells:queue.length,spawnsConnected:spawnIndices.map(n=>!!visited[n]),width:w,height:h,visited:Array.from(visited),bounds:b};
}
if(require.main===module){for(const id of ['subzero','village']){const world=require('../public/maps/'+id+'-world.json'),result=audit(world,path.join(__dirname,'../public',world.MAP.collisionUrl));fs.mkdirSync(path.join(__dirname,'../tests/artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../tests/artifacts/'+id+'-navigation.json'),JSON.stringify(result));console.log(id,result.cells,result.spawnsConnected);}}
module.exports={audit};
