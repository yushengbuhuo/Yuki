import * as T from '../vendor/three/package/build/three.module.js';
import {createFlock} from './pet-flock.mjs';
import {softShadow} from './pet-art.js';
import {JellyMotion} from './pet-jelly.mjs';
import {createResidents} from './pet-residents.js';
export function createWildlife({scene,height,walkable,mobile,renderer,assetKit,hits,status,carry}){
 const residents=createResidents({scene,height,walkable,assetKit,hits,status,carry});
 const flock=createFlock({count:mobile?7:10,walkable}),count=flock.sheep.length;
 const herd=new T.Group();herd.name='visiting-flock';scene.add(herd);
 const dark=new T.MeshLambertMaterial({color:'#776957'});
 const sphere=new T.SphereGeometry(1,12,8);
 const bodies=assetKit.instanced('Animal_Sheep_01',count,herd),parts=[bodies],jellies=Array.from({length:count},(_,i)=>new JellyMotion(i*2.399));
 bodies.instanceMatrix.setUsage(T.DynamicDrawUsage);bodies.frustumCulled=false;
 // Fixed conservative bound: instances travel from outside the estate.
 // Raycasting must not keep a stale sphere computed at their first position.
 bodies.boundingSphere=new T.Sphere(new T.Vector3(),70);
 bodies.userData.activate=hit=>{if(hit.instanceId!==undefined){jellies[hit.instanceId].poke();status.textContent='小羊抖了抖软软的身体。';}};hits.push(bodies);
 const dummy=new T.Object3D(),matrix=new T.Matrix4(),root=new T.Object3D();
 const renderPos=flock.sheep.map(s=>new T.Vector3(s.x,0,s.z)),renderYaw=new Float32Array(count),renderSpeed=new Float32Array(count);
 const sheepRoots=flock.sheep.map((s,i)=>{const o=new T.Object3D();o.name=`flock-sheep-${i}`;herd.add(o);o.position.copy(renderPos[i]);return o;});
 const sheepCarry=sheepRoots.map((o,i)=>carry.register({root:o,label:'小羊',radius:.43,bodyHeight:1,
   onBegin(){flock.sheep[i].carried=true;renderSpeed[i]=0;},
   onLand(){const s=flock.sheep[i];s.carried=false;s.x=o.position.x;s.z=o.position.z;s.vx=s.vz=0;s.cooldown=3;renderPos[i].copy(o.position);},poke(){jellies[i].poke();}}));
 bodies.userData.carryActor=hit=>sheepCarry[hit.instanceId];
 function at(mesh,index,x,y,z,sx,sy,sz,rx=0){dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,0,0);dummy.updateMatrix();matrix.multiplyMatrices(root.matrix,dummy.matrix);mesh.setMatrixAt(index,matrix);}
 const shadows=[];for(let i=0;i<count;i++){const s=softShadow(1.2,.23);herd.add(s);shadows.push(s);}
 // A cloaked shepherd with a broad hat and crook, deliberately simple at this distance.
 const shepherd=new T.Group();herd.add(shepherd);const coat=new T.MeshLambertMaterial({color:'#899488'}),hatMat=new T.MeshLambertMaterial({color:'#715843'}),face=new T.MeshLambertMaterial({color:'#d3b18c'});
 function mesh(g,m,p,scale=[1,1,1],parent=shepherd){const o=new T.Mesh(g,m);o.position.set(...p);o.scale.set(...scale);o.receiveShadow=true;parent.add(o);return o;}
 mesh(new T.ConeGeometry(.3,.88,12),coat,[0,.81,0]);mesh(sphere,face,[0,1.39,0],[.15,.19,.15]);
 mesh(new T.CylinderGeometry(.32,.34,.055,16),hatMat,[0,1.55,0]);mesh(new T.ConeGeometry(.23,.23,16),hatMat,[0,1.69,0]);
 const boots=[mesh(sphere,dark,[-.13,.16,0],[.09,.19,.14]),mesh(sphere,dark,[.13,.16,0],[.09,.19,.14])];
 mesh(new T.CylinderGeometry(.023,.023,1.5,8),hatMat,[.4,.75,0]);
 mesh(new T.TorusGeometry(.13,.023,6,16,Math.PI),hatMat,[.27,1.5,0]);
 let birdHops=0;const hopFrom=new T.Vector3(),hopTo=new T.Vector3();
 let birdState='away',birdAge=0,birdWait=9,birdStart=new T.Vector3(-17,6,4),birdEnd=new T.Vector3(-2,.2,1),lastPhase=2,night=0;
 const bird=new T.Group();bird.name='visiting-bird';scene.add(bird);
 const visitor=assetKit.place('Animal_Bird_02',{parent:bird,scale:.48,idle:true,targets:hits,onActivate:()=>{status.textContent='小鸟轻轻弹了一下。';}}),wings=[];
 const birdCarry=carry.register({root:bird,label:'小鸟',radius:.2,bodyHeight:.5,
   onBegin(){visitor.speed=0;},onLand(){birdState='peck';birdAge=0;bird.rotation.z=0;},poke(){visitor.motion.poke();}});
 visitor.visual.traverse(o=>{if(o.isMesh)o.userData.carryActor=()=>birdCarry;});
 const butterfly=new T.Group();scene.add(butterfly);const wingMat=new T.MeshLambertMaterial({color:'#eadbb9',side:T.DoubleSide});
 const butterflyWings=[mesh(new T.CircleGeometry(.1,8),wingMat,[-.08,0,0],[1,1.4,1],butterfly),mesh(new T.CircleGeometry(.1,8),wingMat,[.08,0,0],[1,1.4,1],butterfly)];
 const birdPosition=new T.Vector3();let bell=0,bleat=0,shadowClock=0;
 function depart(){birdState='depart';birdAge=0;birdStart.copy(bird.position);birdEnd.set(17,7,-5);}
 function update(dt,time,phase,pet,mode,reduced){
  residents.update(dt,mode,reduced);
  lastPhase=phase;night=phase>=3||phase<.05?1:phase>2?(phase-2):0;
  flock.update(dt,phase,mode==='garden'?pet.position:null);herd.visible=flock.stage!=='absent';
  if(herd.visible){
   for(let i=0;i<count;i++){const s=flock.sheep[i],speed=Math.hypot(s.vx,s.vz),graze=s.state==='graze',pos=renderPos[i];
    // Reset only while far outside the estate, never teleport a visible sheep.
    if(sheepCarry[i].busy)pos.copy(sheepRoots[i].position);
    else{if(Math.abs(pos.x-s.x)>15)pos.set(s.x,height(s.x,s.z),s.z);else pos.lerp(new T.Vector3(s.x,height(s.x,s.z),s.z),1-Math.exp(-dt*14));sheepRoots[i].position.copy(pos);}
    renderYaw[i]+=Math.atan2(Math.sin(s.yaw-renderYaw[i]),Math.cos(s.yaw-renderYaw[i]))*(1-Math.exp(-dt*9));renderSpeed[i]+=(speed-renderSpeed[i])*(1-Math.exp(-dt*8));
    root.position.copy(pos);root.rotation.set(0,renderYaw[i],sheepCarry[i].busy?sheepRoots[i].rotation.z:0);root.scale.setScalar(.83+(i%3)*.055);root.updateMatrix();
    const squash=jellies[i].step(dt,time,{speed:renderSpeed[i],strength:assetKit.strength,reduced,idle:true});
    at(bodies,i,0,squash.hop,0,squash.radial,squash.y,squash.radial,graze&&!reduced?Math.sin(time*2+s.seed)*.035:0);
    shadows[i].visible=!sheepCarry[i].busy;shadows[i].position.set(pos.x,height(pos.x,pos.z)+.015,pos.z);
   }
   for(const m of parts)m.instanceMatrix.needsUpdate=true;
   const l=flock.leader;shepherd.position.lerp(new T.Vector3(l.x,height(l.x,l.z),l.z),1-Math.exp(-dt*12));if(Math.abs(shepherd.position.x-l.x)>15)shepherd.position.set(l.x,height(l.x,l.z),l.z);shepherd.rotation.y+=Math.atan2(Math.sin(l.yaw-shepherd.rotation.y),Math.cos(l.yaw-shepherd.rotation.y))*(1-Math.exp(-dt*8));
   boots.forEach((b,i)=>b.rotation.x=reduced?0:Math.sin(l.travel*10+i*Math.PI)*Math.min(.35,l.speed*.5));
  }
  birdAge+=dt;birdWait-=dt;
  if(birdCarry.busy){birdAge=0;}
  else if(birdState==='away'){bird.visible=false;if(phase<2.8&&birdWait<=0){birdState='arrive';birdHops=0;birdAge=0;birdStart.set(-17,6,4);birdEnd.set(-1.7,height(-1.7,1)+.03,1);bird.visible=true;}}
  else if(birdState==='arrive'||birdState==='depart'){
   const t=Math.min(1,birdAge/4),s=t*t*(3-2*t);bird.position.lerpVectors(birdStart,birdEnd,s);bird.position.y+=Math.sin(t*Math.PI)*1.2;
   bird.rotation.y=Math.atan2(birdEnd.x-birdStart.x,birdEnd.z-birdStart.z);wings.forEach((w,i)=>w.rotation.z=reduced?0:Math.sin(time*22)*(i?1:-1)*.9);
   if(t===1){if(birdState==='depart'){birdState='away';bird.visible=false;birdWait=25+Math.random()*20;}else{birdState='peck';birdAge=0;}}
  }else{
   const nearby=mode==='garden'&&Math.hypot(pet.position.x-bird.position.x,pet.position.z-bird.position.z)<1.4;
   if(nearby&&birdState==='peck'){birdState='watch';birdAge=0;}
   if(birdState==='hop'){const t=Math.min(1,birdAge/.5);bird.position.lerpVectors(hopFrom,hopTo,t);bird.position.y+=reduced?0:Math.sin(t*Math.PI)*.16;if(t===1){birdState='peck';birdAge=0;}}
   else if(birdState==='watch'&&birdAge>.7&&birdHops<2){const dx=bird.position.x-pet.position.x,dz=bird.position.z-pet.position.z,d=Math.hypot(dx,dz)||1;const x=bird.position.x+dx/d*.8,z=bird.position.z+dz/d*.8;if(walkable(x,z)){hopFrom.copy(bird.position);hopTo.set(x,height(x,z)+.03,z);birdState='hop';birdAge=0;birdHops++;}else depart();}
   else if((birdState==='watch'&&birdAge>.7)||birdAge>14||phase>=2.8)depart();
   else{bird.rotation.x=birdState==='peck'&&!reduced?Math.max(0,Math.sin(time*3))*.35:0;wings.forEach(w=>w.rotation.z=0);if(birdState==='watch')bird.rotation.y=Math.atan2(pet.position.x-bird.position.x,pet.position.z-bird.position.z);}
  }
  birdPosition.copy(bird.position);
  visitor.speed=['arrive','depart','hop'].includes(birdState)?1:0;
  butterfly.visible=phase>.15&&phase<2.7;butterfly.position.set(2.5+Math.sin(time*.18)*.5,.85+Math.sin(time*.6)*.15,3.4+Math.cos(time*.24)*.35);butterflyWings.forEach((w,i)=>w.rotation.y=reduced?0:Math.sin(time*14)*(i?1:-1));
  bell+=dt;bleat+=dt;shadowClock+=dt;if(mode==='garden'&&shadowClock>.2){renderer.shadowMap.needsUpdate=true;shadowClock=0;}
 }
 return {update,flock,colliders(){return [...residents.colliders(),...(herd.visible?[...renderPos.map(p=>({x:p.x,z:p.z,y:p.y,r:.62,h:1.05})),{x:shepherd.position.x,z:shepherd.position.z,y:shepherd.position.y,r:.44,h:1.9}]:[])];},get bird(){return bird.visible&&['peck','watch'].includes(birdState)?birdPosition:null;},
  audioEvents(){const result=[];if(bell>6&&herd.visible&&flock.leader.speed>.1){bell=0;result.push({kind:'bell',position:flock.leader});}if(bleat>22&&herd.visible){bleat=0;result.push({kind:'bleat',position:flock.sheep[0]});}return result;},
  diagnostics(){return {...flock.diagnostics(),bird:birdState,count,residents:residents.diagnostics(),colliders:[...residents.colliders(),...(herd.visible?[...renderPos.map(p=>({x:p.x,z:p.z,y:p.y,r:.62,h:1.05})),{x:shepherd.position.x,z:shepherd.position.z,y:shepherd.position.y,r:.44,h:1.9}]:[])]};}};
}
