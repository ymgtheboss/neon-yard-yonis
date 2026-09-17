'use strict';
const TEAMS=['blue','red'];
class CaptureMode {
 constructor(){this.reset();}
 reset(){this.points=[];this.scores={blue:0,red:0};this.nextMove=0;this.wave=0;this.sites=[];}
 start(now,sites){this.reset();this.sites=sites;this.relocate(now);}
 relocate(now){
  const old=new Set(this.points.map(p=>p.site)),available=this.sites.map((s,i)=>({...s,site:i})).filter(s=>!old.has(s.site));
  const pool=available.length>=3?available:this.sites.map((s,i)=>({...s,site:i}));
  const chosen=[pool[(this.wave*5)%pool.length]];
  while(chosen.length<3){const candidates=pool.filter(p=>!chosen.includes(p));candidates.sort((a,b)=>Math.min(...chosen.map(p=>Math.hypot(b.x-p.x,b.z-p.z)))-Math.min(...chosen.map(p=>Math.hypot(a.x-p.x,a.z-p.z))));chosen.push(candidates[0]);}
  this.points=chosen.map((p,i)=>({...p,id:'ABC'[i],radius:3,progress:0,owner:null,contested:false}));this.wave++;this.nextMove=now+60000;
 }
 tick(now,dt,players,eligible=()=>true){
  if(!this.points.length)return;
  if(now>=this.nextMove)this.relocate(this.nextMove+Math.floor((now-this.nextMove)/60000)*60000);
  for(const point of this.points){
   const counts={blue:0,red:0},inside=[];
   for(const p of players)if(p.hp>0&&TEAMS.includes(p.team)&&Math.abs(p.y-point.y)<1.2&&Math.hypot(p.x-point.x,p.z-point.z)<=point.radius&&eligible(p,point)){counts[p.team]++;inside.push(p);}
   point.contested=counts.blue>0&&counts.red>0;
   if(!point.contested){const team=counts.blue?'blue':counts.red?'red':null;
    if(team){const direction=team==='blue'?-1:1,old=point.progress;point.progress=Math.max(-100,Math.min(100,old+direction*20*dt*Math.min(1.5,1+(counts[team]-1)*.25)));
     if(point.owner&&point.owner!==team&&old*point.progress<=0)point.owner=null;
     if(Math.abs(point.progress)>=100&&point.owner!==team){point.owner=team;for(const p of inside)p.captures=(p.captures||0)+1;}
    }
    if(point.owner)this.scores[point.owner]+=dt;
   }
  }
 }
 state(){return {points:this.points,scores:{blue:Math.floor(this.scores.blue),red:Math.floor(this.scores.red)},nextMove:this.nextMove,wave:this.wave};}
}
module.exports={CaptureMode,TEAMS};
