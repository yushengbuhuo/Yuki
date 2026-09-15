// Small deterministic solvers shared by the scene and Node tests.
// Transient deformation/emotion never changes the versioned save schema.
export class ElasticPull {
  constructor(){this.position=[0,0,0];this.velocity=[0,0,0];this.target=[0,0,0];this.held=false;this.peak=0;this.recoil=[0,0,0];this.crossed=false;this.impact=false;this.releaseAge=0;}
  begin(){this.reset();this.held=true;}
  move(value){const length=Math.hypot(...value),stretch=1.3*(1-Math.exp(-length/1.3)),scale=stretch/(length||1);this.target=value.map(v=>v*scale);this.peak=Math.max(this.peak,Math.min(2.2,length));}
  release(){this.held=false;this.recoil=[...this.position];this.crossed=false;this.releaseAge=0;const speed=Math.hypot(...this.velocity);if(speed>8)this.velocity=this.velocity.map(v=>v*8/speed);return this.peak;}
  reset(){this.crossed=false;this.impact=false;this.releaseAge=0;this.recoil?.fill(0);this.held=false;this.peak=0;this.position.fill(0);this.velocity.fill(0);this.target.fill(0);}
  step(dt,reduced=false){
    dt=Math.min(Math.max(dt,0),.06);const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
    this.impact=false;
    for(let j=0;j<steps;j++){
      if(!this.held)this.releaseAge+=h;
      const k=this.held?580:reduced?230:this.crossed?440:560;
      const damping=this.held?42:reduced?36:this.crossed?(this.releaseAge<.24?18:34):7;
      for(let i=0;i<3;i++){
        const goal=this.held?this.target[i]:0;
        this.velocity[i]+=((goal-this.position[i])*k-this.velocity[i]*damping)*h;this.position[i]+=this.velocity[i]*h;
      }
      if(!this.held&&!this.crossed&&Math.hypot(...this.recoil)>.08&&(this.position.reduce((v,p,i)=>v+p*this.recoil[i],0)<=0||(reduced&&Math.hypot(...this.position)<.02))){this.crossed=true;this.impact=true;}
    }
    if(!this.held&&Math.hypot(...this.position)<.001&&Math.hypot(...this.velocity)<.012){this.position.fill(0);this.velocity.fill(0);}
    return this.position;
  }
  get active(){return this.held||Math.hypot(...this.position)>0;}
}
export class Temper {
  constructor(){this.tugs=[];this.hurtUntil=0;this.angryUntil=0;}
  release(stretch,now){if(stretch<.9)return false;this.tugs=this.tugs.filter(t=>now-t<18);this.tugs.push(now);this.hurtUntil=now+.65;if(this.tugs.length>=3)this.angryUntil=now+14;return true;}
  soothe(now){this.tugs.pop();this.angryUntil=Math.max(now,this.angryUntil-5);this.hurtUntil=now;}
  get(now){if(now<this.hurtUntil)return 'hurt';if(now<this.angryUntil)return 'angry';return 'calm';}
}
export function throwVelocity(samples,now){
  if(samples.length<2||now-samples.at(-1).time>.12)return [0,0,0];
  const recent=samples.filter(s=>now-s.time<=.12);if(recent.length<2)return [0,0,0];
  const a=recent[0],b=recent.at(-1),dt=Math.max(.016,b.time-a.time);
  const v=b.position.map((p,i)=>(p-a.position[i])/dt),speed=Math.hypot(...v);
  return v.map(n=>n*Math.min(1,11/(speed||1)));
}
export class BallFlight {
  constructor(){this.position=[0,0,0];this.velocity=[0,0,0];this.active=false;}
  launch(position,velocity){this.position=[...position];const speed=Math.hypot(...velocity);this.velocity=velocity.map(v=>v*Math.min(1,11/(speed||1)));this.active=true;}
  reset(){this.active=false;this.velocity.fill(0);}
  step(dt,ground,walkable){
    let impact=0;const steps=Math.max(1,Math.ceil(Math.min(dt,.06)*120)),h=Math.min(dt,.06)/steps;
    for(let i=0;i<steps&&this.active;i++){
      this.velocity[1]-=9.8*h;
      for(const axis of [0,2]){
        const p=[...this.position];p[axis]+=this.velocity[axis]*h;
        if(Math.abs(p[0])>10||p[2]<-7||p[2]>7||!walkable(p[0],p[2]))this.velocity[axis]*=-.42;
        else this.position[axis]=p[axis];
      }
      this.position[1]+=this.velocity[1]*h;const floor=ground(this.position[0],this.position[2]);
      if(this.position[1]<=floor){this.position[1]=floor;impact=Math.max(impact,-this.velocity[1]);this.velocity[1]=Math.max(0,-this.velocity[1]*.38);this.velocity[0]*=.78;this.velocity[2]*=.78;
        if(this.velocity[1]<.4&&Math.hypot(this.velocity[0],this.velocity[2])<.3)this.reset();}
    }
    return impact;
  }
}
