'use strict';
function weaponDamage(w,distance,head=false){
 const start=w.rangeStart??20,end=w.rangeEnd??80;
 const t=Math.max(0,Math.min(1,(distance-start)/Math.max(1,end-start)));
 return Math.round(w.damage*(1-t*(1-(w.minDamage??.7)))*(head?(w.headMultiplier??1.8):1));
}
function weaponSpread(w,id,aim,ground,stance){
 let spread=w.spread*(aim?(w.aimSpread??.45):1);
 if(!ground)spread*=id==='sniper'?(aim?4:1.6):1.7;
 if(stance==='crouch')spread*=.8;
 if(stance==='prone')spread*=.55;
 if(stance==='slide')spread*=1.5;
 return spread;
}
// Uniform area sampling avoids clustering bullets around the center of the crosshair.
function sampleSpread(spread,random=Math.random){
 const radius=Math.sqrt(random())*spread*.5,angle=random()*Math.PI*2;
 return {yaw:Math.cos(angle)*radius,pitch:Math.sin(angle)*radius};
}
function spreadDiameter(spread,fov,height){
 return Math.max(8,Math.tan(spread*.5)*height/Math.tan(fov*Math.PI/360));
}
module.exports={weaponDamage,weaponSpread,sampleSpread,spreadDiameter};
