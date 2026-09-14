'use strict';
// One source of truth for visible architecture, collision, and spawn locations.
const BLOCKS=[], DECOR=[], PROPS=[], AREAS=[];
function block(x,y,z,w,h,d,mat='plaster',color='#c3ad8c',extra={}) {
  const b={x,y,z,w,h,d,mat,color,...extra}; BLOCKS.push(b); return b;
}
function decor(x,y,z,w,h,d,mat='wood',color='#574333',extra={}) {
  DECOR.push({x,y,z,w,h,d,mat,color,...extra});
}
function wall(axis,fixed,center,length,base,height,openings=[],mat='plaster',color='#c3ad8c') {
  const min=center-length/2,max=center+length/2;
  let cursor=min;
  const piece=(a,b,y,h)=>{if(b-a>.001&&h>.001)axis==='x'?block((a+b)/2,y,fixed,b-a,h,.32,mat,color):block(fixed,y,(a+b)/2,.32,h,b-a,mat,color);};
  for(const o of openings.sort((a,b)=>a[0]-b[0])) {
    const a=Math.max(min,o[0]-o[1]/2),b=Math.min(max,o[0]+o[1]/2);
    piece(cursor,a,base,height);piece(a,b,base,o[2]);piece(a,b,base+o[2]+o[3],height-o[2]-o[3]);cursor=b;
    if(o[2]>0) {
      if(axis==='x') {
        for(const x of [a-.05,b+.05])decor(x,base+o[2]-.08,fixed,.12,o[3]+.16,.43);
        for(const y of [base+o[2]-.1,base+o[2]+o[3]])decor((a+b)/2,y,fixed,b-a+.24,.12,.46);
      } else {
        for(const z of [a-.05,b+.05])decor(fixed,base+o[2]-.08,z,.43,o[3]+.16,.12);
        for(const y of [base+o[2]-.1,base+o[2]+o[3]])decor(fixed,y,(a+b)/2,.46,.12,b-a+.24);
      }
    } else {
      if(axis==='x') {for(const x of [a-.08,b+.08])decor(x,base,fixed,.16,o[3],.4);decor((a+b)/2,base+o[3],fixed,b-a+.32,.17,.4);}
      else {for(const z of [a-.08,b+.08])decor(fixed,base,z,.4,o[3],.16);decor(fixed,base+o[3],(a+b)/2,.4,.17,b-a+.32);}
    }
  }
  piece(cursor,max,base,height);
}
function crate(x,z,w=1.8,h=1.7,d=1.8,y=0) {block(x,y,z,w,h,d,'wood','#93734e',{prop:'crate'});}
function prop(kind,x,z,y=0) {
  const spec={barrel:[.8,1.15,.8],dumpster:[2.6,1.65,1.5],pallet:[2,.18,1.4],bench:[2.3,.85,.8]}[kind];
  block(x,y,z,...[spec[0],spec[1],spec[2]],kind==='pallet'?'wood':'metal',kind==='dumpster'?'#526a52':'#766851',{prop:kind});
}
function office(cx,cz,name) {
  block(cx,0,cz,16,.2,16,'tile','#d5c5a5');
  for(const base of [.2,3.8]) {
    const up=base>1;
    wall('x',cz+8,cx,16,base,3.4,up?[[cx+3,2.4,0,2.7],[cx-2,2.3,.9,1.6]]:[[cx+2,2.8,0,2.7],[cx-3,2.3,1,1.5]]);
    wall('x',cz-8,cx,16,base,3.4,[[cx+3,up?2.3:2.8,up?.9:0,up?1.6:2.7]]);
    wall('z',cx-8,cz,16,base,3.4,up?[[cz+2,2.4,.9,1.6]]:[[cz+1,2.6,0,2.7]]);
    wall('z',cx+8,cz,16,base,3.4,[[cz-3,2.4,1,1.5],[cz+3,2.4,1,1.5]]);
    wall('x',cz,cx+2.2,11.6,base,3.4,[[cx+2,2.5,0,2.7]],'brick','#baa589');
    for(const x of [cx-7.8,cx+7.8])for(const z of [cz-8.2,cz+8.2])decor(x,base,z,.24,3.4,.16,'wood','#5b4637');
    for(const z of [cz-8.19,cz+8.19])decor(cx,base+3.13,z,16.4,.22,.18,'wood','#584436');
    // Tables have a conservative solid collider; details are render-only.
    block(cx+5,base,cz-4,2.5,.9,1.2,'wood','#8a6948',{prop:'desk'});
    block(cx+5,base,cz+5,2,.9,1.1,'wood','#8a6948',{prop:'desk'});
    decor(cx+7.77,base+1.1,cz+1,.15,.85,.55,'metal','#777e70');
    decor(cx+1,base+2.9,cz-7.77,1.2,.13,.2,'metal','#eee1b0');
  }
  // Clear 4.4 m-wide stairwell. The landing begins beyond the final tread.
  block(cx+2.2,3.6,cz,11.6,.2,16,'wood','#ab8b62');
  block(cx-5.8,3.6,cz-5.15,4.4,.2,5.7,'wood','#ab8b62');
  for(let n=0;n<16;n++) {
    block(cx-5.8,.2,cz+5.5-n*.5,3.2,(n+1)*.225,.51,'concrete','#b4a58b');
    decor(cx-5.8,.2+(n+1)*.225,cz+5.7-n*.5,3.2,.02,.07,'wood','#68533e');
  }
  block(cx-3.65,3.8,cz+1.55,.15,.9,7.3,'wood','#66503c');
  block(cx,7.2,cz,16.6,.2,16.6,'concrete','#756656');
  // Roof parapets leave the external stair landing open.
  block(cx,7.4,cz+8.2,16.6,.8,.25,'brick','#b69f7f');
  for(const x of [cx-8.2,cx+8.2])block(x,7.4,cz,.25,.8,16.6,'brick','#b69f7f');
  block(cx-3,7.4,cz-8.2,10.4,.8,.25,'brick','#b69f7f');
  block(cx+2,7.4,cz-3,2,1.2,2,'metal','#65756f',{prop:'vent'});
  // Exterior stair climbs to the roof; top connects through the parapet opening.
  block(cx-8.9,0,cz-10.3,1.4,.2,2.4,"concrete","#a49176");
  for(let n=0;n<32;n++)block(cx-8+n*.5,.2,cz-10.3,.51,(n+1)*.225,2.4,'concrete','#a49176');
  block(cx+7.4,7.2,cz-8.95,2,.2,1.3,'concrete','#a49176');
  // Balcony entered through the upstairs doorway.
  block(cx+3,3.6,cz+9.3,5,.2,2.6,'wood','#8e7050');
  block(cx+3,3.8,cz+10.55,5,.9,.15,'wood','#68503b');
  for(const x of [cx+.55,cx+5.45])block(x,3.8,cz+9.3,.15,.9,2.6,'wood','#68503b');
  for(const x of [cx+1,cx+5])decor(x,.2,cz+10.2,.18,3.4,.18,'wood','#5e4938');
  PROPS.push({kind:'sign',text:name,x:cx+2,y:3.3,z:cz+8.22,w:4.6});
  PROPS.push({kind:'sign',text:'ROOF ACCESS →',x:cx-4,y:1.5,z:cz-8.22,ry:Math.PI,w:3.4});
  AREAS.push({name,x:cx,z:cz,w:18,d:22});
}
function barn(cx,cz,name,red) {
  const w=18,d=15,c=red?'#a54c37':'#a28a61';
  block(cx,0,cz,w,.2,d,'concrete','#ab9477');
  wall('x',cz+d/2,cx,w,.2,4.6,[[cx,4.6,0,3.6]],'wood',c);
  wall('x',cz-d/2,cx,w,.2,4.6,[[cx+2,3,0,2.8]],'wood',c);
  wall('z',cx-w/2,cz,d,.2,4.6,[[cz,2.4,1.8,1.5]],'wood',c);
  wall('z',cx+w/2,cz,d,.2,4.6,[[cz,3,0,3]],'wood',c);
  // Flat collidable roof under two clean sloped visible panels.
  block(cx,4.8,cz,w+.5,.18,d+.6,'metal','#554e41');
  for(const side of [-1,1])DECOR.push({x:cx+side*4.5,y:5.5,z:cz,w:9.6,h:.18,d:15.8,mat:'metal',color:'#5e6051',rz:-side*.16});
  for(const z of [cz-7.55,cz+7.55]) {
    decor(cx,4.6,z,w+.4,.25,.22,'wood','#47392e');
    for(const x of [cx-8.8,cx-3,cx+3,cx+8.8])decor(x,.2,z,.18,4.4,.2,'wood','#5d4431');
  }
  crate(cx-5,cz-4,2.1,1.9,2,.2);crate(cx+5,cz+3,2.5,1.3,2,.2);
  prop('barrel',cx+6,cz-4,.2);prop('pallet',cx-5,cz+3,.2);
  PROPS.push({kind:'sign',text:name,x:cx,y:4.1,z:cz+7.73,w:5});
  AREAS.push({name,x:cx,z:cz,w:20,d:19});
}
block(0,-.4,0,86,.4,80,'dirt','#ba8556');
for(const z of [-40,40])block(0,0,z,87,4,.6,'brick','#af9a7d');
for(const x of [-43,43])block(x,0,0,.6,4,80,'brick','#af9a7d');
// Tiled main road and east pavements, grass courts around the barns.
decor(3,.002,0,9,.012,78,'tile','#cbb595');
decor(0,.017,0,85,.012,7,'tile','#cbb595');
for(const z of [-21,21])decor(-24,.003,z,35,.012,30,'grass','#8c9850');
for(const z of [-19,19])decor(23,.019,z,23,.012,24,'tile','#c6ae8b');
barn(-24,-21,'NORTH MILL / 01',false);barn(-24,21,'RED BARN / 02',true);
office(23,-19,'FOUNDRY / A');office(23,19,'WORKSHOP / B');
// Two offset courtyard walls create flanks and break spawn sightlines.
for(const [x,z] of [[-8,-10],[10,9],[-8,11],[10,-9]])block(x,0,z,4.2,1.25,1,'brick','#b6a183');
for(const [x,z] of [[-38,-1],[-16,3],[37,3],[-7,-32],[8,33],[-12,-3],[13,2]])crate(x,z);
for(const [x,z] of [[-36,-10],[-34,11],[11,31],[37,-3]])prop('barrel',x,z);
prop('dumpster',-15,-33);prop('dumpster',37,30);prop('bench',11,-4);
for(const [x,z] of [[-38,32],[-14,11],[10,-33]])prop('pallet',x,z);
// Fenced utility enclosure: individual slats give accurate gaps for bullets.
for(const z of [-7,-3]) {
  for(let n=0;n<12;n++)block(-33+n*.42,0,z,.29,1.8,.1,'wood','#776748');
  for(const y of [.4,1.4])decor(-30.7,y,z,5.1,.12,.13,'wood','#4f4334');
}
// Fixed loading gates flank a clear four-metre passage.
for(const x of [-5,5]) {
  block(x,0,36,.18,3.2,.18,'metal','#4c5343');
  block(x,0,36,2.1,1.5,.16,'wood','#847452');
}
// Tank landmark; each major component physically stops bullets.
block(-2,.35,1,3.3,1,5,'metal','#596349',{prop:'tank'});
for(const x of [-3.9,-.1])block(x,.05,1,.62,.95,5.5,'metal','#33372e');
block(-2,1.35,.7,2.2,.7,2.5,'metal','#66734f');block(-2,1.83,-2,.18,.18,3,'metal','#353d2f');
AREAS.push({name:'TANK COURT',x:-2,z:1,w:13,d:13});
// Small details never participate in player collision.
let seed=4721;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let n=0;n<290;n++) {
  const x=rnd()*82-41,z=rnd()*76-38;
  if(BLOCKS.some(b=>b.y>=0&&b.h>.3&&Math.abs(x-b.x)<b.w/2+.6&&Math.abs(z-b.z)<b.d/2+.6))continue;
  if(x<-10)for(let k=0;k<3;k++)decor(x+k*.16,.025,z+rnd()*.2,.1,.2+rnd()*.45,.12,'grass',n%2?'#738342':'#a1a35b');
  else decor(x,.035,z,.15+rnd()*.4,.035,.2+rnd()*.4,'concrete','#9e8c6d');
}
for(const [x,z] of [[-39,-35],[-39,36],[-11,34],[-12,-34]]){PROPS.push({kind:'tree',x,z,y:0});block(x,0,z,.45,5,.45,'wood','#6b5538');}
for(const [x,z] of [[8,-35],[8,35],[-10,-5],[11,5]])PROPS.push({kind:'lamp',x,z,y:0});
for(let n=0;n<22;n++) {
 const a=n/22*Math.PI*2,x=Math.cos(a)*57,z=Math.sin(a)*53;
 PROPS.push({kind:'tree',x,z,y:0});
}
for(const [x,z,w,h,d] of [[-34,-49,16,12,12],[2,-51,20,16,12],[33,-49,14,10,12],[-54,20,12,13,19],[52,-8,12,11,18],[10,49,23,9,12]]) {
 decor(x,0,z,w,h,d,'plaster','#aa9d84');decor(x,h,z,w+.7,.3,d+.7,'wood','#625b48');
}
PROPS.push({kind:'sign',text:'NEON YARD • MILL DISTRICT',x:2,y:3,z:39.65,w:7,ry:Math.PI});
const SPAWNS=[[-38,-35],[-9,-35],[38,-35],[38,0],[38,35],[8,36],[-38,35],[-39,3],[-24,-21],[-24,21],[25,-15],[25,23]];
module.exports={BLOCKS,DECOR,PROPS,AREAS,SPAWNS};
