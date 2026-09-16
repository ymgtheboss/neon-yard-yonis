(async()=>{
 const THREE=await import('/three.module.js'),{GLTFLoader}=await import('/addons/loaders/GLTFLoader.js');
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,900);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
 const result={},camera=new THREE.PerspectiveCamera(65,1.6,.08,300);
 for(const [id,position,target]of [['subzero',[-9,10,28],[0,4,-8]],['village',[0,5,28],[0,4,-6]]]){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bbcdd5');scene.add(new THREE.HemisphereLight('#ebeee0','#776047',2.2));const sun=new THREE.DirectionalLight('#ffe0ad',3.1);sun.position.set(-26,47,28);scene.add(sun);
  const {scene:map}=await new GLTFLoader().loadAsync('/maps/'+id+'.glb');scene.add(map);
  if(id==='subzero')await (await import('/map-billboards.mjs')).applySubzeroBillboards(map);
  camera.position.set(...position);camera.lookAt(...target);renderer.render(scene,camera);result[id]=renderer.domElement.toDataURL('image/jpeg',.88).split(',')[1];
  const resources=new Set();map.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const item of resources)item.dispose();
 }
 renderer.dispose();return result;
})()
