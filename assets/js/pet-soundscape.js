import * as T from '../vendor/three/package/build/three.module.js';
export function createSoundscape({canvas,scene,room,hits,status}){
 let ctx=null,master,windGain,waterGain,windFilter,waterFilter,noise,muted=false,disposed=false,mode='room',phase=2,lastStep=0,lastBird=0,lastInsect=0,lastTick=0;
 let listener={x:0,z:0},travel=0,previous=null,stretchVoice=null,recoilCount=0;
 try{muted=localStorage.getItem('zerohey_sound_muted')==='1';}catch{}
 const buttons=[],nodes=[];
 function bell(parent,p,targets){
  const group=new T.Group();group.position.set(...p);parent.add(group);
  const mat=new T.MeshStandardMaterial({color:'#c4aa72',roughness:.85,emissive:'#b99e60',emissiveIntensity:muted?0:.18});
  const shape=new T.Mesh(new T.CylinderGeometry(.07,.16,.22,16),mat);group.add(shape);shape.userData.activate=toggle;shape.name='sound-bell';targets.push(shape);
  const clapper=new T.Mesh(new T.SphereGeometry(.045,8,6),mat);clapper.position.y=-.13;group.add(clapper);
  const handle=new T.Mesh(new T.TorusGeometry(.065,.018,6,12),mat);handle.position.y=.17;group.add(handle);handle.userData.activate=toggle;targets.push(handle);
  buttons.push(mat);
 }
 bell(room.scene,[1.1,3.2,-2.35],room.targets);bell(scene,[-.25,.82,4.65],hits);
 const button=document.querySelector('[data-sound-toggle]');
 function reflect(){for(const m of buttons)m.emissiveIntensity=muted?0:.18;button.setAttribute('aria-pressed',String(muted));button.textContent=muted?'开启环境声（M）':'关闭环境声（M）';}
 function init(){
  if(ctx||disposed)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  try{
   ctx=new Audio();master=ctx.createGain();master.gain.value=muted?0:.22;master.connect(ctx.destination);
   noise=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate);const data=noise.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=(last+.03*white)/1.03;data[i]=last*4;}
   const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;
   windFilter=ctx.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=650;windGain=ctx.createGain();windGain.gain.value=.09;
   waterFilter=ctx.createBiquadFilter();waterFilter.type='bandpass';waterFilter.frequency.value=1700;waterFilter.Q.value=.55;waterGain=ctx.createGain();waterGain.gain.value=.04;
   source.connect(windFilter).connect(windGain).connect(master);source.connect(waterFilter).connect(waterGain).connect(master);source.start();nodes.push(source,windFilter,windGain,waterFilter,waterGain);
  }catch{ctx=null;}
 }
 function gesture(){init();if(ctx&&!document.hidden&&ctx.state==='suspended')ctx.resume().catch(()=>{});}
 function toggle(){muted=!muted;if(muted)stopStretch();gesture();if(ctx)master.gain.setTargetAtTime(muted?0:.22,ctx.currentTime,.15);try{localStorage.setItem('zerohey_sound_muted',muted?'1':'0');}catch{}reflect();status.textContent=muted?'庄园安静下来了。再次点击铃铛或按 M 开启声音。':'环境声已开启。点击铃铛或按 M 静音。';}
 function tone(freq,end,duration,volume,pan=0,type='sine',delay=0){
  if(!ctx||ctx.state!=='running'||muted||document.hidden)return;
  const start=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain(),panner=ctx.createStereoPanner();
  osc.type=type;osc.frequency.setValueAtTime(freq,start);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+duration);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  panner.pan.value=Math.max(-.8,Math.min(.8,pan));osc.connect(gain).connect(panner).connect(master);osc.start(start);osc.stop(start+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();panner.disconnect();};
 }
 function stopStretch(){
  if(!stretchVoice)return;
  const {osc,gain}=stretchVoice;stretchVoice=null;
  const t=ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(0,t,.012);osc.stop(t+.06);
 }
 function pull({held,strength,impact,impactStrength}){
  if(!ctx||ctx.state!=='running'||muted||document.hidden){stopStretch();return;}
  const t=ctx.currentTime,s=Math.max(0,Math.min(1,strength));
  if(held&&s>.03){
   if(!stretchVoice){
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';gain.gain.value=0;
    osc.connect(gain).connect(master);osc.start();osc.onended=()=>{osc.disconnect();gain.disconnect();};stretchVoice={osc,gain};
   }
   stretchVoice.osc.frequency.setTargetAtTime(170+170*s,t,.06);
   stretchVoice.gain.gain.setTargetAtTime(.012+.025*s,t,.04);
  }else stopStretch();
  // The deformation solver emits impact only on the first return crossing.
  if(impact){
   const power=Math.max(0,Math.min(1,impactStrength)),variant=.96+Math.random()*.08;
   tone((180+45*power)*variant,70*variant,.16+.07*power,.18+.12*power);
   tone(330*variant,115*variant,.11,.035+.025*power);
   recoilCount++;
  }
 }
 function rustle(volume){
  if(!ctx||muted||ctx.state!=='running')return;const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise;f.type='lowpass';f.frequency.value=mode==='room'?350:750;
  const t=ctx.currentTime;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+.09);s.connect(f).connect(g).connect(master);s.start(t,Math.random()*2,.1);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
 }
 function emit(kind,position){
  const d=position?Math.hypot(position.x-listener.x,position.z-listener.z):0,volume=(mode==='room'?.12:1)/(1+d*.3),pan=position?(position.x-listener.x)*.12:0;
  if(kind==='bell'){tone(880,878,.8,.12*volume,pan);tone(1320,1315,.5,.035*volume,pan);}
  if(kind==='bleat'){tone(220,170,.5,.065*volume,pan,'triangle');tone(260,200,.3,.03*volume,pan,'sine',.12);}
  if(kind==='bird'){tone(2100,3100,.16,.055*volume,pan);tone(2800,1800,.2,.04*volume,pan,'sine',.2);}
 }
 function update(dt,time,nextMode,nextPhase,pet,moving){
  mode=nextMode;phase=nextPhase;listener={x:pet.position.x,z:pet.position.z};
  if(previous)travel+=Math.hypot(listener.x-previous.x,listener.z-previous.z);previous=listener;
  if(!ctx||ctx.state!=='running'||muted)return;
  const night=phase>=3,indoor=mode==='room',t=ctx.currentTime;
  windGain.gain.setTargetAtTime((indoor?.028:.09)*(1+Math.sin(time*.17)*.18),t,.6);windFilter.frequency.setTargetAtTime(indoor?320:650+Math.sin(time*.12)*130,t,.6);
  const pond=Math.hypot(pet.position.x-5.3,pet.position.z-1.5);waterGain.gain.setTargetAtTime(indoor?.008:.11/(1+pond*.4),t,.6);
  if(moving&&travel-lastStep>.3){lastStep=travel;rustle(indoor?.045:.028);}
  if(!night&&time-lastBird>16){lastBird=time+Math.random()*12;emit('bird',{x:-5,z:2});}
  if(night&&time-lastInsect>5){lastInsect=time+Math.random()*3;for(let i=0;i<3;i++)tone(4200,4000,.045,indoor?.003:.012,.45,'sine',i*.12);}
  if(indoor&&time-lastTick>4){lastTick=time;tone(900,650,.045,.013,-.3);}
 }
 function key(e){if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='m'){e.preventDefault();toggle();}}
 function visibility(){if(!ctx)return;if(document.hidden){stopStretch();ctx.suspend().catch(()=>{});}else if(!muted)ctx.resume().catch(()=>{});}
 canvas.addEventListener('pointerdown',gesture);canvas.addEventListener('keydown',gesture);canvas.addEventListener('keydown',key);button.addEventListener('click',toggle);document.addEventListener('visibilitychange',visibility);reflect();
 return {update,emit,pull,diagnostics:()=>({muted,state:ctx?.state||'waiting-for-interaction',stretchActive:!!stretchVoice,recoilCount}),dispose(){disposed=true;stopStretch();canvas.removeEventListener('pointerdown',gesture);canvas.removeEventListener('keydown',gesture);canvas.removeEventListener('keydown',key);button.removeEventListener('click',toggle);document.removeEventListener('visibilitychange',visibility);nodes.forEach(n=>n.disconnect());ctx?.close().catch(()=>{});}};
}
