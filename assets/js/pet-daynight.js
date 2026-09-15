import * as T from '../vendor/three/package/build/three.module.js';

// Art-directed stops spend equal time in each mood, including the short blue hour.
const stops=[
  {name:'清晨',sky:'#e8cbbb',light:'#ffe4c1',ground:'#91a4aa',tint:'#dbcbb3',ambient:2.2,sun:1.5,night:0,x:-12,y:7},
  {name:'午后',sky:'#dce8db',light:'#ffead0',ground:'#799b91',tint:'#ffffff',ambient:2.8,sun:2,night:0,x:-9,y:16},
  {name:'黄昏',sky:'#e3b7a0',light:'#ffc58b',ground:'#8c839f',tint:'#edba94',ambient:2,sun:2.1,night:.18,x:11,y:7},
  {name:'蓝调',sky:'#7d88ad',light:'#bfd0ff',ground:'#5c647e',tint:'#8a9fc4',ambient:1.25,sun:.65,night:.78,x:9,y:10},
  {name:'夜晚',sky:'#344661',light:'#c4d6ff',ground:'#48576b',tint:'#687fa6',ambient:.9,sun:.7,night:1,x:7,y:14}
];
export function createDayNight({scene,sun,ambient,room,vegetation,water,clouds,lantern,windowMaterial,renderer,hits,status,reduced}){
  let phase=2,paused=false,travel=0,shadowTime=0;
  const tint=new T.Color(),sky=new T.Color(),light=new T.Color(),ground=new T.Color(),roomWarmth=new T.Color('#c4a784');
  const colors=stops.map(s=>Object.fromEntries(['sky','light','ground','tint'].map(k=>[k,new T.Color(s[k])])));
  const dials=[];
  function announce(){status.textContent=stops[Math.round(phase)%5].name+' · '+(paused?'时间已暂停':'昼夜缓缓流转')+'。点击钟面或按 T 切换时刻，点击钟旁圆钮或按 P 暂停。';}
  function next(){travel=(Math.floor(phase+travel+.001)+1)-phase;announce();}
  function toggle(){paused=!paused;announce();}
  function clock(parent,position,outdoor=false){
    const group=new T.Group();group.position.set(...position);if(outdoor)group.rotation.x=-.65;parent.add(group);
    const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
    ctx.fillStyle='#ead9b5';ctx.fillRect(0,0,512,512);ctx.textAlign='center';ctx.textBaseline='middle';
    const labels=['晨','昼','暮','蓝','夜'];ctx.font='bold 42px sans-serif';
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2-Math.PI/2;ctx.fillStyle=['#be9179','#8c9d77','#b8805e','#7784a3','#5a6883'][i];ctx.fillText(labels[i],256+Math.cos(a)*174,256+Math.sin(a)*174);}
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
    const face=new T.Mesh(new T.CircleGeometry(.36,40),new T.MeshStandardMaterial({map:tex,roughness:1}));group.add(face);face.userData.activate=next;
    const rim=new T.Mesh(new T.TorusGeometry(.38,.045,8,40),new T.MeshStandardMaterial({color:'#987555',roughness:1}));group.add(rim);
    const pivot=new T.Group();pivot.position.z=.025;group.add(pivot);
    const hand=new T.Mesh(new T.BoxGeometry(.025,.25,.018),new T.MeshBasicMaterial({color:'#755949'}));hand.position.y=.105;pivot.add(hand);
    const button=new T.Mesh(new T.SphereGeometry(.085,12,8),new T.MeshStandardMaterial({color:'#d9b781',emissive:'#d9a568',emissiveIntensity:.15,roughness:1}));button.position.set(.52,0,0);group.add(button);button.userData.activate=toggle;
    const stem=new T.Mesh(new T.BoxGeometry(.15,.018,.018),rim.material);stem.position.x=.43;group.add(stem);
    dials.push({pivot,button});return [face,button];
  }
  room.targets.push(...clock(room.scene,[.05,3.2,-2.3]));
  hits.push(...clock(scene,[1.95,1.15,2.65],true));
  const pedestal=new T.Mesh(new T.CylinderGeometry(.27,.38,.72,20),new T.MeshStandardMaterial({color:'#babba3',roughness:1}));pedestal.position.set(1.95,.36,2.75);scene.add(pedestal);
  const poolMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{glow:{value:0}},vertexShader:'varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 uvp;uniform float glow;void main(){float r=length(uvp-.5)*2.;gl_FragColor=vec4(.95,.63,.25,pow(max(0.,1.-r),2.)*glow);}' });
  for(const [x,z] of [[-5,1],[2,-3]]){const pool=new T.Mesh(new T.PlaneGeometry(2.4,2.4),poolMaterial);pool.rotation.x=-Math.PI/2;pool.position.set(x,-.18+Math.sin(x*.24)*.17+Math.cos(z*.28)*.16+.03,z);scene.add(pool);}
  const positions=[];for(let i=0;i<90;i++){const a=i*2.39996,r=26+(i%7);positions.push(Math.cos(a)*r,11+(i*7%19),Math.sin(a)*r);}
  const stars=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)),new T.PointsMaterial({color:'#eee4cf',size:.075,transparent:true,opacity:0,depthWrite:false}));scene.add(stars);
  const firePositions=[];for(let i=0;i<22;i++)firePositions.push(Math.sin(i*4.7)*7,.4+(i%5)*.16,Math.cos(i*2.3)*5);
  const flies=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(firePositions,3)),new T.PointsMaterial({color:'#ffe5a6',size:.065,transparent:true,opacity:0,depthWrite:false}));scene.add(flies);
  const moon=new T.Mesh(new T.SphereGeometry(.7,20,12),new T.MeshBasicMaterial({color:'#f3e6c7',fog:false}));moon.position.set(0,13,-27);scene.add(moon);
  function update(dt,time){
    if(travel>0){const step=Math.min(travel,dt*.55);phase+=step;travel-=step;}else if(!paused)phase+=dt/360;
    phase%=5;
    const i=Math.floor(phase),j=(i+1)%5,f=T.MathUtils.smoothstep(phase-i,0,1),a=stops[i],b=stops[j];
    const mix=k=>T.MathUtils.lerp(a[k],b[k],f);
    for(const [key,value] of [['sky',sky],['light',light],['ground',ground],['tint',tint]])value.copy(colors[i][key]).lerp(colors[j][key],f);
    const night=mix('night');poolMaterial.uniforms.glow.value=night*.5;scene.background.copy(sky);scene.fog.color.copy(sky);
    ambient.color.copy(light);ambient.groundColor.copy(ground);ambient.intensity=mix('ambient');sun.color.copy(light);sun.intensity=mix('sun');sun.position.set(mix('x'),mix('y'),8);
    vegetation.setDaylight(tint);water.uniforms.dayTint.value.copy(tint);clouds.color.copy(sky).lerp(light,.35);
    lantern.emissive.set('#ffc575');lantern.emissiveIntensity=night*1.1;windowMaterial.emissive.set('#ffd293');windowMaterial.emissiveIntensity=night*1.4;
    const r=room.lighting;r.ambient.color.copy(light);r.ambient.groundColor.copy(ground);r.ambient.intensity=1.8-night*.85;r.sun.color.copy(light);r.sun.intensity=3.2*(1-night)+.48*night;r.sun.position.set(-3.8+mix('x')*.13,5+mix('y')*.06,4);
    r.fill.color.set('#cbd9ed');r.fill.intensity=.7-night*.3;r.sky.color.copy(sky);r.skyOrb.color.copy(light);r.shade.emissiveIntensity=.12+night*.75;r.lamp.intensity=.8+night*3.2;r.patchMat.opacity=.12*(1-night)+.018*night;r.patchMat.color.copy(light);
    for(const h of r.hills)h.material.color.copy(h.base).multiply(tint);
    room.scene.background.copy(sky).lerp(roomWarmth,.6);
    stars.material.opacity=Math.max(0,(night-.45)/.55)*.8;stars.visible=night>.45;moon.visible=night>.55;
    flies.visible=night>.35;flies.material.opacity=night*.65;if(!reduced.matches){const p=flies.geometry.attributes.position;for(let k=0;k<22;k++)p.setY(k,firePositions[k*3+1]+Math.sin(time*.6+k)*.12);p.needsUpdate=true;}
    for(const d of dials){d.pivot.rotation.z=-phase/5*Math.PI*2;d.button.material.emissiveIntensity=paused?.65:.12;}
    shadowTime+=dt;if(shadowTime>.25&&(!paused||travel>0)){renderer.shadowMap.needsUpdate=true;shadowTime=0;}
  }
  function key(e){if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(e.key.toLowerCase()==='t'){e.preventDefault();next();}if(e.key.toLowerCase()==='p'){e.preventDefault();toggle();}}
  renderer.domElement.addEventListener('keydown',key);
  const nextButton=document.querySelector('[data-time-next]'),pauseButton=document.querySelector('[data-time-pause]');nextButton.addEventListener('click',next);pauseButton.addEventListener('click',toggle);
  update(0,0);
  return {update,diagnostics:()=>({phase,name:stops[Math.round(phase)%5].name,paused,transitioning:travel>0}),dispose(){renderer.domElement.removeEventListener('keydown',key);nextButton.removeEventListener('click',next);pauseButton.removeEventListener('click',toggle);}};
}
