import * as T from '../vendor/three/package/build/three.module.js';

// Compact local support: the rest of the body stays at its original vertices.
export function createSoftBody(pet){
  const eyes=[],skins=[],anchor=new T.Vector3();
  for(const mesh of pet.children){
    const role=mesh.userData.role;
    if(role?.startsWith('eye')){
      const center=mesh.geometry.boundingBox.getCenter(new T.Vector3());mesh.geometry.translate(-center.x,-center.y,-center.z);mesh.position.copy(center);
      eyes.push({mesh,center,weight:0});continue;
    }
    if(!role)continue;
    const p=mesh.geometry.attributes.position;p.setUsage(T.DynamicDrawUsage);
    skins.push({mesh,base:p.array.slice(),weights:[]});
  }
  let radius=.68,deformation=0,engaged=false,age=0;
  const history=[],bands=Array.from({length:4},()=>[0,0,0]);
  let delayed=false;
  function sample(t){if(!history.length)return [0,0,0];if(t<=history[0].t)return history[0].v;for(let i=1;i<history.length;i++){if(history[i].t>=t){const a=history[i-1],b=history[i],f=(t-a.t)/(b.t-a.t);return a.v.map((v,j)=>v+(b.v[j]-v)*f);}}return history.at(-1).v;}
  const weight=(x,y,z,r)=>{const d=Math.hypot(x-anchor.x,y-anchor.y,z-anchor.z)/r;return d>=1?0:Math.pow(1-d*d,2);};
  function reset(){
    for(const part of skins){part.mesh.geometry.attributes.position.array.set(part.base);part.mesh.geometry.attributes.position.needsUpdate=true;part.mesh.geometry.computeVertexNormals();part.mesh.geometry.computeBoundingSphere();part.mesh.geometry.computeBoundingBox();part.weights=[];}
    for(const e of eyes){e.mesh.position.copy(e.center);e.weight=0;}
    history.length=0;age=0;delayed=false;deformation=0;engaged=false;
  }
  function begin(point,role){
    reset();engaged=true;anchor.copy(point);radius=role?.startsWith('foot')?.4:.68;
    for(const part of skins){
      for(let i=0;i<part.base.length;i+=3){part.weights.push(weight(part.base[i],part.base[i+1],part.base[i+2],radius));}
      part.mesh.geometry.boundingSphere.radius+=2.6;part.mesh.geometry.boundingBox.expandByScalar(2.6);
    }
    for(const e of eyes){e.weight=weight(e.center.x,e.center.y,e.center.z,radius);}
  }
  const mapped=new T.Vector3();
  function displace(x,y,z,w,offset){
    if(w===0)return mapped.set(x,y,z);
    if(delayed){const distance=Math.sqrt(1-Math.sqrt(w)),phase=T.MathUtils.smoothstep(distance,.18,.92)*3,index=Math.min(2,Math.floor(phase)),blend=phase-index;offset=bands[index].map((v,i)=>v+(bands[index+1][i]-v)*blend);}
    const strength=Math.hypot(...offset),inv=1/(strength||1),nx=offset[0]*inv,ny=offset[1]*inv,nz=offset[2]*inv;
    const dx=x-anchor.x,dy=y-anchor.y,dz=z-anchor.z,dot=dx*nx+dy*ny+dz*nz;
    // Tighten the neck of a pull, without turning the whole pet into a scaled sphere.
    const pinch=Math.min(.22,strength*.1)*w;
    const floor=T.MathUtils.smoothstep(y,0,.35);
    mapped.set(x+offset[0]*w-(dx-dot*nx)*pinch,
      y+(offset[1]*w-(dy-dot*ny)*pinch)*floor,
      z+offset[2]*w-(dz-dot*nz)*pinch);
    mapped.y=Math.max(0,mapped.y);
    return mapped;
  }
  function update(offset,emotion,time,reduced,dt=1/60,held=false){
    age+=Math.min(dt,.06);history.push({t:age,v:[...offset]});while(history.length>2&&history[1].t<age-.11)history.shift();
    delayed=!held&&!reduced&&engaged;
    for(let i=0;i<4;i++)bands[i]=sample(age-i*.025);
    const resting=Math.hypot(...offset)===0&&(!delayed||bands.every(b=>Math.hypot(...b)===0));
    const changed=engaged&&(!resting||deformation>0);
    if(changed){deformation=0;
      for(const part of skins){const p=part.mesh.geometry.attributes.position;
        for(let j=0;j<part.weights.length;j++){const i=j*3;const v=resting?mapped.set(part.base[i],part.base[i+1],part.base[i+2]):displace(part.base[i],part.base[i+1],part.base[i+2],part.weights[j],offset);
          p.array[i]=v.x;p.array[i+1]=v.y;p.array[i+2]=v.z;
          deformation=Math.max(deformation,Math.hypot(v.x-part.base[i],v.y-part.base[i+1],v.z-part.base[i+2]));
        }
        p.needsUpdate=true;part.mesh.geometry.computeVertexNormals();
      }

    }
    const blink=!reduced&&Math.sin(time*1.7)>.997?.16:1;
    eyes.forEach((e,i)=>{
      if(engaged&&!resting)e.mesh.position.copy(displace(e.center.x,e.center.y,e.center.z,e.weight,offset));else e.mesh.position.copy(e.center);
      const goal=emotion==='hurt'?.15:emotion==='angry'?.52:blink;
      e.mesh.scale.y=T.MathUtils.lerp(e.mesh.scale.y,goal,1-Math.exp(-dt*24));
      e.mesh.rotation.z=emotion==='angry'?(i===0?-.22:.22):0;
    });
    return changed;
  }
  return {begin,reset,update,get deformation(){return deformation;},get anchor(){return anchor.clone();},get eyes(){return eyes.map(e=>e.mesh);}};
}
