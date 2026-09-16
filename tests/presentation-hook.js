// Injected into the page by CDP only for --presentation. Never served by the game.
window.renderPresentationGallery=()=>{
 const saved={state,me,predicted,aim,shotAt,gunId,aspect:viewCamera.aspect,background:viewScene.background};
 const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1980;const ctx=canvas.getContext('2d');
 const ids=['pistol','rifle','shotgun','sniper','revolver','autoshot'];
 renderer.setSize(600,330);viewCamera.aspect=600/330;viewCamera.updateProjectionMatrix();viewScene.background=new THREE.Color('#182633');
 try{
  for(const [row,id]of ids.entries())for(const [column,progress]of [0,.36,.8].entries()){
   state={phase:'playing',self:{guns:[id,'pistol'],slot:0,ammo:[1,12],reloadAt:progress?serverNow()+WEAPONS[id].reload*1000*(1-progress):0}};
   me={hp:100,x:0,y:0,z:0,ground:true,vx:0,vz:0,stance:'stand'};predicted=null;aim=false;shotAt=-10000;buildGun(id);gunRoot.visible=true;
   for(let i=0;i<60;i++)upgradeFrame(1/60,performance.now()+1000);
   renderer.autoClear=true;renderer.render(viewScene,viewCamera);ctx.drawImage(renderer.domElement,column*600,row*330,600,330);
   ctx.fillStyle='#f3ddad';ctx.font='16px sans-serif';ctx.fillText(id.toUpperCase()+' · '+['READY','EXTRACT / LOAD','CHAMBER / SEAT'][column],column*600+16,row*330+25);
  }
  return canvas.toDataURL('image/png').split(',')[1];
 }finally{
  state=saved.state;me=saved.me;predicted=saved.predicted;aim=saved.aim;shotAt=saved.shotAt;buildGun(saved.gunId||'rifle');viewCamera.aspect=saved.aspect;viewCamera.updateProjectionMatrix();viewScene.background=saved.background;renderer.setSize(innerWidth,innerHeight);
 }
};
