import {createNavigator,GardenWalker} from './pet-navigation.mjs';

export function createResidents({scene,height,walkable,assetKit,hits,status}){
  const navigation=createNavigator(walkable,{clearance:.28}),definitions=[
    ['Animal_Cat_01',-1.25,3.7,.76,.55,'小花猫'],
    ['Animal_Cat_02',6.7,-4.1,.74,.48,'另一只小花猫'],
    ['Animal_Dog_01',-1.7,-.6,.88,.7,'小狗'],
    ['Animal_Rabbit_01',-5,3.6,.65,.65,'小兔子'],
    ['Animal_Rabbit_02',-6.8,.8,.62,.6,'另一只小兔子'],
    ['Animal_Sloth_01',3.3,-4.8,.8,.16,'树懒'],
    ['Animal_Chicken_01',-4.5,5.3,.67,.45,'小鸡'],
    ['Animal_Bird_01',.5,4.6,.47,.48,'小鸟']
  ];
  const animals=definitions.map(([name,x,z,size,pace,label],i)=>{
    const a=assetKit.place(name,{parent:scene,position:[x,height(x,z),z],scale:size,yaw:i*.7,idle:true,targets:hits,onActivate:()=>{status.textContent=label+'开心地晃了晃。';a.wait=2.5;a.walker.stop([a.root.position.x,a.root.position.z]);}});
    a.home=[x,z];a.walker=new GardenWalker(navigation);a.walker.stop([x,z]);a.pace=pace;a.wait=1+i*.65;a.hop=name.includes('Rabbit')||name.includes('Bird');a.radius=size*.34;a.seed=571+i*777;
    return a;
  });
  function random(a){a.seed=(a.seed*1664525+1013904223)>>>0;return a.seed/4294967296;}
  function update(dt,mode,reduced){
    if(mode!=='garden')return;
    for(const a of animals){
      if(reduced){a.speed=0;continue;}
      a.wait-=dt;
      if(!a.walker.active&&a.wait<=0){
        a.wait=3+random(a)*5;
        for(let i=0;i<6;i++){const angle=random(a)*Math.PI*2,radius=.6+random(a)*1.7,goal=[a.home[0]+Math.sin(angle)*radius,a.home[1]+Math.cos(angle)*radius];
          if(navigation.safe(...goal)){a.walker.go([a.root.position.x,a.root.position.z],goal,a.root.rotation.y);break;}}
      }
      const old=[...a.walker.position];a.walker.step(dt,a.pace);
      const [x,z]=a.walker.position;
      const obstructed=animals.some(b=>b!==a&&Math.hypot(x-b.root.position.x,z-b.root.position.z)<a.radius+b.radius+.06);
      if(obstructed){a.walker.stop(old);a.wait=1.5+random(a);}
      a.root.position.set(a.walker.position[0],height(...a.walker.position),a.walker.position[1]);a.root.rotation.y=a.walker.yaw;a.speed=a.walker.speed;
    }
  }
  return {update,colliders:()=>animals.map(a=>({x:a.root.position.x,z:a.root.position.z,y:a.root.position.y,r:a.radius,h:a.root.scale.y})),diagnostics:()=>animals.map(a=>({name:a.name,position:a.root.position.toArray(),moving:a.walker.active,speed:a.speed,walkable:navigation.safe(a.root.position.x,a.root.position.z)}))};
}
