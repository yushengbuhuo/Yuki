import {mountWorldControls} from './pet-world-controls.js';
import * as T from '../vendor/three/package/build/three.module.js';
import {createGardenDetails} from './pet-garden-details.js';
import {originalGeometry} from './pet-source.js';
import {createPetExperience} from './pet-experience.js?v=roomlife3';
import {painted,createFinish,archGeometry} from './pet-art.js';
import {createVegetation} from './pet-vegetation.js';
import {createPetSkin} from './pet-skin.js?v=softblack3';
import {createDayNight} from './pet-daynight.js';
import {createWildlife} from './pet-wildlife.js';
import {createSoundscape} from './pet-soundscape.js';
let experience,daynight,wildlife,soundscape,flockBell,flockBellAge=10;

const host=document.querySelector('#world'),status=document.querySelector('#status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:700px)').matches;
let renderer;
try {renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});} catch(e){document.querySelector('#loading').innerHTML='<p>设备暂时无法开启三维庭院。</p><a href="index.html">返回首页</a>';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.5));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const finish=createFinish(renderer);renderer.info.autoReset=false;
host.append(renderer.domElement);const canvas=renderer.domElement;canvas.tabIndex=0;
canvas.setAttribute('aria-label','风之庭院。点击地面散步，点击小球摸摸，点击木牌互动。拖动环顾，滚轮缩放。方向键移动，空格玩耍，Home 回到初始位置。');
const scene=new T.Scene();scene.background=new T.Color('#dce8db');scene.fog=new T.Fog('#dce8db',26,65);
const camera=new T.PerspectiveCamera(38,1,.1,100);
const ambient=new T.HemisphereLight(0xf5f4e5,0x799b91,2.8);scene.add(ambient);
const sun=new T.DirectionalLight(0xffead0,2);sun.position.set(-9,16,8);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.1,far:50});sun.shadow.normalBias=.05;scene.add(sun);
const mat=color=>painted(color);
const green=mat('#82a36c'),bark=mat('#8c795b'),cream=mat('#eedeb5'),stone=mat('#b6bfaa'),roof=mat('#74956c'),wood=mat('#967650');
const sphere=new T.SphereGeometry(1,24,16),box=new T.BoxGeometry(1,1,1);
function mesh(g,m,x,y,z,sx=1,sy=sx,sz=sx,parent=scene){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.receiveShadow=true;parent.add(o);return o;}
let seed=817;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const height=(x,z)=>-.18+Math.sin(x*.24)*.17+Math.cos(z*.28)*.16;
const landGeo=new T.PlaneGeometry(100,100,70,70);landGeo.rotateX(-Math.PI/2);
const lp=landGeo.attributes.position;for(let i=0;i<lp.count;i++)lp.setY(i,height(lp.getX(i),lp.getZ(i)));landGeo.computeVertexNormals();
const groundColors=[];for(let i=0;i<lp.count;i++){const x=lp.getX(i),z=lp.getZ(i),n=(Math.sin(x*.43+z*.24)+Math.cos(z*.37-x*.13))*.5;const c=new T.Color().setHSL(.235+n*.015,.23,.48+n*.035);groundColors.push(c.r,c.g,c.b);}landGeo.setAttribute('color',new T.Float32BufferAttribute(groundColors,3));green.vertexColors=true;
const land=mesh(landGeo,green,0,0,0);
green.color.set('#749b76');
const wind={value:0};
// One opaque water draw; no reflection or refraction render targets.
const waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},dayTint:{value:new T.Color('#ffffff')}},vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
varying vec2 p;uniform float time;uniform vec3 dayTint;
void main(){
  float edge=length(p),wave=sin(p.x*19.+p.y*31.+time*.7)*.006+sin(p.y*53.-time*.4)*.003;
  vec3 col=mix(vec3(.105,.31,.29),vec3(.41,.62,.46),smoothstep(.2,1.,edge));
  float cloud=smoothstep(.55,.95,sin(p.x*3.+p.y*4.+.4)*.5+.5)*smoothstep(-.3,.6,p.y);
  col=mix(col,vec3(.63,.76,.63),cloud*.35);
  float streak=pow(max(0.,sin(p.y*64.+sin(p.x*8.+time*.17)*1.8+time*.3)),32.);
  col+=vec3(.29,.32,.21)*streak*smoothstep(.3,.8,sin(p.x*22.+p.y*6.))*.45;
  float shore=smoothstep(.973,.985,edge+wave)*(1.-smoothstep(.989,1.,edge+wave));
  col=mix(col,vec3(.79,.83,.59),shore*.65);
  gl_FragColor=vec4(col*dayTint,1.);
}`});
const pond=mesh(new T.CircleGeometry(1,64),waterMat,5.3,.16,1.5,3.4,2.35,1);pond.rotation.x=-Math.PI/2;
for(let i=0;i<23;i++){const a=i/23*Math.PI*2,x=5.3+Math.cos(a)*3.45,z=1.5+Math.sin(a)*2.38;const rock=mesh(sphere,stone,x,.17,z,.28+rand()*.28,.13+rand()*.15,.22+rand()*.25);rock.rotation.y=rand()*6.28;}
const lilyMat=mat('#8ba77c');
for(let i=0;i<7;i++){const x=5.5+Math.sin(i*3)*1.4,z=1.5+Math.cos(i*2)*1.2;const pad=mesh(new T.CircleGeometry(.19+rand()*.12,24, .12,Math.PI*2-.25),lilyMat,x,.175,z);pad.rotation.x=-Math.PI/2;}
const ripples=[];for(let i=0;i<3;i++){const o=mesh(new T.RingGeometry(.91,1,32),new T.MeshBasicMaterial({color:0xe7f0cf,transparent:true,opacity:.25,depthWrite:false}),4.8,.18,1.4);o.rotation.x=-Math.PI/2;ripples.push(o);}
// Rounded gable and overlapping roof strips: clear cottage silhouette, soft joinery.
const houseShape=new T.Shape();houseShape.moveTo(-1.8,0);houseShape.lineTo(1.8,0);houseShape.lineTo(1.8,1.9);houseShape.quadraticCurveTo(.8,2.65,0,3.15);houseShape.quadraticCurveTo(-.8,2.65,-1.8,1.9);houseShape.closePath();
const houseGeo=new T.ExtrudeGeometry(houseShape,{depth:2.8,bevelEnabled:true,bevelThickness:.12,bevelSize:.12,bevelSegments:3,curveSegments:12});
mesh(houseGeo,cream,-3.7,.02,-5.2).castShadow=true;
const roofColors=[roof,mat('#809c7b'),mat('#8fa887')];
for(let side of [-1,1])for(let row=0;row<9;row++){
 const x=side*(row+.5)*.245,y=3.24-Math.pow(Math.abs(x)/2.2,.8)*1.15;
 const strip=mesh(box,roofColors[row%3],-3.7+x,y,-3.8,.3,.13,3.55);strip.rotation.z=-side*.45;strip.castShadow=true;
}
mesh(box,wood,-3.7,1.88,-2.24,3.72,.12,.12);
mesh(box,cream,-4.7,3.05,-4.35,.42,.95,.44).castShadow=true;
mesh(box,stone,-4.7,3.55,-4.35,.55,.12,.55);
const door=mesh(new T.CircleGeometry(.56,24),wood,-3.65,.86,-2.02);mesh(box,wood,-3.65,.43,-2.02,1.12,.86,.06);
const windowMaterial=mat('#ffd585');mesh(sphere,windowMaterial,-4.7,1.3,-2.12,.25,.27,.07);
const windowRim=mesh(new T.TorusGeometry(.3,.045,8,32),wood,-4.7,1.3,-2.09);
mesh(box,cream,-4.7,1.3,-2.03,.04,.55,.05);mesh(box,cream,-4.7,1.3,-2.03,.55,.04,.05);
mesh(sphere,mat('#eac887'),-3.3,.66,-1.95,.055);

const dummy=new T.Object3D();
const hillMat=mat('#9bab95');for(const [x,z,sx,sy] of [[-19,-28,16,6],[0,-36,22,7],[24,-29,18,5]])mesh(sphere,hillMat,x,0,z,sx,sy,11);
const cloudMat=new T.MeshBasicMaterial({color:'#edf0e2',fog:true});
for(let i=0;i<8;i++)mesh(sphere,cloudMat,-23+i*7,10+Math.sin(i)*2,-35,3.5,1,1.6);
const trees=[[-7,-4,1.3],[-8,3,.95],[.5,-7,1],[7,-6,1.1],[11,0,.85],[-12,-10,1.2]];
const garden=createGardenDetails(scene,height);
const vegetation=createVegetation({scene,wind,height,trees,mobile,localLights:garden.lights});
const count=vegetation.grassCount,leafCount=vegetation.leafCount;
const flowers=new T.InstancedMesh(sphere,mat('#fff0c1'),90);for(let i=0;i<90;i++){dummy.position.set(-7+rand()*6,.3,1+rand()*6);dummy.scale.set(.08,.06,.08);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);}scene.add(flowers);
// Original supplied model: body, two separate short appendages, white eyes.
const pet=new T.Group();scene.add(pet);pet.scale.setScalar(.33);
const skin=createPetSkin(),eyeMat=new T.MeshBasicMaterial({color:'#fff5df',toneMapped:false,fog:false});
for(const role of ['body','footLeft','footRight','eyeLeft','eyeRight']){const o=mesh(originalGeometry(role),role.startsWith('eye')?eyeMat:skin,0,0,0,1,1,1,pet);o.castShadow=!role.startsWith('eye');o.userData.role=role;}
let state=window.PetStorage.load().state,lastAction=-10,actionTime=-10,action='';
const target=new T.Vector3(0,0,1),ray=new T.Raycaster(),pointer=new T.Vector2(),hits=[];
function perform(a){const now=performance.now()/1000;if(now-lastAction<1.2)return;lastAction=now;action=a;actionTime=now;state=window.PetStorage.interact(state,a);const saved=window.PetStorage.save(state);status.textContent=({feed:'小球吃饱了。',pet:'小球开心地蹭了蹭你。',play:'一起玩一会儿。',sleep:'小球在树下休息。',clean:'溪水洗掉了身上的灰。'})[a]+(saved?'':' 本次进度未能保存。');}
function roomChoice(event){
  if(event.kind==='food')state=window.PetStorage.feed(state,event.value);
  if(event.kind==='outfit')state=window.PetStorage.setAppearance(state,{outfit:event.value});
  if(event.kind==='rug')state=window.PetStorage.setRoom(state,{rug:event.value});
  const saved=window.PetStorage.save(state);
  status.textContent=event.kind==='food'
    ?({cake:'小球坐好后吃完了草莓蛋糕，开心得轻轻发颤。',milk:'小球捧着热牛奶喝完，变得暖洋洋、慢吞吞。',berries:'小球吃完蓝莓，身边浮起了梦幻的蓝色微光。'})[event.value]
    :event.kind==='outfit'
      ?({scarf:'小球戴上了柔软的小围巾。',bow:'小球戴好蝴蝶结，得意地转了一圈。',cape:'小球披上绿色小斗篷。'})[event.value]
      :({peach:'房间铺上了温暖的蜜桃色地毯。',sage:'房间换成了安静的鼠尾草绿地毯。',moon:'月夜蓝地毯让房间显得更适合做梦。'})[event.value];
  if(!saved)status.textContent+=' 本次选择未能保存。';
  return state;
}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>perform(b.dataset.action)));
function sign(text,x,z,fn,width=1.5){const c=document.createElement('canvas');c.width=512;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#ecdfb9';ctx.fillRect(0,0,512,160);ctx.strokeStyle='#b4a67d';ctx.lineWidth=12;ctx.strokeRect(6,6,500,148);ctx.fillStyle='#555f4c';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='48px sans-serif';if(ctx.measureText(text).width>470)ctx.font=(48*470/ctx.measureText(text).width)+'px sans-serif';ctx.fillText(text,256,80);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const b=mesh(new T.PlaneGeometry(width,width*.3125),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,toneMapped:false}),x,.91,z);b.rotation.x=-.15;b.userData.activate=fn;hits.push(b);mesh(box,wood,x,.4,z,.08,.8,.08);return b;}
sign('← 回家',-7,6,()=>{location.href='index.html';});
sign('树下休息',-2.7,-1,()=>{target.set(-2.6,0,-.5);perform('sleep');});
sign('吃点东西',-2,3,()=>{target.set(-1.8,0,2.7);perform('feed');});
sign('洗洗脸',3,3.8,()=>{target.set(2.4,0,3.3);perform('clean');});pond.userData.activate=()=>perform('clean');hits.push(pond);
sign('一起玩',1,5.2,()=>perform('play'));
sign(state.name+'的庭院',0,-4.4,()=>perform('pet'),2.5);
sign('点草地散步 · 点小球摸摸',0,7.8,()=>perform('pet'),3.8);
const bowl=mesh(new T.TorusGeometry(.35,.09,8,20),cream,-2,.15,2.7);bowl.rotation.x=-Math.PI/2;bowl.userData.activate=()=>perform('feed');hits.push(bowl);
const motes=new T.InstancedMesh(sphere,new T.MeshBasicMaterial({color:'#f9dc9a'}),12);scene.add(motes);motes.visible=false;
const food=mat('#c88955');for(let i=0;i<5;i++)mesh(sphere,food,-2+(rand()-.5)*.3,.16,2.7+(rand()-.5)*.3,.09);
const ball=mesh(sphere,mat('#d8a077'),1,.3,4.6,.27);ball.userData.activate=()=>perform('play');hits.push(ball);
door.userData.activate=()=>perform('sleep');hits.push(door);

function walkable(x,z){return Math.hypot((x-5.3)/3.9,(z-1.5)/2.9)>1&&Math.hypot((x+3.7)/2.5,(z+3.6)/2)>1&&trees.every(([tx,tz])=>Math.hypot(x-tx,z-tz)>.8);}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();experience?.resize();}addEventListener('resize',resize);resize();
let frame=0,last=0,time=0,slow=0,frames=0,total=0;const offset=new T.Vector3();
function tick(ms){frame=requestAnimationFrame(tick);if(ms-last<1000/(mobile?30:60)-1)return;const elapsed=(ms-last)/1000,dt=Math.min(elapsed,.05);last=ms;time+=dt;wind.value=reduced.matches?0:time;waterMat.uniforms.time.value=reduced.matches?0:time;
daynight.update(dt,time);
flockBellAge+=dt;if(flockBell)flockBell.rotation.z=reduced.matches?0:Math.sin(flockBellAge*15)*Math.exp(-flockBellAge*4)*.3;
const phase=daynight.diagnostics().phase;wildlife.update(dt,time,phase,pet,experience.mode,reduced.matches);
experience.setLifeContext({phase,bird:wildlife.bird,firefly:garden.lights[4].position});
experience.update(dt,ms/1000);experience.resolveActors(wildlife.colliders());soundscape.update(dt,time,experience.mode,phase,pet,experience.moving);soundscape.pull(experience.pullSound);
for(const event of wildlife.audioEvents())soundscape.emit(event.kind,event.position);
if(experience.mode==="garden")vegetation.update(camera,scene.fog);
const active=ms/1000-actionTime<1.2;
ball.position.y=.3+(active&&action==='play'&&!reduced.matches?Math.abs(Math.sin(time*5))*.4:0);
motes.visible=active&&experience.mode==='garden';for(let i=0;active&&i<12;i++){const a=i/12*Math.PI*2,phase=(ms/1000-actionTime)/1.2;dummy.position.set(pet.position.x+Math.cos(a)*(.5+phase*.3),pet.position.y+.9+phase*.8,pet.position.z+Math.sin(a)*(.5+phase*.3));dummy.scale.setScalar(.035*(1-phase));dummy.updateMatrix();motes.setMatrixAt(i,dummy.matrix);}if(active)motes.instanceMatrix.needsUpdate=true;
ripples.forEach((r,i)=>{const p=reduced.matches?i/3:(time*.2+i/3)%1;r.scale.setScalar(.4+p*1.3);r.material.opacity=(1-p)*.25;});
renderer.info.reset();finish.render(experience.scene,experience.camera,experience.mode==='room',pet);
total+=elapsed;frames++;if(frames===180){if(total/frames>.027&&!mobile&&slow<2){slow++;renderer.setPixelRatio(Math.max(.85,renderer.getPixelRatio()-.25));}frames=0;total=0;}}
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);if(!document.hidden){last=performance.now();frame=requestAnimationFrame(tick);}});
const settle=setInterval(()=>{state=window.PetStorage.settle(state);window.PetStorage.save(state);experience?.setRoomState(state);},60000);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);const el=document.querySelector('#loading');el.hidden=false;el.innerHTML='<p>庭院暂时休息了，请刷新页面重新进入。</p><a href="index.html">返回首页</a>';});
addEventListener('pagehide',e=>{if(e.persisted)return;cancelAnimationFrame(frame);clearInterval(settle);soundscape?.dispose();daynight?.dispose();experience?.dispose();finish.dispose();vegetation.dispose();const gs=new Set(),ms=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>{m.map?.dispose();m.dispose();});renderer.dispose();});
// Merge static opaque props by material and shadow policy.
const batches=new Map();
for(const o of [...scene.children]){
if(!o.isMesh||o.isInstancedMesh||o===land||hits.includes(o)||ripples.includes(o)||o===pond||o.material.transparent)continue;
const key=o.material.uuid+':'+o.castShadow;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);
}
for(const objects of batches.values()){
if(objects.length<2)continue;const positions=[],normals=[],uvs=[];
for(const o of objects){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);if(g.attributes.uv)uvs.push(...g.attributes.uv.array);else for(let i=0;i<g.attributes.position.count;i++)uvs.push(0,0);g.dispose();scene.remove(o);}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeBoundingSphere();const o=mesh(g,objects[0].material,0,0,0);o.castShadow=objects[0].castShadow;
}
experience=createPetExperience({renderer,scene,camera,pet,door,land,hits,target,height,walkable,perform,status,reduced,petState:state,onRoomChoice:roomChoice,onHurt(angry){
state={...state,mood:Math.max(0,state.mood-(angry?8:4)),totalInteractions:state.totalInteractions+1};
if(!window.PetStorage.save(state))status.textContent+=' 本次进度未能保存。';
}});
daynight=createDayNight({scene,sun,ambient,room:experience.room,vegetation,water:waterMat,clouds:cloudMat,garden,windowMaterial,renderer,hits,status,reduced});
wildlife=createWildlife({scene,height,walkable,mobile,renderer});
soundscape=createSoundscape({canvas,scene,room:experience.room,hits,status});
function summonFlock(){const result=wildlife.flock.invite();flockBellAge=0;soundscape.emit('bell',{x:-5.7,z:5.5});status.textContent=result==='arriving'?'牧羊人和羊群已经在路上，稍等一会儿。':result==='grazing'?'羊群已经在草地上吃草啦。':result==='leaving'?'牧羊人正带羊群前往另一侧，等它们走远后再邀请吧。':'铃声传向远方，牧羊人会带着羊群沿小路走来。';}
sign('摇铃唤羊',-5.7,5.5,summonFlock,1.65);
const summonBrass=mat('#c9aa69');flockBell=mesh(new T.CylinderGeometry(.11,.23,.34,20),summonBrass,-5.7,1.52,5.5);flockBell.userData.activate=summonFlock;hits.push(flockBell);
mesh(new T.TorusGeometry(.09,.022,6,16),wood,-5.7,1.8,5.5);mesh(sphere,summonBrass,-5.7,1.31,5.5,.06);
const summonButton=document.querySelector('[data-flock-call]');summonButton.addEventListener('click',summonFlock);
function summonKey(e){if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='h'){e.preventDefault();summonFlock();}}canvas.addEventListener('keydown',summonKey);
addEventListener('pagehide',e=>{if(!e.persisted){summonButton.removeEventListener('click',summonFlock);canvas.removeEventListener('keydown',summonKey);}});
// Refresh moving sunlight at a bounded rate; leaf sway stays inexpensive.
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
mountWorldControls(experience);
document.querySelector('#loading').hidden=true;frame=requestAnimationFrame(tick);

export function getWorldDiagnostics(){return {wildlife:wildlife.diagnostics(),sound:soundscape.diagnostics(),daynight:daynight.diagnostics(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),grassInstances:count,leafInstances:leafCount,state:{name:state.name,satiety:state.satiety,mood:state.mood},reducedMotion:reduced.matches,...experience.diagnostics()};}
