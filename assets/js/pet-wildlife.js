import * as T from '../vendor/three/package/build/three.module.js';
import {createFlock} from './pet-flock.mjs';
import {softShadow} from './pet-art.js';
export function createWildlife({scene,height,walkable,mobile,renderer}){
 const flock=createFlock({count:mobile?7:10,walkable}),count=flock.sheep.length;
 const herd=new T.Group();herd.name='visiting-flock';scene.add(herd);
 const wool=new T.MeshLambertMaterial({color:'#eee3cf'}),dark=new T.MeshLambertMaterial({color:'#776957'}),eye=new T.MeshBasicMaterial({color:'#252a28'});
 const sphere=new T.SphereGeometry(1,12,8),parts=[];
 function instances(mat,n){const m=new T.InstancedMesh(sphere,mat,n);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.receiveShadow=true;herd.add(m);parts.push(m);return m;}
 const bodies=instances(wool,count),heads=instances(dark,count),ears=instances(dark,count*2),legs=instances(dark,count*4);
 const dummy=new T.Object3D(),matrix=new T.Matrix4(),root=new T.Object3D();
 const renderPos=flock.sheep.map(s=>new T.Vector3(s.x,0,s.z)),headBend=new Float32Array(count),renderYaw=new Float32Array(count),gait=new Float32Array(count),renderSpeed=new Float32Array(count);
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
 const bird=new T.Group();scene.add(bird);const birdMat=new T.MeshLambertMaterial({color:'#879b9a'}),breast=new T.MeshLambertMaterial({color:'#d9b99b'}),beak=new T.MeshLambertMaterial({color:'#a58b55'});
 mesh(sphere,birdMat,[0,.13,0],[.15,.17,.23],bird);mesh(sphere,breast,[0,.12,.12],[.12,.13,.12],bird);mesh(sphere,birdMat,[0,.29,.12],[.12,.12,.13],bird);
 mesh(new T.ConeGeometry(.043,.12,6),beak,[0,.28,.27],[1,1,1],bird).rotation.x=Math.PI/2;
 for(const x of [-.085,.085])mesh(sphere,eye,[x,.32,.205],[.022,.025,.022],bird);
 const wings=[mesh(sphere,birdMat,[-.15,.15,-.02],[.035,.13,.2],bird),mesh(sphere,birdMat,[.15,.15,-.02],[.035,.13,.2],bird)];
 mesh(sphere,birdMat,[0,.18,-.23],[.05,.05,.15],bird).rotation.x=-.4;
 const butterfly=new T.Group();scene.add(butterfly);const wingMat=new T.MeshLambertMaterial({color:'#eadbb9',side:T.DoubleSide});
 const butterflyWings=[mesh(new T.CircleGeometry(.1,8),wingMat,[-.08,0,0],[1,1.4,1],butterfly),mesh(new T.CircleGeometry(.1,8),wingMat,[.08,0,0],[1,1.4,1],butterfly)];
 const birdPosition=new T.Vector3();let bell=0,bleat=0,shadowClock=0;
 function depart(){birdState='depart';birdAge=0;birdStart.copy(bird.position);birdEnd.set(17,7,-5);}
 function update(dt,time,phase,pet,mode,reduced){
  lastPhase=phase;night=phase>=3||phase<.05?1:phase>2?(phase-2):0;
  flock.update(dt,phase,mode==='garden'?pet.position:null);herd.visible=flock.stage!=='absent';
  if(herd.visible){
   for(let i=0;i<count;i++){const s=flock.sheep[i],speed=Math.hypot(s.vx,s.vz),graze=s.state==='graze',pos=renderPos[i];
    // Reset only while far outside the estate, never teleport a visible sheep.
    if(Math.abs(pos.x-s.x)>15)pos.set(s.x,height(s.x,s.z),s.z);else pos.lerp(new T.Vector3(s.x,height(s.x,s.z),s.z),1-Math.exp(-dt*14));
    renderYaw[i]+=Math.atan2(Math.sin(s.yaw-renderYaw[i]),Math.cos(s.yaw-renderYaw[i]))*(1-Math.exp(-dt*9));renderSpeed[i]+=(speed-renderSpeed[i])*(1-Math.exp(-dt*8));gait[i]+=renderSpeed[i]*dt;
    root.position.copy(pos);root.rotation.set(0,renderYaw[i],0);root.scale.setScalar(.83+(i%3)*.055);root.updateMatrix();
    const bob=reduced?0:Math.sin(gait[i]*10)*Math.min(.016,renderSpeed[i]*.025);
    at(bodies,i,0,.58+bob,0,.39,.34,.53);
    
    headBend[i]+=(Number(graze)-headBend[i])*(1-Math.exp(-dt*5));const bend=headBend[i],chew=graze&&!reduced?Math.sin(time*5+s.seed)*.008:0;
    const hy=.72-bend*.45+chew,hz=.47+bend*.1;
    at(heads,i,0,hy+bob,hz,.145,.19,.22,bend*.7);
    for(let k=0;k<2;k++)at(ears,i*2+k,k?-.16:.16,hy-.065,hz-.02,.055,.145,.065,-.2);
    for(let k=0;k<4;k++){const phase=k===0||k===3?0:Math.PI,swing=reduced?0:Math.sin(gait[i]*10+phase)*Math.min(.3,renderSpeed[i]*.3);at(legs,i*4+k,k%2?-.22:.22,.22,(k<2?-.28:.28),.055,.24,.065,swing);}
    shadows[i].position.set(pos.x,pos.y+.015,pos.z);
   }
   for(const m of parts)m.instanceMatrix.needsUpdate=true;
   const l=flock.leader;shepherd.position.lerp(new T.Vector3(l.x,height(l.x,l.z),l.z),1-Math.exp(-dt*12));if(Math.abs(shepherd.position.x-l.x)>15)shepherd.position.set(l.x,height(l.x,l.z),l.z);shepherd.rotation.y+=Math.atan2(Math.sin(l.yaw-shepherd.rotation.y),Math.cos(l.yaw-shepherd.rotation.y))*(1-Math.exp(-dt*8));
   boots.forEach((b,i)=>b.rotation.x=reduced?0:Math.sin(l.travel*10+i*Math.PI)*Math.min(.35,l.speed*.5));
  }
  birdAge+=dt;birdWait-=dt;
  if(birdState==='away'){bird.visible=false;if(phase<2.8&&birdWait<=0){birdState='arrive';birdHops=0;birdAge=0;birdStart.set(-17,6,4);birdEnd.set(-1.7,height(-1.7,1)+.03,1);bird.visible=true;}}
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
  butterfly.visible=phase>.15&&phase<2.7;butterfly.position.set(2.5+Math.sin(time*.18)*.5,.85+Math.sin(time*.6)*.15,3.4+Math.cos(time*.24)*.35);butterflyWings.forEach((w,i)=>w.rotation.y=reduced?0:Math.sin(time*14)*(i?1:-1));
  bell+=dt;bleat+=dt;shadowClock+=dt;if(mode==='garden'&&shadowClock>.2){renderer.shadowMap.needsUpdate=true;shadowClock=0;}
 }
 return {update,flock,colliders(){return herd.visible?[...renderPos.map(p=>({x:p.x,z:p.z,y:p.y,r:.62,h:1.05})),{x:shepherd.position.x,z:shepherd.position.z,y:shepherd.position.y,r:.44,h:1.9}]:[];},get bird(){return bird.visible&&['peck','watch'].includes(birdState)?birdPosition:null;},
  audioEvents(){const result=[];if(bell>6&&herd.visible&&flock.leader.speed>.1){bell=0;result.push({kind:'bell',position:flock.leader});}if(bleat>22&&herd.visible){bleat=0;result.push({kind:'bleat',position:flock.sheep[0]});}return result;},
  diagnostics(){return {...flock.diagnostics(),bird:birdState,count,colliders:herd.visible?[...renderPos.map(p=>({x:p.x,z:p.z,y:p.y,r:.62,h:1.05})),{x:shepherd.position.x,z:shepherd.position.z,y:shepherd.position.y,r:.44,h:1.9}]:[]};}};
}
