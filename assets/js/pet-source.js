import {GLTFLoader} from '../vendor/three/package/examples/jsm/loaders/GLTFLoader.js';
// The separate character studio uses the same latest Qball as the manor.
// Load only the hero here, rather than the entire manor asset library.
const gltf=await new GLTFLoader().loadAsync(new URL('../models/manor/Qball.glb',import.meta.url).href),parts=new Map();
gltf.scene.updateMatrixWorld(true);
const materials=new Set(),textures=new Set();
gltf.scene.traverse(o=>{if(!o.isMesh)return;
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.computeBoundingBox();g.computeBoundingSphere();parts.set(o.userData.manorRole,g);o.geometry.dispose();materials.add(o.material);
});
for(const m of materials){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);m.dispose();}
for(const t of textures){t.source?.data?.close?.();t.dispose();}
export function originalGeometry(role){
  const geometry=parts.get(role);if(!geometry)throw new Error('Qball 部位缺失：'+role);return geometry.clone();
}
