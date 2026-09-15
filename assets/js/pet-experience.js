import * as T from '../vendor/three/package/build/three.module.js';
import {createPetRoom} from './pet-room.js';
import {createSoftBody} from './pet-softbody.js';
import {createNavigator,GardenWalker} from './pet-navigation.mjs';
import {ElasticPull,Temper,BallFlight,throwVelocity} from './pet-dynamics.mjs?v=recoil3';

export function createPetExperience({renderer,scene,camera,pet,door,land,hits,target,height,walkable,perform,status,reduced,onHurt}){
  const walker=new GardenWalker(createNavigator(walkable)),requested=new T.Vector2(Infinity,Infinity);
  let leanX=0,leanZ=0,kickAge=1,kickStrength=0;
  const kickDirection=new T.Vector3(),kickWorld=new T.Vector3(),upAxis=new T.Vector3(0,1,0);
  const canvas=renderer.domElement,parts=pet.children.filter(o=>o.userData.role);
  const soft=createSoftBody(pet),elastic=new ElasticPull(),temper=new Temper(),flight=new BallFlight();
  const room=createPetRoom(()=>setMode('garden'),perform);
  const pop=new T.Group();room.scene.add(pop);pop.visible=false;
  const star=new T.Shape();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.3:1;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)star.moveTo(x,y);else star.lineTo(x,y);}star.closePath();
  const sparkGeometry=new T.ShapeGeometry(star),sparkMaterial=new T.MeshBasicMaterial({color:'#ffe3a1',transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  for(let i=0;i<8;i++){const m=new T.Mesh(sparkGeometry,sparkMaterial);m.renderOrder=1000;pop.add(m);}
  let popAge=1,popStrength=0;

  const ray=new T.Raycaster(),pointer=new T.Vector2(),planePoint=new T.Vector3(),direction=new T.Vector3();
  let mode='room',gesture=null,yaw=0,zoom=1,indoorYaw=0,impact=0;
  let lastRenderEmotion='calm',disposed=false,impactSpeed=0;
  const now=()=>performance.now()/1000;
  let idleUntil=now()+8,wandering=false;const roomPosition=new T.Vector3(0,.025,.1),roomTarget=roomPosition.clone();
  function activity(){idleUntil=now()+8;if(wandering){target.set(pet.position.x,0,pet.position.z);roomTarget.copy(roomPosition);}wandering=false;}
  function chooseWalk(time){
    if((mode==='garden'&&walker.active&&!wandering)||time<idleUntil||gesture||flight.active||elastic.active||document.hidden||reduced.matches)return;
    const dest=mode==='room'?roomTarget:target;
    if(wandering){if(Math.hypot(dest.x-pet.position.x,dest.z-pet.position.z)<.1){wandering=false;idleUntil=time+2+Math.random()*4;}return;}
    for(let attempt=0;attempt<20;attempt++){
      const a=Math.random()*Math.PI*2,r=1.3+Math.random()*2.6;
      const x=mode==='room'?(Math.random()-.5)*.85:pet.position.x+Math.cos(a)*r;
      const z=mode==='room'?Math.random()*.4-.08:pet.position.z+Math.sin(a)*r;
      if(mode==='garden'&&(Math.abs(x)>9||Math.abs(z)>6||!walkable(x,z)))continue;
      dest.set(x,mode==='room'?.025:0,z);wandering=true;break;
    }if(!wandering)idleUntil=time+3;
  }
  const currentCamera=()=>mode==='room'?room.camera:camera;
  const currentTargets=()=>mode==='room'?room.targets:hits;
  const listeners=[];
  function listen(target,type,handler,options){target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));}
  function setMode(next){
    walker.stop();requested.set(Infinity,Infinity);leanX=leanZ=0;pop.visible=false;popAge=1;activity();roomPosition.set(0,.025,.1);roomTarget.copy(roomPosition);cancel();elastic.reset();soft.reset();flight.reset();impact=impactSpeed=0;mode=next;pet.rotation.set(0,0,0);indoorYaw=0;
    if(mode==='room'){room.scene.add(pet);pet.scale.setScalar(1);pet.position.set(0,.025,.1);}
    else{scene.add(pet);pet.scale.setScalar(.55);pet.position.set(0,height(0,1),1);target.set(0,0,1);}
    renderer.shadowMap.needsUpdate=true;resize();
    canvas.setAttribute('aria-label',mode==='room'?'小球的小屋。左键按住任意部位拖拽，松手回弹。中键转动小球。点门去庄园。G 抓取，方向键拉伸，空格释放，Escape 取消，E 出门。':'小球的庄园。左键抓起整只小球，移动后松手抛出。点房门回小屋。点地面散步，拖动空地环顾。G 抓起，方向键移动，PageUp 提高，空格释放，E 回屋。');
    status.textContent=mode==='room'?'回到暖暖的小屋。按住小球的任意部位，慢慢拉一拉。':'来到庄园。可以抓起整只小球，再松手把它抛出去。';
    const toggle=document.querySelector('[data-world-toggle]');if(toggle)toggle.textContent=mode==='room'?'去庄园':'回小屋';
  }
  for(const type of ['pointerdown','pointermove','wheel','keydown'])listen(document,type,activity,{capture:true,passive:true});
  listen(window,'blur',activity);listen(document,'visibilitychange',activity);
  door.userData.activate=()=>setMode('room');
  function resize(){room.resize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  function readRay(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,currentCamera());return ray;}
  function pick(e){readRay(e);return ray.intersectObjects([...currentTargets(),...parts,...(mode==='garden'?[land]:[])],false)[0];}
  function makePlane(point){currentCamera().getWorldDirection(direction);return new T.Plane().setFromNormalAndCoplanarPoint(direction,point);}
  function releaseCapture(g){if(g?.id!=null&&canvas.hasPointerCapture(g.id))canvas.releasePointerCapture(g.id);canvas.style.cursor='grab';}
  function cancel(){
    kickAge=1;
    const g=gesture;gesture=null;releaseCapture(g);
    if(g?.kind==='stretch'){elastic.reset();soft.reset();}
    if(g?.kind==='lift')flight.launch(pet.position.toArray(),[0,0,0]);
  }
  function finish(cancelled=false){
    if(cancelled){cancel();return;}
    const g=gesture;if(!g)return;gesture=null;releaseCapture(g);
    if(g.kind==='stretch'){
      const peak=elastic.release();
      if(temper.release(peak,now())){const angry=temper.tugs.length>=3;status.textContent=angry?'哼！已经被弹疼三次了，小球生气地眯起了眼睛。':'哎哟！拉得有点长，松手弹疼了。';onHurt(angry);}
      else {temper.soothe(now());perform('pet');}
    } else if(g.kind==='lift'){
      const velocity=throwVelocity(g.samples,now());flight.launch(pet.position.toArray(),velocity);target.set(pet.position.x,0,pet.position.z);
      status.textContent=Math.hypot(...velocity)>1?'小球被抛了出去，落地后会弹几下。':'轻轻松手，小球落回草地。';
    }
  }
  function record(g){const time=now();g.samples.push({time,position:pet.position.toArray()});g.samples=g.samples.filter(s=>time-s.time<=.16);}
  function dragTo(e){
    const g=gesture;if(!g||g.id!==e.pointerId)return;
    if(g.kind==='stretch'||g.kind==='lift'){
      readRay(e);if(!ray.ray.intersectPlane(g.plane,planePoint))return;
      if(g.kind==='stretch'){
        const local=pet.worldToLocal(planePoint.clone());elastic.move(local.sub(g.anchor).toArray());
      } else {
        const desired=g.origin.clone().add(planePoint.clone().sub(g.start));
        desired.x=T.MathUtils.clamp(desired.x,-10,10);desired.z=T.MathUtils.clamp(desired.z,-7,7);
        if(!walkable(desired.x,desired.z)){desired.x=pet.position.x;desired.z=pet.position.z;}
        desired.y=T.MathUtils.clamp(desired.y,height(desired.x,desired.z)+.12,7);
        pet.position.copy(desired);record(g);
      }
    } else if(g.kind==='orbit'&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>7){
      if(mode==='room')indoorYaw=g.yaw+(e.clientX-g.x)*.008;else yaw=g.yaw+(e.clientX-g.x)*.004;
    }
  }
  listen(canvas,'pointerdown',e=>{
    if(gesture||e.isPrimary===false||![0,1,2].includes(e.button))return;
    e.preventDefault();canvas.focus({preventScroll:true});
    const hit=pick(e);const g={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:mode==='room'?indoorYaw:yaw};
    if(e.button===0&&hit?.object.userData.role){
      kickAge=1;flight.reset();target.set(pet.position.x,0,pet.position.z);
      const local=pet.worldToLocal(hit.point.clone());g.anchor=local;g.start=hit.point.clone();g.plane=makePlane(hit.point);g.origin=pet.position.clone();
      if(mode==='room'){soft.begin(local,hit.object.userData.role);elastic.begin();g.kind='stretch';}
      else{g.kind='lift';g.samples=[];record(g);}
      canvas.style.cursor='grabbing';
    }else if(e.button===0&&hit?.object.userData.activate){g.kind='click';g.activate=hit.object.userData.activate;}
    else{g.kind='orbit';g.hit=hit;}
    gesture=g;canvas.setPointerCapture(e.pointerId);
  });
  listen(canvas,'pointermove',e=>{if(gesture)dragTo(e);});
  listen(canvas,'pointerup',e=>{
    const g=gesture;if(!g||g.id!==e.pointerId)return;
    if(g.kind==='stretch'||g.kind==='lift'){dragTo(e);finish();return;}
    gesture=null;releaseCapture(g);
    if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>7)return;
    if(g.kind==='click')g.activate();
    else if(mode==='garden'&&g.hit?.object===land){
      flight.reset();target.set(T.MathUtils.clamp(g.hit.point.x,-10,10),0,T.MathUtils.clamp(g.hit.point.z,-7,7));
    }
  });
  listen(canvas,'pointercancel',e=>{if(gesture?.id===e.pointerId)cancel();});
  listen(canvas,'lostpointercapture',e=>{if(gesture?.id===e.pointerId)cancel();});
  listen(canvas,'contextmenu',e=>e.preventDefault());
  listen(canvas,'wheel',e=>{e.preventDefault();if(mode==='garden')zoom=T.MathUtils.clamp(zoom+e.deltaY*.0005,.8,1.35);},{passive:false});
  function keyboardGrab(){
    if(gesture){finish();return;}kickAge=1;flight.reset();
    if(mode==='room'){const point=new T.Vector3(0,1.35,1.3);soft.begin(point,'body');elastic.begin();gesture={kind:'stretch',keyboard:true};}
    else{pet.position.y=Math.max(pet.position.y,height(pet.position.x,pet.position.z)+1.2);gesture={kind:'lift',keyboard:true,samples:[]};record(gesture);}
  }
  listen(canvas,'keydown',e=>{
    const key=e.key.toLowerCase();
    if(key==='escape'){e.preventDefault();cancel();return;}
    if(key==='e'){e.preventDefault();setMode(mode==='room'?'garden':'room');return;}
    if(key==='g'){e.preventDefault();if(!e.repeat)keyboardGrab();return;}
    if(e.code==='Space'){e.preventDefault();if(gesture?.keyboard)finish();else {temper.soothe(now());perform(mode==='room'?'pet':'play');}return;}
    if(e.key==='Home'){e.preventDefault();roomPosition.set(0,.025,.1);roomTarget.copy(roomPosition);cancel();elastic.reset();soft.reset();flight.reset();indoorYaw=yaw=0;zoom=1;target.set(0,0,1);pet.position.set(0,mode==='room'?.025:height(0,1),mode==='room'?.1:1);return;}
    const dirs={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,1],s:[0,-1],a:[-1,0],d:[1,0]};
    const dir=dirs[e.key]||dirs[key];
    if(gesture?.keyboard){
      if(dir){e.preventDefault();if(mode==='room')elastic.move(elastic.target.map((v,i)=>v+(i===0?dir[0]*.2:i===1?dir[1]*.2:0)));
        else{const nx=T.MathUtils.clamp(pet.position.x+dir[0]*.35,-10,10),nz=T.MathUtils.clamp(pet.position.z-dir[1]*.35,-7,7);if(walkable(nx,nz)){pet.position.x=nx;pet.position.z=nz;record(gesture);}}}
      if(mode==='garden'&&['PageUp','PageDown'].includes(e.key)){e.preventDefault();pet.position.y=T.MathUtils.clamp(pet.position.y+(e.key==='PageUp'?.4:-.4),height(pet.position.x,pet.position.z)+.12,7);record(gesture);}
      return;
    }
    if(dir){e.preventDefault();if(mode==='room')indoorYaw+=dir[0]*.2;else{flight.reset();const x=T.MathUtils.clamp(target.x+dir[0]*.6,-10,10),z=T.MathUtils.clamp(target.z-dir[1]*.6,-7,7);target.set(x,0,z);}}
  });
  listen(window,'blur',cancel);listen(document,'visibilitychange',()=>{if(document.hidden)cancel();});
  listen(window,'resize',()=>{cancel();resize();});
  const toggle=document.querySelector('[data-world-toggle]');if(toggle)listen(toggle,'click',()=>setMode(mode==='room'?'garden':'room'));
  const grabButton=document.querySelector('[data-grab]');if(grabButton)listen(grabButton,'click',()=>{canvas.focus();keyboardGrab();});
  function update(dt,time){
    if(disposed)return;chooseWalk(time);const emotion=temper.get(time);elastic.step(dt,reduced.matches);
    if(elastic.impact&&mode==='room'){
      kickAge=0;kickStrength=Math.min(1,Math.hypot(...elastic.recoil)/1.05);
      kickDirection.fromArray(elastic.recoil).multiplyScalar(-1).normalize();
      popAge=0;popStrength=Math.min(1,elastic.peak/1.5);pet.updateMatrixWorld(true);
      pop.position.copy(pet.localToWorld(soft.anchor));pop.position.addScaledVector(room.camera.position.clone().sub(pop.position).normalize(),.09);
      pop.quaternion.copy(room.camera.quaternion);
    }
    popAge+=dt;pop.visible=mode==='room'&&popAge<.55;
    if(pop.visible){
      const t=popAge/.55;sparkMaterial.opacity=1-T.MathUtils.smoothstep(t,.25,1);
      pop.children.forEach((m,i)=>{const a=i*Math.PI/4+.2,r=(.09+(reduced.matches?0:t)*.43)*(.75+popStrength*.25);m.position.set(Math.cos(a)*r,Math.sin(a)*r,0);m.scale.setScalar((.055+popStrength*.035)*(1-t*.45));m.rotation.z=a+t;});
    }
    const changed=soft.update(elastic.position,emotion,time,reduced.matches,dt,elastic.held);
    if(mode==='room'){
      if(wandering){roomPosition.lerp(roomTarget,Math.min(1,dt*.8));renderer.shadowMap.needsUpdate=true;}
      kickAge+=dt;const t=kickAge/(reduced.matches?.16:.13);
      const kick=kickAge>.95?0:kickStrength*t*Math.exp(1-t)*(reduced.matches?.4:1);
      kickWorld.copy(kickDirection).applyAxisAngle(upAxis,indoorYaw);
      pet.position.set(roomPosition.x+kickWorld.x*kick*.12,.025,roomPosition.z+kickWorld.z*kick*.08);
      const lean=elastic.held&&!reduced.matches;
      leanX=T.MathUtils.lerp(leanX,lean?T.MathUtils.clamp(elastic.target[2]*.055,-.065,.065):0,1-Math.exp(-dt*12));
      leanZ=T.MathUtils.lerp(leanZ,lean?T.MathUtils.clamp(-elastic.target[0]*.055,-.065,.065):0,1-Math.exp(-dt*12));
      pet.rotation.set(leanX+kickDirection.z*kick*.085,indoorYaw,leanZ-kickDirection.x*kick*.11);
      // One grounded startle: compress, straighten, then settle without oscillation.
      // The model's sole is at local y=0, so scaling never lifts its base.
      const ease=(a,b)=>T.MathUtils.smoothstep(kickAge,a,b);
      const startle=kickAge<.055?-.055*ease(0,.055):kickAge<.16?T.MathUtils.lerp(-.055,.14,ease(.055,.16)):.14*(1-ease(.16,.56));
      const sy=1+startle*kickStrength*(reduced.matches?.35:1)+(reduced.matches?0:Math.sin(time*2)*.003);
      const sx=1/Math.sqrt(sy);pet.scale.set(sx,sy,sx);
      const surprise=Math.max(0,startle)/.14*kickStrength*(reduced.matches?.35:1);
      for(const eye of soft.eyes)eye.scale.y=T.MathUtils.lerp(eye.scale.y,1.08,surprise);
      if(changed||elastic.active||kickAge<1||Math.abs(leanX)+Math.abs(leanZ)>.0001||emotion!==lastRenderEmotion)renderer.shadowMap.needsUpdate=true;
    }else{
      const held=gesture?.kind==='lift';
      if(held||flight.active){walker.stop([pet.position.x,pet.position.z]);requested.set(Infinity,Infinity);}
      if(held){pet.rotation.z=T.MathUtils.lerp(pet.rotation.z,T.MathUtils.clamp(-(pet.position.x-(gesture.origin?.x??pet.position.x))*.025,-.07,.07),1-Math.exp(-dt*10));}
      if(flight.active){const hit=flight.step(dt,height,walkable);if(hit>.4)impactSpeed+=Math.min(4,hit*.48);pet.position.fromArray(flight.position);pet.rotation.z+=flight.velocity[0]*dt*.12;target.set(pet.position.x,0,pet.position.z);}
      else if(!held){
        if(target.x!==requested.x||target.z!==requested.y){
          const goal=walker.go([pet.position.x,pet.position.z],[target.x,target.z],pet.rotation.y);
          target.set(goal[0],0,goal[1]);requested.set(target.x,target.z);
        }
        const wasMoving=walker.active;
        walker.step(dt,wandering?.82:1.35);
        pet.position.x=walker.position[0];pet.position.z=walker.position[1];pet.rotation.y=walker.yaw;
        pet.rotation.z*=Math.exp(-dt*10);
        pet.position.y=height(pet.position.x,pet.position.z)+(reduced.matches?0:Math.abs(Math.sin(walker.travel*8))*.035*Math.min(1,walker.speed));
        if(wasMoving)renderer.shadowMap.needsUpdate=true;
      }
      for(let i=0;i<4;i++){impactSpeed+=(-impact*110-impactSpeed*(reduced.matches?25:7))*dt/4;impact+=impactSpeed*dt/4;}
      impact=T.MathUtils.clamp(impact,-.2,.34);
      const stretch=held?.065:flight.active?T.MathUtils.clamp(Math.abs(flight.velocity[1])*.013,0,.11):0;
      const sy=1-impact+(reduced.matches?0:stretch),sx=1/Math.sqrt(sy);
      pet.scale.set(.55*sx,.55*sy,.55*sx);
      if(held||flight.active||Math.abs(impact)>.001)renderer.shadowMap.needsUpdate=true;
      const distance=Math.max(21,18/camera.aspect)*zoom;
      camera.position.set(Math.sin(yaw)*distance,distance*.7,Math.cos(yaw)*distance);camera.lookAt(0,.2,0);scene.fog.near=camera.position.length()+7;scene.fog.far=camera.position.length()+42;
    }
    lastRenderEmotion=emotion;
  }
  const project=p=>{const v=p.clone().project(currentCamera());return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};};
  function diagnostics(){
    pet.updateMatrixWorld(true);
    return {mode,recoilFeedback:{age:kickAge,strength:kickStrength,scale:pet.scale.toArray()},navigation:{active:walker.active,speed:walker.speed,path:walker.path.map(p=>[...p]),target:[target.x,target.z]},lean:{x:pet.rotation.x,z:pet.rotation.z},reboundFlash:pop.visible,wandering,idleRemaining:Math.max(0,idleUntil-now()),emotion:temper.get(now()),tugs:temper.tugs.length,held:gesture?.kind||null,deformation:soft.deformation,pull:[...elastic.position],flight:{active:flight.active,velocity:[...flight.velocity]},pet:{x:pet.position.x,y:pet.position.y,z:pet.position.z},petPoints:[[0,1.3,1.3],[-1.1,1.2,1.0],[0,2.25,.65]].map(p=>project(pet.localToWorld(new T.Vector3(...p)))),targets:currentTargets().map(o=>({...project(o.getWorldPosition(new T.Vector3())),kind:o===door||room.targets.slice(0,4).includes(o)?'door':'action'}))};
  }
  setMode('room');
  return {update,diagnostics,resize,cancel,room,get scene(){return mode==='room'?room.scene:scene;},get camera(){return currentCamera();},get mode(){return mode;},dispose(){disposed=true;cancel();listeners.forEach(fn=>fn());const gs=new Set(),ms=new Set();room.scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>{m.map?.dispose();m.dispose();});}};
}
