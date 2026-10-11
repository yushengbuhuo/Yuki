import * as T from '../vendor/three/package/build/three.module.js';
import {batchStatic,painted} from './pet-art.js';
const curve=new T.CatmullRomCurve3([[-3.65,0,-1.7],[-3.1,0,.3],[-1,0,1.7],[1.4,0,3.9],[4.3,0,4.7],[8.8,0,3.5],[9.3,0,-1.9],[5.7,0,-3.2],[1.3,0,-3.5],[-.3,0,-5.2]].map(p=>new T.Vector3(...p)));
const path=curve.getSpacedPoints(120);
export function pathDistance(x,z){let d=Infinity;for(const p of path)d=Math.min(d,Math.hypot(x-p.x,z-p.z));return d;}
export function createGardenDetails(scene,height,assetKit){
 const group=new T.Group();scene.add(group);const iron=painted('#37342f'),stone=painted('#bdb6a3'),glass=new T.MeshStandardMaterial({color:'#e9c884',emissive:'#ffbd68',roughness:.85});
 const lights=[],swarmLights=[],targets=[],obstacles=[];
 function put(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.receiveShadow=true;group.add(o);return o;}
 const slabs=new T.InstancedMesh(new T.CylinderGeometry(.48,.5,.075,7),stone,70),dummy=new T.Object3D();
 for(let i=0;i<70;i++){const p=curve.getPointAt(i/69),a=curve.getTangentAt(i/69);dummy.position.set(p.x,height(p.x,p.z)+.045,p.z);dummy.rotation.set(0,Math.atan2(a.x,a.z)+Math.sin(i*7)*.14,0);dummy.scale.set(.87+Math.sin(i*13)*.12,1,.63+Math.cos(i*8)*.08);dummy.updateMatrix();slabs.setMatrixAt(i,dummy.matrix);}slabs.receiveShadow=true;group.add(slabs);
 for(const [x,z] of [[-4.1,.1],[-.8,2.8],[4.8,5.35],[8.4,-2.6]]){
  const y=height(x,z),cx=x,cy=y+.62;
  assetKit.place('Manor_StoneLantern_01',{parent:group,position:[x,y,z],scale:1.1,targets});
  obstacles.push({x,z,r:.38});
  const glow=put(new T.SphereGeometry(.1,8,6),glass,cx,cy,z);glow.castShadow=false;
  const l=new T.PointLight('#ffce8a',0,4.5,2);l.position.set(cx,cy-.1,z);scene.add(l);lights.push(l);
 }
 const bases=[[3.15,.8,3.5],[-6,.8,1.7],[.5,.7,-4.7]];const positions=new Float32Array(36*3),brightness=new Float32Array(36);
 for(const p of bases){const l=new T.PointLight('#e7efa0',0,2.8,2);l.position.set(p[0],height(p[0],p[2])+p[1],p[2]);scene.add(l);swarmLights.push(l);lights.push(l);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('brightness',new T.BufferAttribute(brightness,1));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{night:{value:0}},vertexShader:'attribute float brightness;varying float glow;void main(){glow=brightness;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(100./max(1.,-p.z),3.,13.);}',fragmentShader:'uniform float night;varying float glow;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=exp(-r*r*5.)*glow*night;gl_FragColor=vec4(1.,.95,.48,a);}' });
 const flies=new T.Points(geometry,material);flies.frustumCulled=false;scene.add(flies);
 batchStatic(group,[]);
 function update(night,time,reduced){const t=reduced?0:time;glass.emissiveIntensity=.08+night*2;for(let i=0;i<4;i++)lights[i].intensity=night*5;
  const strength=T.MathUtils.smoothstep(night,.25,.85);material.uniforms.night.value=strength;flies.visible=strength>0;
  for(let g=0;g<3;g++){const base=bases[g],l=swarmLights[g];l.position.set(base[0]+Math.sin(t*.19+g)*.22,height(base[0],base[2])+base[1]+Math.sin(t*.31+g)*.12,base[2]+Math.cos(t*.16+g)*.22);let total=0;
   for(let j=0;j<12;j++){const i=g*12+j,a=j*2.399+t*(.12+(j%3)*.025);positions[i*3]=l.position.x+Math.cos(a)*(.2+(j%4)*.14);positions[i*3+1]=l.position.y+Math.sin(t*.42+j)*.22;positions[i*3+2]=l.position.z+Math.sin(a)*(.18+(j%5)*.1);brightness[i]=.2+.8*Math.pow(.5+.5*Math.sin(t*.9+j*1.8+g),2);total+=brightness[i];}
   l.intensity=strength*(total/12)*1.9;
  }geometry.attributes.position.needsUpdate=true;geometry.attributes.brightness.needsUpdate=true;
 }
 return {lights,update,targets,obstacles};
}

