import * as THREE from '../vendor/three/package/build/three.module.js';
const base=new URL('../models/qball/',import.meta.url);
const [manifestResponse,meshResponse]=await Promise.all([fetch(new URL('qball.json',base)),fetch(new URL('qball.bin',base))]);
if(!manifestResponse.ok||!meshResponse.ok)throw new Error('Original pet model could not be loaded');
const manifest=await manifestResponse.json(),buffer=await meshResponse.arrayBuffer();
export function originalGeometry(role){
  const part=manifest.parts.find(p=>p.role===role);
  if(!part)throw new Error(`Missing pet mesh: ${role}`);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,part.positions.offset,part.positions.length).slice(),3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,part.indices.offset,part.indices.length).slice(),1));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  return g;
}
