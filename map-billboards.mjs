import * as THREE from '/three.module.js';

// These materials belong only to Subzero's five “Your Ad Here” faces.
// Reuse their geometry/UVs, leaving the frames and collision untouched.
export async function applySubzeroBillboards(root, anisotropy = 1) {
  const source = await new THREE.TextureLoader().loadAsync('/maps/subzero-billboard.jpg');
  const oldMaterials = new Set(), oldTextures = new Set();
  root.traverse(mesh => {
    if (!mesh.isMesh || !['material_19', 'material_21', 'material_22'].includes(mesh.material?.name)) return;
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    const aspect = Math.max(size.x, size.z) / size.y;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round(canvas.width / aspect);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const fit = Math.min(canvas.width / source.image.width, canvas.height / source.image.height);
    const w = source.image.width * fit, h = source.image.height * fit;
    ctx.drawImage(source.image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    // CanvasTexture's flipY=true matches the existing UVs (top vertices v=1).
    oldMaterials.add(mesh.material);
    if (mesh.material.map) oldTextures.add(mesh.material.map);
    mesh.material = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide});
    mesh.material.name = 'subzero-photo-billboard';
  });
  source.dispose();
  for (const material of oldMaterials) material.dispose();
  for (const texture of oldTextures) texture.dispose();
}
