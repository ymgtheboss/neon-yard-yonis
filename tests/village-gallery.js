(async()=>{
 const THREE=await import('/three.module.js'),{GLTFLoader}=await import('/addons/loaders/GLTFLoader.js');
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,800);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#c9d9da');scene.fog=new THREE.Fog('#c9d9da',100,250);scene.add(new THREE.HemisphereLight('#ebeee0','#776047',2.2));const sun=new THREE.DirectionalLight('#ffe0ad',3.1);sun.position.set(-26,47,28);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-72,right:72,top:72,bottom:-72,near:1,far:160});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
 const {scene:map}=await new GLTFLoader().loadAsync('/maps/village.glb');map.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(map);
 const result={},camera=new THREE.PerspectiveCamera(55,1.5,.08,300);
 for(const [name,position,target]of [['overview',[100,100,110],[0,0,0]],['market',[0,1.04,24],[0,3,-5]],['street',[-34,1.04,-28],[-34,3,12]],['balcony',[-9,4.1,-10],[5,2,0]]]){
  camera.position.set(...position);camera.lookAt(...target);renderer.render(scene,camera);sun.shadow.autoUpdate=false;result[name]=renderer.domElement.toDataURL('image/png').split(',')[1];
 }
 const gs=new Set(),ms=new Set(),ts=new Set();map.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});for(const v of [...gs,...ms,...ts])v.dispose();renderer.dispose();return result;
})()
