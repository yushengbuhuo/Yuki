// Bottom-pivot squash/stretch: shared by rigid props and unrigged animals.
// Fixed substeps keep spring response stable at both 30 and 60 FPS.
export class JellyMotion {
  constructor(seed=0){this.seed=seed;this.compression=0;this.velocity=0;this.travel=seed;this.speed=0;this.pulses=0;}
  reset(){this.compression=this.velocity=this.speed=0;}
  poke(strength=1){this.velocity+=Math.min(1.5,Math.max(0,strength))*3.8;this.pulses++;}
  step(dt,time,{speed=0,strength=1,reduced=false,idle=false,hop=false}={}){
    const h=Math.min(.06,Math.max(0,dt)),steps=Math.max(1,Math.ceil(h*120)),sub=h/steps;
    if(reduced||strength===0){this.compression=this.velocity=0;this.speed=0;return {y:1,radial:1,hop:0,lean:0};}
    this.speed+=(speed-this.speed)*(1-Math.exp(-h*10));this.travel+=this.speed*h;
    for(let i=0;i<steps;i++){this.velocity+=(-145*this.compression-11*this.velocity)*sub;this.compression+=this.velocity*sub;}
    if(Math.abs(this.compression)<.0001&&Math.abs(this.velocity)<.001)this.compression=this.velocity=0;
    const moving=Math.min(1,this.speed*1.8),phase=this.travel*(hop?13:11);
    const gait=Math.cos(phase)*.065*moving,breath=idle?Math.sin(time*1.8+this.seed)*.012:0;
    const y=Math.max(.68,Math.min(1.35,1+strength*(gait+breath-this.compression)));
    return {y,radial:1/Math.sqrt(y),hop:hop?Math.max(0,Math.sin(phase))*.13*moving*strength:Math.abs(Math.sin(phase))*.022*moving*strength,lean:Math.sin(phase*.5)*.045*moving*strength};
  }
}
