import * as T from '../vendor/three/package/build/three.module.js';
import {BallFlight,throwVelocity} from './pet-dynamics.mjs?v=carry1';
import {softShadow} from './pet-art.js';

// Shared by the hero, roaming residents, visiting bird and individual sheep.
export function createCarrySystem({scene,height,walkable,volumes,renderer}){
  const actors=[];
  function register({root,label,radius=.4,bodyHeight=.8,flight=new BallFlight(),hero=false,onBegin=()=>{},onLand=()=>{},poke=()=>{},sync=()=>{}}){
    const actor={root,label,radius,bodyHeight,flight,hero,held:false,onBegin,onLand,poke,sync,impact:0};
    Object.defineProperty(actor,'busy',{get:()=>actor.held||flight.active});
    actor.space={
      clear(p){
        if(Math.abs(p[0])>10||Math.abs(p[2])>7)return false;
        for(const v of volumes){
          if(p[1]>=v.top||p[1]+bodyHeight<=v.bottom)continue;
          if(v.center){
            const y=T.MathUtils.clamp(v.center.y,p[1],p[1]+bodyHeight);
            if(((p[0]-v.center.x)/(v.rx+radius))**2+((y-v.center.y)/v.ry)**2+((p[2]-v.center.z)/(v.rz+radius))**2<1)return false;
            continue;
          }
          const dx=Math.max(v.minX-p[0],0,p[0]-v.maxX),dz=Math.max(v.minZ-p[2],0,p[2]-v.maxZ);
          if(dx*dx+dz*dz<radius*radius)return false;
        }
        for(const b of actors){
          if(b===actor||(b.hero&&b.root.parent!==scene)||!visible(b.root))continue;
          const q=b.root.position;
          if(p[1]>=q.y+b.bodyHeight||p[1]+bodyHeight<=q.y)continue;
          if(Math.hypot(p[0]-q.x,p[2]-q.z)<radius+b.radius)return false;
        }
        return true;
      },
      landing(p){return walkable(p[0],p[2])&&actor.space.clear([p[0],height(p[0],p[2])+.02,p[2]]);},
      safe(p){
        const ox=T.MathUtils.clamp(p[0],-9.8,9.8),oz=T.MathUtils.clamp(p[2],-6.8,6.8);
        for(let r=0;r<=25;r+=.2)for(let n=0;n<(r?40:1);n++){
          const a=n/40*Math.PI*2,x=ox+Math.cos(a)*r,z=oz+Math.sin(a)*r,q=[x,height(x,z),z];
          if(actor.space.landing(q))return q;
        }
        return [0,height(0,1),1];
      }
    };
    actor.begin=()=>{flight.reset();actor.held=true;onBegin();};
    actor.release=velocity=>{actor.held=false;actor.releasedVelocity=[...velocity];flight.launch(root.position.toArray(),velocity);};
    actors.push(actor);return actor;
  }
  function visible(root){for(let p=root;p;p=p.parent)if(!p.visible)return false;return true;}
  const shadow=softShadow(1.6,.2);shadow.renderOrder=2;scene.add(shadow);
  const ring=new T.Mesh(new T.RingGeometry(.48,.51,48),new T.MeshBasicMaterial({color:'#edc7a0',transparent:true,opacity:.48,depthWrite:false,depthTest:false,side:T.DoubleSide,toneMapped:false}));
  ring.rotation.x=-Math.PI/2;ring.renderOrder=20;scene.add(ring);shadow.visible=ring.visible=false;
  function feedback(actor){
    shadow.visible=ring.visible=!!actor;if(!actor)return;
    const p=actor.root.position,y=height(p.x,p.z),h=Math.max(0,p.y-y),valid=actor.space.landing(p.toArray());
    shadow.position.set(p.x,y+.022,p.z);shadow.scale.setScalar(actor.radius*2*(1+Math.min(h,7)*.13));shadow.material.opacity=.26/(1+h*.4);
    ring.position.set(p.x,y+.028,p.z);ring.scale.setScalar(actor.radius*2);ring.material.color.set(valid?'#ead5a6':'#ce806c');
  }
  function update(dt){
    for(const a of actors){
      a.impact=0;if(!a.flight.active)continue;
      a.impact=a.flight.step(dt,height,walkable,a.space);a.root.position.fromArray(a.flight.position);
      if(a.impact>.4)a.poke();
      if(!a.flight.active){a.root.rotation.z=0;a.onLand();}
      a.sync();
      renderer.shadowMap.needsUpdate=true;
    }
  }
  return {register,update,feedback,
    grip(actor,hit,camera){
      actor.root.updateWorldMatrix(true,true);
      const mesh=hit.instanceId===undefined?hit.object:null;
      const normal=camera.getWorldDirection(new T.Vector3());normal.y=0;normal.normalize();
      return {mesh,local:mesh?mesh.worldToLocal(hit.point.clone()):actor.root.worldToLocal(hit.point.clone()),
        plane:new T.Plane().setFromNormalAndCoplanarPoint(normal,hit.point),
        ceiling:hit.point.y+T.MathUtils.clamp(actor.bodyHeight*1.3,.85,1.35),
        phase:'raise',point:hit.point.clone()};
    },
    gripPoint(actor,grip){const object=grip.mesh||actor.root;object.updateWorldMatrix(true,false);return object.localToWorld(grip.local.clone());},
    follow(actor,grip,ray){
      let point=ray.intersectPlane(grip.plane,new T.Vector3());if(!point)return false;
      // During pickup the hand can only raise the grip. Downward pointer
      // movement waits at the highest reached position until the hand rises.
      if(grip.phase==='raise')point.y=Math.max(grip.point.y,point.y);
      if(grip.phase==='raise'&&point.y>=grip.ceiling){
        grip.phase='carry';grip.plane.setFromNormalAndCoplanarPoint(new T.Vector3(0,1,0),new T.Vector3(0,grip.ceiling,0));
        point=ray.intersectPlane(grip.plane,new T.Vector3());if(!point)return false;
      }
      grip.point.copy(point);return true;
    },
    placeGrip(actor,grip){
      const object=grip.mesh||actor.root;object.updateWorldMatrix(true,false);
      const offset=object.localToWorld(grip.local.clone()).sub(actor.root.position);
      const desired=grip.point.clone().sub(offset);
      if(!desired.toArray().every(Number.isFinite))return false;
      if(grip.phase==='raise'){
        const floor=height(desired.x,desired.z);
        if(desired.y<floor){grip.point.y+=floor-desired.y;desired.y=floor;}
      }
      // While held, the grip follows the hand even over invalid landing spots.
      // Scenery and estate bounds become physical constraints only on release.
      actor.root.position.copy(desired);actor.sync();renderer.shadowMap.needsUpdate=true;return true;
    },
    move(actor,desired){
      desired.x=T.MathUtils.clamp(desired.x,-10,10);desired.z=T.MathUtils.clamp(desired.z,-7,7);desired.y=T.MathUtils.clamp(desired.y,height(desired.x,desired.z)+.02,7);
      const start=actor.root.position.clone(),steps=Math.max(1,Math.ceil(start.distanceTo(desired)/.1));
      for(let i=1;i<=steps;i++){
        const next=start.clone().lerp(desired,i/steps);
        if(actor.space.clear(next.toArray()))actor.root.position.copy(next);
        else break;
      }
      renderer.shadowMap.needsUpdate=true;
    },
    velocity(g,time){
      const v=throwVelocity(g.samples,time);if(Math.hypot(...v)<.8)return [0,0,0];
      // Horizontal hand motion is already world-space motion after height lock.
      // Add a small upward arc without inventing a second depth direction.
      const result=[v[0],g.grip?.phase==='carry'?Math.min(2,Math.hypot(v[0],v[2])*.2):Math.max(.3,v[1]*.55),v[2]];
      const speed=Math.hypot(...result);return result.map(n=>n*Math.min(1,9/(speed||1)));
    },
    diagnostics:()=>actors.filter(a=>visible(a.root)).map(a=>({name:a.label,kind:a.root.name,hero:a.hero,position:a.root.position.toArray(),held:a.held,flying:a.flight.active,velocity:[...a.flight.velocity],releasedVelocity:a.releasedVelocity||[0,0,0],valid:a.space.landing(a.root.position.toArray())})),
    dispose(){for(const m of [shadow,ring]){scene.remove(m);m.geometry.dispose();m.material.map?.dispose();m.material.dispose();}}
  };
}
