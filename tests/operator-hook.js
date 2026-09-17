window.operatorGallery=()=>{
 const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(240,340);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;
 const sheet=document.createElement('canvas');sheet.width=1440;sheet.height=680;const ctx=sheet.getContext('2d');
 for(const [i,skin]of Object.keys(SKIN_STYLES).entries()){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#263641');scene.add(new THREE.HemisphereLight('#ffffff','#5b6b6c',3));const light=new THREE.DirectionalLight('#fff3df',3);light.position.set(-2,3,-3);scene.add(light);
  const p={skin,gun:'pistol',x:0,y:0,z:0,yaw:0,pitch:0,ground:true},rig=createOperatorRig(p);rig.shield.visible=false;rig.kit.visible=false;scene.add(rig.root);rig.root.rotation.y=-.35;
  const cam=new THREE.PerspectiveCamera(34,240/340,.1,10);cam.position.set(.6,.85,-2.25);cam.lookAt(0,.57,0);r.render(scene,cam);
  const x=i%6*240,y=Math.floor(i/6)*340;ctx.drawImage(r.domElement,x,y);ctx.fillStyle='white';ctx.font='13px sans-serif';ctx.fillText(SKIN_STYLES[skin].name.split(' / ')[0],x+15,y+325);disposeKit(rig.root);rig.shield.material.dispose();
 }
 r.dispose();return sheet.toDataURL('image/png').split(',')[1];
};
window.testKillcam=()=>{
 myId='victim';const victim={id:'victim',name:'You',skin:'rose',gun:'pistol',x:0,y:1.3,z:-1,yaw:Math.PI,pitch:0,ground:true,hp:100,spawnSeq:1,characterScale:CHARACTER_SCALE/1.3};const killer={...victim,id:'killer',name:'Scout',skin:'lime',gun:'rifle',z:7,yaw:0};
 state={phase:'playing',players:[victim,killer],self:{guns:['rifle','pistol'],slot:0,reloadAt:0,ammo:[30,12]}};me={...victim,hp:0};snapshots.length=0;const end=serverNow();
 for(let i=0;i<=26;i++)rememberSnapshot({...state,now:end-2600+i*100,players:[{...victim,x:(26-i)*.015},killer]});
 startKillcam({killerId:'killer',killer:'Scout',gun:'rifle'});show('menu',false);killReplay.started=performance.now()+60000;
};

window.endTestKillcam=()=>{state=null;me=null;};
