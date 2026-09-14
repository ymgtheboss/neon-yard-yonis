'use strict';
// Parse the actual compiled GLB with the production loader. Image decoding is
// stubbed here; this checks geometry/material loading, not browser appearance.
const assert=require('node:assert/strict'),fs=require('node:fs');
global.self=global;global.createImageBitmap=async()=>({width:1,height:1,close(){}});
(async()=>{
 const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
 const data=fs.readFileSync(require.resolve('../public/maps/subzero.glb'));
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 let triangles=0,meshes=0;gltf.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index.count/3;assert.ok(o.material.isMeshBasicMaterial);for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));assert.ok(o.geometry.index.array.every(i=>i<o.geometry.attributes.position.count));}});
 const report=require('../public/maps/subzero-report.json');assert.equal(meshes,report.chunks);assert.equal(triangles,report.renderTriangles);assert.ok(data.length<report.sourceBytes*.6);
 const {MapCollision}=require('../map-collision.cjs'),THREE=require('three'),b=fs.readFileSync(require.resolve('../public/maps/subzero-collision.bin')),collision=new MapCollision(new Float32Array(b.buffer,b.byteOffset,b.byteLength/4));
 gltf.scene.updateMatrixWorld(true);const solids=[];gltf.scene.traverse(o=>{if(o.isMesh&&!o.material.transparent){o.material.side=THREE.DoubleSide;solids.push(o);}});
 const raycaster=new THREE.Raycaster();for(const s of require('../public/maps/subzero-world.json').SPAWNS)for(let i=0;i<12;i++){const o=new THREE.Vector3(s[0],s[2]+1.55,s[1]),d=new THREE.Vector3(Math.sin(i),Math.sin(i*2)*.5,Math.cos(i)).normalize();raycaster.set(o,d);raycaster.far=150;const hit=raycaster.intersectObjects(solids,false)[0]?.distance??150;assert.ok(Math.abs(collision.distance(o,d)-hit)<.002,`Render/collision ray mismatch ${hit}`);}
 console.log('PASS compiled GLB loads with the production loader, has finite geometry, and uses unlit materials');
 console.log('PASS 192 view rays agree between the rendered solid meshes and authoritative collision');
})().catch(error=>{console.error(error);process.exitCode=1;});
