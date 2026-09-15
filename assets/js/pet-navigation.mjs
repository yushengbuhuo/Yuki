// Small static navigation grid, built once. No scene dependency or per-frame search.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function createNavigator(walkable,{spacing=.4,clearance=.22}={}){
  const minX=-9.6,minZ=-6.4,nx=49,nz=33,total=nx*nz;
  const point=i=>[minX+(i%nx)*spacing,minZ+Math.floor(i/nx)*spacing];
  function safe(x,z){
    if(x<minX||x>9.6||z<minZ||z>6.4||!walkable(x,z))return false;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!walkable(x+Math.cos(a)*clearance,z+Math.sin(a)*clearance))return false;}
    return true;
  }
  function line(a,b,margin=true){
    const steps=Math.max(1,Math.ceil(dist(a,b)/.12)),check=margin?safe:walkable;
    for(let i=0;i<=steps;i++){const t=i/steps;if(!check(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))return false;}return true;
  }
  const free=Uint8Array.from({length:total},(_,i)=>safe(...point(i))?1:0);
  function route(start,goal){
    goal=[clamp(goal[0],minX,9.6),clamp(goal[1],minZ,6.4)];
    if(safe(...goal)&&line(start,goal))return [goal];
    let source=-1,score=Infinity;
    for(let i=0;i<total;i++)if(free[i]){const d=dist(start,point(i));if(d<score&&line(start,point(i),safe(...start))){source=i;score=d;}}
    if(source<0)return [];
    const costs=new Float64Array(total).fill(Infinity),prev=new Int32Array(total).fill(-1),closed=new Uint8Array(total),heap=[];
    const push=(id,f)=>{heap.push({id,f});let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].f<=f)break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
    const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(heap[i].f<=heap[j].f)break;[heap[i],heap[j]]=[heap[j],heap[i]];i=j;}}return first.id;};
    let nearest=source,best=dist(point(source),goal),destination=-1,d=Infinity;
    for(let i=0;i<total;i++)if(free[i]&&dist(point(i),goal)<d){destination=i;d=dist(point(i),goal);}
    costs[source]=0;push(source,best);
    while(heap.length){
      const i=pop();if(closed[i])continue;closed[i]=1;
      const p=point(i),remaining=dist(p,goal);if(remaining<best){nearest=i;best=remaining;}
      if(i===destination){nearest=i;break;}
      const x=i%nx,z=Math.floor(i/nx);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        if((!dx&&!dz)||x+dx<0||x+dx>=nx||z+dz<0||z+dz>=nz)continue;
        const j=i+dx+dz*nx;if(!free[j]||closed[j])continue;
        if(dx&&dz&&(!free[i+dx]||!free[i+dz*nx]))continue;
        if(!line(p,point(j)))continue;
        const cost=costs[i]+spacing*Math.hypot(dx,dz);
        if(cost<costs[j]){costs[j]=cost;prev[j]=i;push(j,cost+dist(point(j),goal));}
      }
    }
    const raw=[];for(let i=nearest;i!==-1;i=prev[i])raw.push(point(i));raw.reverse();
    if(safe(...goal)&&line(raw.at(-1),goal))raw.push(goal);
    const path=[];let current=start,index=0;
    while(index<raw.length){let end=index;for(let j=index;j<raw.length;j++){if(line(current,raw[j],safe(...current)))end=j;else break;}path.push(raw[end]);current=raw[end];index=end+1;}
    return path.filter((p,i)=>i>0||dist(p,start)>.03);
  }
  return {route,line,safe};
}
export class GardenWalker{
  constructor(navigation){this.nav=navigation;this.position=[0,1];this.path=[];this.speed=0;this.yaw=0;this.travel=0;}
  stop(position){this.path=[];this.speed=0;if(position)this.position=[...position];}
  go(position,goal,yaw=this.yaw){this.position=[...position];this.yaw=yaw;this.path=this.nav.route(position,goal);return this.path.at(-1)||position;}
  get active(){return this.path.length>0;}
  step(dt,pace=1.35){
    dt=clamp(dt,0,.05);
    if(!this.path.length){this.speed=0;return;}
    while(this.path.length>1&&dist(this.position,this.path[0])<.12)this.path.shift();
    // Look ahead only along collision-free shortcuts; this rounds open corners.
    if(this.path.length>1){
      const a=this.path[0],b=this.path[1],len=dist(a,b),t=Math.min(1,.55/(len||1));
      const look=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      if(dist(this.position,a)<.85&&this.nav.line(this.position,look)){this.path[0]=look;if(t===1)this.path.splice(1,1);}
    }
    const goal=this.path[0],dx=goal[0]-this.position[0],dz=goal[1]-this.position[1],distance=Math.hypot(dx,dz);
    const angle=Math.atan2(dx,dz),error=Math.atan2(Math.sin(angle-this.yaw),Math.cos(angle-this.yaw));
    this.yaw+=clamp(error,-dt*3.4,dt*3.4);
    let remaining=distance;for(let i=1;i<this.path.length;i++)remaining+=dist(this.path[i-1],this.path[i]);
    const desired=Math.min(pace,Math.sqrt(2*2.2*remaining))*Math.max(.15,Math.cos(error));
    this.speed+=clamp(desired-this.speed,-dt*3.8,dt*2.1);
    const move=Math.min(distance,this.speed*dt);
    if(distance>.0001){
      const next=[this.position[0]+dx/distance*move,this.position[1]+dz/distance*move];
      if(this.nav.line(this.position,next,this.nav.safe(...this.position))){this.position=next;this.travel+=move;}
      else{this.path=this.nav.route(this.position,this.path.at(-1));this.speed=0;return;}
    }
    if(distance-move<.025){this.position=[...goal];this.path.shift();if(!this.path.length)this.speed=0;}
  }
}
