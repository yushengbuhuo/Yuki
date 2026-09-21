const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const length=(x,z)=>Math.hypot(x,z);
const route=[[-34,-12],[-17,-9],[-10,-6],[-9.6,-.8],[-5.8,1.5]];
const exitRoute=[[-5.8,1.5],[-3.8,5.6],[1,6.2],[8,6.2],[15,7],[34,10]];
const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function createFlock({count=10,walkable=()=>true}={}){
  let seed=809;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const leader={x:route[0][0],z:route[0][1],yaw:0,speed:0,travel:0};
  const sheep=Array.from({length:count},(_,i)=>({x:leader.x-(i%3)*.8,z:leader.z-Math.floor(i/3)*.8,vx:0,vz:0,yaw:0,travel:0,state:'follow',timer:0,cooldown:0,fear:0,shy:.25+random()*.75,seed:random()*10,goal:[-5.7+random()*3,-.1+random()*4.5]}));
  let stage='absent',waypoint=1,served=false,previousDay=false,accumulator=0,clock=0,visits=0,invitedUntil=0;
  function safe(x,z){return walkable(x,z)&&walkable(x+.24,z)&&walkable(x-.24,z)&&walkable(x,z+.24)&&walkable(x,z-.24);}
  function reset(){leader.x=route[0][0];leader.z=route[0][1];leader.speed=0;waypoint=1;for(let i=0;i<count;i++){const s=sheep[i];s.x=leader.x-(i%3)*.8;s.z=leader.z-Math.floor(i/3)*.8;s.vx=s.vz=0;s.state='follow';s.fear=s.cooldown=0;}}
  function goalFor(s){for(let k=0;k<20;k++){const x=-6.5+random()*4,z=-.5+random()*5;if(safe(x,z)){s.goal=[x,z];return;}}s.goal=[s.x,s.z];}
  function step(dt,phase,pet){
    clock+=dt;const day=phase>=0&&phase<2.35;
    if(day&&!previousDay)served=false;previousDay=day;
    if(stage==='absent'&&day&&!served){reset();stage='arriving';served=true;visits++;}
    if(stage==='absent')return;
    if(!day&&clock>=invitedUntil&&stage!=='leaving'){stage='leaving';waypoint=leader.x<-9?0:1;}
    let goal=(stage==='leaving'?exitRoute:route)[waypoint],moving=stage==='arriving'||stage==='leaving';
    if(moving){
      const dx=goal[0]-leader.x,dz=goal[1]-leader.z,d=length(dx,dz);
      // A shepherd waits for stragglers rather than abandoning the flock.
      const lag=Math.max(...sheep.map(s=>length(s.x-leader.x,s.z-leader.z)));
      leader.speed=lag>5?.18:.85;
      if(d<.2){
        if(stage==='arriving'){if(waypoint<route.length-1)waypoint++;else{stage='grazing';leader.speed=0;for(const s of sheep){s.state='wander';goalFor(s);}}}
        else if(waypoint<exitRoute.length-1)waypoint++;else if(sheep.every(s=>s.x>29)){stage='absent';leader.speed=0;return;}
      }else{const travel=Math.min(d,leader.speed*dt);const nx=leader.x+dx/d*travel,nz=leader.z+dz/d*travel;
        if(!pet||length(nx-pet.x,nz-pet.z)>1.2){leader.x=nx;leader.z=nz;}else leader.speed=0;leader.travel+=travel;leader.yaw+=angle(leader.yaw,Math.atan2(dx,dz))*Math.min(1,dt*4);}
    }else leader.speed=0;
    // Snapshot reactions: panic spreads locally, never cascades across an entire frame.
    const neighbors=sheep.map(s=>({x:s.x,z:s.z,fear:s.fear}));
    for(let i=0;i<count;i++){
      const s=sheep[i];s.cooldown=Math.max(0,s.cooldown-dt);s.timer=Math.max(0,s.timer-dt);s.fear=Math.max(0,s.fear-dt*.35);
      const dx=pet? s.x-pet.x:100,dz=pet?s.z-pet.z:100,d=length(dx,dz);
      const alarm=neighbors.some((n,j)=>j!==i&&n.fear>.75&&length(n.x-s.x,n.z-s.z)<1.1);
      if(d<1.0+s.shy*.65&&s.cooldown===0&&s.state!=='flee'&&s.state!=='watch'){
        s.state=s.shy>.55?'flee':'watch';s.timer=s.state==='watch'?.5+s.seed*.06:1.6;s.fear=s.state==='flee'?1:.35;s.cooldown=4;
      }else if(alarm&&s.cooldown===0&&s.shy>.5){s.state='watch';s.timer=.55;s.cooldown=3;}
      if(s.state==='watch'&&s.timer===0){s.state=d<2?'flee':'wander';s.timer=1.25;s.fear=d<2?.8:0;}
      if(s.state==='flee'&&s.timer===0&&d>1.5){s.state='wander';goalFor(s);s.cooldown=4;}
      if(s.state==='graze'&&s.timer===0){s.state='wander';goalFor(s);}
      if(stage==='leaving'&&s.state!=='flee'&&s.state!=='watch')s.state='follow';
      let tx=0,tz=0,pace=.5;
      if(s.state==='flee'){tx=dx/(d||1);tz=dz/(d||1);if(!pet){tx=Math.sin(s.seed);tz=Math.cos(s.seed);}pace=1.15+s.shy*.5;}
      else if(s.state==='watch'||s.state==='graze'){pace=0;if(s.state==='watch'&&pet)s.yaw+=angle(s.yaw,Math.atan2(-dx,-dz))*dt*3;}
      else{
        const following=stage!=='grazing';
        const g=following?[leader.x-Math.sin(leader.yaw)*(1+(i%3)*.5)+Math.cos(leader.yaw)*((i%3)-1)*.6,leader.z-Math.cos(leader.yaw)*(1+(i%3)*.5)-Math.sin(leader.yaw)*((i%3)-1)*.6]:s.goal;
        tx=g[0]-s.x;tz=g[1]-s.z;const distance=length(tx,tz);
        if(!following&&distance<.25){s.state='graze';s.timer=3+random()*7;pace=0;}
        else{tx/=distance||1;tz/=distance||1;pace=following?clamp(distance*.65,.1,1.15):.48;}
      }
      let sx=0,sz=0,ax=0,az=0,n=0;
      if(pet&&d<1.65&&d>.001){sx+=dx/d*(1.65-d)*3;sz+=dz/d*(1.65-d)*3;}
      const lx=s.x-leader.x,lz=s.z-leader.z,ld=length(lx,lz);if(ld<.9&&ld>.001){sx+=lx/ld*(.9-ld)*3;sz+=lz/ld*(.9-ld)*3;}
      for(let j=0;j<count;j++){if(i===j)continue;const other=sheep[j],ox=s.x-other.x,oz=s.z-other.z,dist=length(ox,oz);
        if(dist<.95&&dist>.001){sx+=ox/dist*(.95-dist)*2.5;sz+=oz/dist*(.95-dist)*2.5;}
        if(dist<2.2){ax+=other.vx;az+=other.vz;n++;}
      }
      if(pace>0){tx=tx*pace+sx+(stage!=='grazing'&&n?ax/n*.12:0);tz=tz*pace+sz+(stage!=='grazing'&&n?az/n*.12:0);}
      else {tx=sx*.35;tz=sz*.35;}
      const speed=length(tx,tz);if(speed>1.7){tx*=1.7/speed;tz*=1.7/speed;}
      s.vx+=(tx-s.vx)*Math.min(1,dt*5);s.vz+=(tz-s.vz)*Math.min(1,dt*5);
      let nx=s.x+s.vx*dt,nz=s.z+s.vz*dt;
      if(!safe(nx,nz)){
        // Slide along obstacles; try tangents instead of walking through the pond.
        let found=false;for(const turn of [.7,-.7,1.4,-1.4,2.1,-2.1]){const vx=s.vx*Math.cos(turn)-s.vz*Math.sin(turn),vz=s.vx*Math.sin(turn)+s.vz*Math.cos(turn);if(safe(s.x+vx*dt*3,s.z+vz*dt*3)){nx=s.x+vx*dt;nz=s.z+vz*dt;s.vx=vx;s.vz=vz;found=true;break;}}
        if(!found){nx=s.x;nz=s.z;s.vx=s.vz=0;if(stage==='grazing')goalFor(s);}
      }
      s.x=nx;s.z=nz;const velocity=length(s.vx,s.vz);s.travel+=velocity*dt;if(velocity>.06)s.yaw+=angle(s.yaw,Math.atan2(s.vx,s.vz))*Math.min(1,dt*5);
    }
  }
  return {sheep,leader,invite(){
    if(stage==='arriving'||stage==='grazing')return stage;
    invitedUntil=clock+180;
    if(stage==='absent'){reset();served=true;visits++;}else {invitedUntil=clock;return 'leaving';}
    stage='arriving';return 'invited';
  },update(dt,phase,pet){accumulator+=Math.min(dt,.1);while(accumulator>=1/30){step(1/30,phase,pet);accumulator-=1/30;}},get stage(){return stage;},diagnostics(){return {stage,visits,leader:{x:leader.x,z:leader.z},sheep:sheep.map(s=>({x:s.x,z:s.z,state:s.state,shy:s.shy}))};}};
}
