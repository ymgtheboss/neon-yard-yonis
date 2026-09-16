// Evaluated in Chrome by browser.cjs, using the same cached GLBs as the game.
(async()=>{
 const THREE=await import('/three.module.js'),assets=await import('/weapon-models.mjs'),visuals=await import('/combat-visuals.js');
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(360,270);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1080;const ctx=sheet.getContext('2d'),stats=[];
 const ids=Object.keys(assets.WEAPON_HANDLING);
 for(const [i,id]of ids.entries()){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b9cfd4');scene.add(new THREE.HemisphereLight('#e5faff','#655949',3));const light=new THREE.DirectionalLight('#fff',3);light.position.set(-2,4,2);scene.add(light);
  const kit=assets.createImportedKit(id);if(!kit?.userData.imported)throw Error('Missing GLB '+id);kit.scale.setScalar(.85);scene.add(kit);const camera=new THREE.PerspectiveCamera(70,360/270,.01,10);
  const moving=kit.userData.bolt.children.length,magazine=kit.userData.magazine.children.length;
  for(const [pose,aim]of [false,true].entries()){
   kit.position.set(aim?0:.24,aim?-kit.userData.sightHeight*.85:-.22,aim?kit.userData.adsZ:-.62);
   renderer.render(scene,camera);
   const x=i%5*360,y=Math.floor(i/5)*270+pose*540;ctx.drawImage(renderer.domElement,x,y);ctx.fillStyle='#10232c';ctx.fillRect(x,y,360,23);ctx.fillStyle='white';ctx.font='13px sans-serif';ctx.fillText(id+' / '+(aim?'ADS':'HIP'),x+10,y+16);
   if(!aim)stats.push({id,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,moving,magazine});
  }
  visuals.disposeKit(kit);
 }
 // Rebuilding after disposal must leave shared GLB geometries and textures usable.
 const scene=new THREE.Scene(),kit=assets.createImportedKit('rifle');scene.add(kit);renderer.render(scene,new THREE.PerspectiveCamera());visuals.disposeKit(kit);
 const data=sheet.toDataURL('image/png').split(',')[1];renderer.dispose();return {data,stats};
})()
