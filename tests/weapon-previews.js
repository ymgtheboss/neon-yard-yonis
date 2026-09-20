// Build static menu images from the actual textured in-game GLBs, including optics.
(async()=>{
 const THREE=await import('/three.module.js'),assets=await import('/weapon-models.mjs'),visuals=await import('/combat-visuals.js');
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(720,300);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 const output={};
 try{for(const id of Object.keys(assets.WEAPON_HANDLING)){
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e8f4ff','#777070',2.6));
  for(const [color,intensity,pos]of [['#fff4e5',3,[1,3,4]],['#c2dfff',2,[-3,1,-2]],['#ffffff',1,[0,-2,3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);scene.add(light);}
  const kit=assets.createImportedKit(id);if(!kit?.userData.imported)throw Error('Missing weapon model: '+id);
  kit.rotation.set(.06,Math.PI/2+.18,-.05);scene.add(kit);kit.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(kit),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());kit.position.sub(center);
  const half=Math.max(size.y,size.x/(720/300))* .59;
  const camera=new THREE.OrthographicCamera(-half*2.4,half*2.4,half,-half,.01,20);camera.position.set(0,0,5);camera.lookAt(0,0,0);
  renderer.render(scene,camera);output[id]=renderer.domElement.toDataURL('image/webp',.92).split(',')[1];visuals.disposeKit(kit);
 }}finally{renderer.dispose();}
 return output;
})()
