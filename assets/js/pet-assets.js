import * as T from '../vendor/three/package/build/three.module.js';
import {GLTFLoader} from '../vendor/three/package/examples/jsm/loaders/GLTFLoader.js';
import {createPetSkin} from './pet-skin.js?v=softblack3';
import {JellyMotion} from './pet-jelly.mjs';

const directory=new URL('../models/manor/',import.meta.url);
export async function loadManorAssets(loading){
  const response=await fetch(new URL('manifest.json',directory));
  if(!response.ok)throw new Error('模型清单读取失败');
  const manifest=await response.json(),entries=Object.entries(manifest.models),templates=new Map(),used=new Set(),placed=[],materialCache=new Map(),sourceTextures=new Set();
  function matteMaterial(source){
    if(materialCache.has(source))return materialCache.get(source);
    // These painted assets need diffuse lighting, not a per-light GGX specular
    // calculation. Preserve the maps, colors and shadow/style compatibility.
    const material=new T.MeshLambertMaterial({color:source.color,map:source.map,
      emissive:source.emissive,emissiveMap:source.emissiveMap,emissiveIntensity:source.emissiveIntensity,
      normalMap:source.normalMap,normalScale:source.normalScale,aoMap:source.aoMap,aoMapIntensity:source.aoMapIntensity,
      side:source.side,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,vertexColors:source.vertexColors});
    material.name=source.name;materialCache.set(source,material);for(const v of Object.values(source))if(v?.isTexture)sourceTextures.add(v);return material;
  }
  const loader=new GLTFLoader();let next=0,loaded=0;
  // Four concurrent requests cap decode pressure on mobile devices.
  await Promise.all(Array.from({length:4},async()=>{
    while(next<entries.length){
      const [name,entry]=entries[next++],gltf=await loader.loadAsync(new URL(entry.file,directory).href),parts=[];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(o=>{if(!o.isMesh)return;
        const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();
        const material=matteMaterial(o.material);
        parts.push({geometry,material,role:o.userData.manorRole,sourceObject:o.userData.sourceObject});o.geometry.dispose();
      });
      if(!parts.length)throw new Error(name+' 没有可显示的网格');
      templates.set(name,parts);loaded++;if(loading)loading.textContent=`正在迎接庄园的新伙伴… ${loaded}/${entries.length}`;
    }
  }));
  for(const source of materialCache.keys())source.dispose();
  let strength=1;try{const saved=localStorage.getItem('manor-jelly');if(saved!==null&&Number.isFinite(Number(saved)))strength=T.MathUtils.clamp(Number(saved),0,1.5);}catch{}
  function prefab(name){
    const parts=templates.get(name);if(!parts)throw new Error('未知模型 '+name);used.add(name);
    const group=new T.Group();group.name=name;group.userData.asset=name;
    for(const p of parts){const mesh=new T.Mesh(p.geometry,p.material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.asset=name;group.add(mesh);}return group;
  }
  function place(name,{parent,position=[0,0,0],scale=1,yaw=0,onActivate,targets,idle=false}={}){
    const root=new T.Group(),visual=prefab(name),motion=new JellyMotion(placed.length*2.399);
    root.name=name;root.userData.asset=name;root.position.set(...position);root.scale.setScalar(scale);root.rotation.y=yaw;root.add(visual);parent.add(root);
    const actor={name,root,visual,motion,idle,speed:0,hop:false};placed.push(actor);
    if(targets)visual.traverse(o=>{if(!o.isMesh)return;o.userData.activate=()=>{motion.poke();onActivate?.();};targets.push(o);});
    return actor;
  }
  function instanced(name,count,parent){
    const parts=templates.get(name);if(parts?.length!==1)throw new Error(name+' 不能合批');used.add(name);
    const m=new T.InstancedMesh(parts[0].geometry,parts[0].material,count);m.name=name;m.userData.asset=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function createHero(){
    const root=new T.Group();root.name='Qball';root.userData.asset='Qball';used.add('Qball');
    const skin=createPetSkin(),eyes=new T.MeshBasicMaterial({color:'#fff5df',toneMapped:false,fog:false});
    for(const p of templates.get('Qball')){if(!p.role)throw new Error('Qball 部位缺少标记');
      // Unique mutable geometry is required by the existing local pull solver.
      const o=new T.Mesh(p.geometry.clone(),p.role.startsWith('eye')?eyes:skin);o.userData.role=p.role;o.userData.sourceObject=p.sourceObject;o.castShadow=!p.role.startsWith('eye');o.receiveShadow=true;root.add(o);
    }return root;
  }
  function update(dt,time,mode,reduced){let moving=false;
    for(const a of placed){let scene=a.root;while(scene.parent)scene=scene.parent;
      if((mode==='room')!==(scene.userData.manorRoom===true))continue;
      const p=a.motion.step(dt,time,{speed:a.speed,strength,reduced,idle:a.idle,hop:a.hop});
      a.visual.scale.set(p.radial,p.y,p.radial);a.visual.position.y=p.hop;a.visual.rotation.z=p.lean;
      if(Math.abs(a.motion.compression)>.001)moving=true;
    }
    return moving;
  }
  return {manifest,prefab,place,instanced,createHero,update,get strength(){return strength;},setStrength(value){strength=T.MathUtils.clamp(Number(value)||0,0,1.5);try{localStorage.setItem('manor-jelly',strength);}catch{}},
    diagnostics(){return {loaded,bytes:entries.reduce((n,[,e])=>n+e.bytes,0),used:[...used],hero:'Qball',strength,objects:placed.map(a=>({name:a.name,position:a.root.position.toArray(),scale:a.visual.scale.toArray(),pulses:a.motion.pulses}))};},
    dispose(){const materials=new Set(),textures=new Set(sourceTextures);for(const parts of templates.values())for(const p of parts){p.geometry.dispose();materials.add(p.material);}for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures){t.source?.data?.close?.();t.dispose();}}
  };
}
