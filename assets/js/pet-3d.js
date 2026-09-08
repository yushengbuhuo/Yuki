import * as THREE from '../vendor/three/package/build/three.module.js';
import { originalGeometry } from './pet-source.js';

// All geometry is local. Exactly two appendages; eyes are complete white shapes.
export function createPetStage(host, onTouch) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '3D 小球。鼠标中键拖动旋转，左键点击或按住小球互动。方向键旋转，Home 回正。触屏拖动旋转，停按互动。');
  host.append(canvas);
  const scene = new THREE.Scene();
  // Orthographic framing preserves the proportions of the turnaround drawings.
  const camera = new THREE.OrthographicCamera(-3,3,2.1,-2.1,.1,60);
  camera.position.set(0, 1.55, 8);
  camera.lookAt(0, 1.3, 0);
  const hemi = new THREE.HemisphereLight(0xfff5df, 0x737c86, 2.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffefd7, 4);
  key.position.set(-3, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4;
  key.shadow.bias = -.001;
  key.shadow.normalBias = .025;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd1e4ef, 2);
  rim.position.set(4, 4, -3); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({color:0x313631,opacity:.12}));
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
  const root = new THREE.Group(); scene.add(root);
  const torso = new THREE.Group(); root.add(torso);
  const skin = new THREE.MeshPhysicalMaterial({color:0x09131a,roughness:.92,metalness:0,clearcoat:0});
  const white = new THREE.MeshStandardMaterial({color:0xf0eee8,roughness:.65});
  function mesh(geo, mat, parent, position=[0,0,0], scale=[1,1,1]) {
    const object = new THREE.Mesh(geo,mat);object.position.set(...position);object.scale.set(...scale);
    object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  }
  const sphere = () => new THREE.SphereGeometry(1,48,32);
  // Evaluated mesh from the user's original blend, including its resting base.
  const geometry = originalGeometry('body');
  const positions = geometry.attributes.position;
  geometry.computeVertexNormals();
  const base=positions.array.slice();
  const body=mesh(geometry,skin,torso);
  const footMaterial=skin.clone();footMaterial.color.set(0x1b252c);
  const feet=['footLeft','footRight'].map(role=>mesh(originalGeometry(role),footMaterial,root));
  const eyes=['eyeLeft','eyeRight'].map(role=>{
    const g=originalGeometry(role),center=g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-center.x,-center.y,-center.z);
    const eye=mesh(g,white,torso);eye.castShadow=false;eye.receiveShadow=false;
    eye.position.copy(center);eye.userData.center=center;return eye;
  });
  const accessories=new THREE.Group();torso.add(accessories);
  const props=new THREE.Group();root.add(props);
  const environment=new THREE.Group();scene.add(environment);
  const cloth=new THREE.MeshPhysicalMaterial({color:0x854c55,roughness:.96,sheen:.65,sheenColor:0xb89595,side:THREE.DoubleSide});
  const cream=new THREE.MeshStandardMaterial({color:0xe9d9b6,roughness:.9});
  const green=new THREE.MeshStandardMaterial({color:0x6e8166,roughness:.85});
  const glass=new THREE.MeshPhysicalMaterial({color:0x8aa4a8,roughness:.16,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false});
  const tea=new THREE.MeshStandardMaterial({color:0x134b57,roughness:.3});
  let appearance={}, condition='idle', yaw=0, pitch=0, targetYaw=0, targetPitch=0, action='', actionUntil=0;
  let disposed=false, visible=true, last=performance.now(), time=0, frameId=0;
  let pressure=0, previousPressure=0, targetPressure=0, dentPoint=new THREE.Vector3(0,1.5,1), gesture=null, lastTouch=-3000;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const ray=new THREE.Raycaster(), pointer=new THREE.Vector2();
  const hint=host.querySelector('[data-stage-hint]');
  const defaultHint='中键拖动旋转 · 左键摸摸，按住轻揉或轻捏';
  const materials=new Set([skin,footMaterial,white,cloth,cream,green,glass,tea,ground.material]);
  // Fit clothing against the actual exported surface in its local coordinates.
  const fittingBody=new THREE.Mesh(geometry.clone(),skin),fitRay=new THREE.Raycaster();
  function surface(theta,y,gap=.065){
    const radial=new THREE.Vector3(Math.sin(theta),0,Math.cos(theta));
    fitRay.set(radial.clone().multiplyScalar(5).setY(y),radial.clone().negate());
    const hit=fitRay.intersectObject(fittingBody)[0];
    return (hit?hit.point:new THREE.Vector3(0,y,0)).addScaledVector(radial,gap);
  }
  function clothPanel(at,cols=72,rows=18){
    const vertices=[],indices=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)vertices.push(...at(i/cols,j/rows).toArray());
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
    const panel=mesh(geo,cloth,accessories);panel.receiveShadow=false;return panel;
  }
  const closedEyes=eyes.map((eye,i)=>{
    const points=[];
    for(let n=0;n<=32;n++)points.push(new THREE.Vector3(-.18+n/32*.36,Math.sin(n/32*Math.PI)*.1,0));
    const closed=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.019,8,false),white,torso);
    closed.position.copy(eye.userData.center);
    const p=closed.geometry.attributes.position;
    for(let n=0;n<p.count;n++){
      const x=p.getX(n)+closed.position.x,y=p.getY(n)+closed.position.y;
      fitRay.set(new THREE.Vector3(x,y,5),new THREE.Vector3(0,0,-1));
      const hit=fitRay.intersectObject(fittingBody)[0];
      if(hit)p.setZ(n,hit.point.z+.025+p.getZ(n)-closed.position.z);
    }
    p.needsUpdate=true;closed.geometry.computeVertexNormals();closed.geometry.computeBoundingSphere();closed.visible=false;return closed;
  });
  function clear(group) { while(group.children.length){const item=group.children[0];group.remove(item);item.traverse(o=>{if(o.isMesh)o.geometry.dispose();});} }
  function tube(points,radius,mat,parent=accessories) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,radius,8,false),mat,parent);
  }
  function dress() {
    clear(accessories);clear(props);
    if(appearance.outfit==='scarf') {
      clothPanel((u,v)=>surface(u*Math.PI*2,.86+v*.18+.085*(1-Math.cos(u*Math.PI*2)),.075+.016*Math.sin(v*Math.PI)));
      clothPanel((u,v)=>surface(-.38+u*.16+v*.035,.91-v*.5,.1+.02*Math.sin(v*Math.PI)),12,24);
    }
    if(appearance.outfit==='bow') {
      const p=surface(0,.97,.16);
      [-1,1].forEach(s=>mesh(sphere(),cloth,accessories,[p.x+s*.13,p.y,p.z],[.16,.105,.055]).rotation.z=s*.28);
      mesh(sphere(),cloth,accessories,p.toArray(),[.065,.09,.07]);
    }
    if(appearance.outfit==='cape') {
      clothPanel((u,v)=>{const angle=.95+u*(Math.PI*2-1.9),y=1.5-v*1.22;return surface(angle,y,.075+v*.08+.015*Math.sin(u*Math.PI*14)*v);});
      tube(Array.from({length:73},(_,i)=>surface(.95+i/72*(Math.PI*2-1.9),1.5,.08).toArray()),.025,cloth);
      const a=surface(.95,1.5,.09),b=surface(-.95,1.5,.09);
      tube([a.toArray(),surface(.45,.9,.09).toArray(),surface(0,.78,.09).toArray(),surface(-.45,.9,.09).toArray(),b.toArray()],.022,cloth);
      mesh(sphere(),cream,accessories,surface(0,.78,.13).toArray(),[.045,.045,.03]);
    }
    if(appearance.hat==='beret') {
      const top=geometry.boundingBox.max.y;
      const hat=mesh(sphere(),cloth,accessories,[-.1,top+.045,0],[.58,.145,.5]);hat.rotation.z=.08;
      mesh(new THREE.CylinderGeometry(.028,.035,.08,16),cloth,accessories,[-.15,top+.21,0]);
    }
    if(appearance.hat==='leaf') {
      const top=geometry.boundingBox.max.y;
      const leaf=mesh(sphere(),green,accessories,[.12,top+.115,0],[.24,.027,.09]);leaf.rotation.z=.35;
      tube([[0,top-.02,0],[.05,top+.15,0],[.24,top+.18,0]],.011,green);
    }
    if(appearance.prop==='cup') {
      mesh(originalGeometry('cup'),glass,props);
      mesh(originalGeometry('liquid'),tea,props);
      mesh(originalGeometry('straw'),tea,props);
    }
    if(appearance.prop==='bowl') {
      mesh(new THREE.SphereGeometry(.36,40,20,0,Math.PI*2,Math.PI/2,Math.PI/2),cream,props,[0,.4,1.25]);
      mesh(sphere(),white,props,[0,.4,1.25],[.32,.11,.32]);
      tube([[.2,.38,1.26],[.55,.85,1.2]],.018,cloth,props);
      tube([[.25,.38,1.26],[.6,.85,1.2]],.018,cloth,props);
    }
    if(appearance.prop==='book') {
      const book=mesh(new THREE.BoxGeometry(.67,.09,.46),cloth,props,[0,.19,1.35]);book.rotation.y=.12;
      mesh(new THREE.BoxGeometry(.62,.055,.42),cream,props,[0,.24,1.35]).rotation.y=.12;
    }
  }
  function setAppearance(next) {
    const poseChanged=appearance.pose!==next.pose;
    appearance={...next}; dress();
    // Original cup already has its authored position. Other props sit in front.
    props.position.z=next.prop==='cup'?0:.6;
    clear(environment);
    skin.color.set({coal:0x09131a,slate:0x43545e,plum:0x53424d}[next.color]||0x09131a);
    skin.roughness={matte:.92,velvet:1,ceramic:.38}[next.material]??.92;
    skin.clearcoat=next.material==='ceramic'?.8:0;skin.sheen=next.material==='velvet'?.7:0;skin.sheenColor.set(0x6e7881);
    if(poseChanged)targetYaw={sit:0,side:.65,rest:0,lookback:2.5}[next.pose]||0;
    const colors={studio:0xede9df,night:0x242d41,window:0xdce3df,garden:0xe0e5d5};
    scene.background=new THREE.Color(colors[next.scene]);
    scene.fog=new THREE.Fog(colors[next.scene],12,24);
    host.dataset.scene=next.scene;
    hemi.intensity=next.scene==='night'?1.3:2.5;key.intensity=next.scene==='night'?2:4;
    key.color.set(next.scene==='night'?0xbcc9ed:0xffefd7);
    if(next.scene==='window') {
      const panel=mesh(new THREE.BoxGeometry(2.3,3.7,.08),cream,environment,[-3.2,2,-2]);
      mesh(new THREE.BoxGeometry(2.1,3.5,.09),white,panel,[0,0,.02]);
      mesh(new THREE.BoxGeometry(.07,3.5,.1),cream,panel,[0,0,.1]);
      mesh(new THREE.BoxGeometry(2.1,.07,.1),cream,panel,[0,0,.1]);
    }
    if(next.scene==='night') {
      mesh(sphere(),cream,environment,[2.9,3.1,-3],[.45,.45,.1]);
      mesh(new THREE.CylinderGeometry(.3,.44,.42,32),cloth,environment,[-2.8,1.5,-1]);
      mesh(new THREE.CylinderGeometry(.035,.035,1.35,12),cream,environment,[-2.8,.68,-1]);
    }
    if(next.scene==='garden') {
      [-3,3].forEach((x,i)=>{
        mesh(new THREE.CylinderGeometry(.35,.24,.5,24),cream,environment,[x,.25,-1.6]);
        tube([[x,.4,-1.6],[x+.1,1.25,-1.6],[x-.1,1.9,-1.6]],.025,green,environment);
        for(let n=0;n<4;n++)mesh(sphere(),green,environment,[x+(n%2?-.24:.25),.9+n*.23,-1.6],[.3,.1,.17]).rotation.z=n%2?-.5:.5;
      });
    }
  }
  function hit(event) {
    const bounds=canvas.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    ray.setFromCamera(pointer,camera);
    const result=ray.intersectObject(body)[0];
    if(!result)return null;
    return body.worldToLocal(result.point.clone());
  }
  const region=p=>!p?null:p.y>2?'head':p.z<-.25&&p.y<1.5?'back':null;
  const events=new AbortController(); const signal=events.signal;
  canvas.addEventListener('pointerdown',e=>{
    if(gesture||![0,1].includes(e.button))return;
    const touch=e.pointerType==='touch',rotate=e.button===1;
    const point=hit(e);
    if(!rotate&&!touch&&!point)return;
    e.preventDefault();canvas.focus({preventScroll:true});
    gesture={id:e.pointerId,button:e.button,touch,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,started:performance.now(),region:region(point),point,mode:rotate?'rotate':touch?'pending':'touch'};
    if(gesture.mode==='touch'){dentPoint.copy(point);targetPressure=.07;}
    host.dataset.gesture=gesture.mode;
    if(touch)hint.textContent='拖动旋转 · 停按头顶轻揉，背面轻捏';
    canvas.setPointerCapture(e.pointerId);
  },{signal});
  canvas.addEventListener('pointermove',e=>{
    if(!gesture){const r=region(hit(e));hint.textContent=r==='head'?'左键按住，轻轻揉揉头顶':r==='back'?'左键按住轻捏，松手恢复':defaultHint;return;}
    if(e.pointerId!==gesture.id)return;
    const dx=e.clientX-gesture.lastX,dy=e.clientY-gesture.lastY;
    if(gesture.touch&&gesture.mode==='pending'&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>7)gesture.mode='rotate';
    if(gesture.mode==='rotate'){targetYaw+=dx*.009;targetPitch=THREE.MathUtils.clamp(targetPitch+dy*.004,-.18,.25);}
    if(gesture.mode==='touch')targetPressure=Math.min(.17,.045+Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)*.0018);
    gesture.lastX=e.clientX;gesture.lastY=e.clientY;
    host.dataset.gesture=gesture.mode;
  },{signal});
  function end(e){if(!gesture||e.pointerId!==gesture.id||(e.type==='pointerup'&&e.button!==gesture.button))return;const success=gesture.mode==='touch'&&e.type==='pointerup';const back=gesture.region==='back';gesture=null;targetPressure=0;hint.textContent=defaultHint;if(success&&performance.now()-lastTouch>1800){lastTouch=performance.now();onTouch(back?'pinch':'pet');}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,e=>{end(e);host.dataset.gesture=gesture?.mode||'idle';},{signal}));
  canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();},{signal});
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();
    if(e.key==='Home'){targetYaw=0;targetPitch=0;}else if(e.key==='ArrowLeft')targetYaw-=.25;else if(e.key==='ArrowRight')targetYaw+=.25;else targetPitch=THREE.MathUtils.clamp(targetPitch+(e.key==='ArrowUp'?-.04:.04),-.18,.25);
  },{signal});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();host.classList.remove('is-ready');hint.textContent='3D 暂时不可用，仍可用下方按钮照顾小球；刷新可重试。';cancelAnimationFrame(frameId);},{signal});
  function resize(){const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);const aspect=width/height,half=Math.max(3.8,3.8/aspect)/2;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});visibility.observe(host);
  function frame(now) {
    if(disposed)return;frameId=requestAnimationFrame(frame);
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(document.hidden||!visible)return;
    time+=dt;
    if(gesture?.mode==='pending'&&gesture.region&&now-gesture.started>230){gesture.mode='touch';dentPoint.copy(gesture.point);targetPressure=.07;}
    const slow=reduced.matches?1:1-Math.exp(-dt*9);
    yaw+=(targetYaw-yaw)*slow;pitch+=(targetPitch-pitch)*slow;
    root.rotation.set(0,yaw,0);
    camera.position.y=1.55+pitch*6;
    camera.lookAt(0,1.3,0);
    const active=now<actionUntil&&!reduced.matches;
    const pulse=active?Math.sin((actionUntil-now)/1200*Math.PI):0;
    const actionPressure=active&&action==='pinch'?Math.max(0,pulse)*.14:0;
    pressure+=((reduced.matches?0:Math.max(targetPressure,actionPressure))-pressure)*(reduced.matches?1:1-Math.exp(-dt*14));
    const resting=appearance.pose==='rest';
    const shape=appearance.shape==='round'?[.99,1.01,1]:appearance.shape==='flat'?[1.02,.97,1]:[1,1,1];
    const breathe=reduced.matches?0:Math.sin(time*1.5)*.005;
    const squash=active&&(action==='pet'||action==='clean')?pulse*.045:active&&action==='play'?Math.sin((actionUntil-now)/1200*Math.PI*2)*.045:0;
    const shapeEase=reduced.matches?1:1-Math.exp(-dt*8);
    torso.scale.x+=(shape[0]*(1+squash*.4)-torso.scale.x)*shapeEase;
    torso.scale.y+=(shape[1]*(resting?.9:1)*(1+breathe-squash)-torso.scale.y)*shapeEase;
    torso.rotation.z=active&&(action==='pet'||action==='feed')?Math.sin(pulse*Math.PI)*.025:0;
    root.position.y=active&&action==='play'?Math.max(0,pulse)*.14:0;
    // Local deformation, bounded to a soft neighbourhood; never adds body parts.
    if(pressure>.0001||previousPressure>.0001)for(let i=0;i<positions.count;i++){
      const j=i*3,x=base[j],y=base[j+1],z=base[j+2];
      const d=(x-dentPoint.x)**2+(y-dentPoint.y)**2+(z-dentPoint.z)**2;
      const amount=pressure*Math.exp(-d*7);
      positions.setXYZ(i,x*(1-amount*.2),y-amount*(dentPoint.y>2?1:0),z-amount*Math.sign(dentPoint.z));
    }
    if(pressure>.0001||previousPressure>.0001){positions.needsUpdate=true;geometry.computeVertexNormals();}
    previousPressure=pressure;
    const idleExpression=appearance.expression||'calm';
    const expression=gesture?.mode==='touch'&&!reduced.matches?'happy':active?(action==='sleep'?'sleepy':action==='play'||action==='pinch'?'surprised':'happy'):idleExpression;
    let blink=1;
    if(!reduced.matches&&time%6.7<.16)blink=.1+Math.abs(time%6.7-.08)/.08*.9;
    eyes.forEach((eye,i)=>{
      const spread=appearance.eyes==='close'?-.045:appearance.eyes==='wide'?.045:0;
      const closed=expression==='happy'||expression==='sleepy';
      eye.visible=!closed;closedEyes[i].visible=closed;
      const size=expression==='surprised'?1.08:1;
      const follow=reduced.matches?1:1-Math.exp(-dt*14);
      eye.scale.x+=(size/torso.scale.x-eye.scale.x)*follow;
      eye.scale.y+=(size*blink/torso.scale.y-eye.scale.y)*follow;
      eye.position.x=eye.userData.center.x+(i?spread:-spread);
      eye.rotation.z=expression==='curious'?(i?-.035:.035):0;
      closedEyes[i].position.x=eye.position.x;
      closedEyes[i].scale.set(1/torso.scale.x,(expression==='sleepy'?-.4:1)/torso.scale.y,1);
      closedEyes[i].rotation.z=expression==='sleepy'?(i?.06:-.06):0;
    });
    host.dataset.motion=reduced.matches?'reduced':'full';
    host.dataset.gesture=gesture?.mode||'idle';
    renderer.render(scene,camera);
  }
  host.classList.add('is-ready');hint.textContent=defaultHint;frameId=requestAnimationFrame(frame);
  return {
    setAppearance,
    setCondition(value){condition=value;},
    playAction(type){action=type;actionUntil=performance.now()+1200;if(type==='pinch'){dentPoint.set(0,.9,-1);targetYaw=Math.PI;}},
    resetView(){targetYaw=0;targetPitch=0;},
    setView(angle){targetYaw=angle;targetPitch=0;},
    photo(){renderer.render(scene,camera);const link=document.createElement('a');link.download='little-coal-studio.png';link.href=canvas.toDataURL('image/png');link.click();},
    dispose(){disposed=true;cancelAnimationFrame(frameId);events.abort();observer.disconnect();visibility.disconnect();scene.traverse(o=>{if(o.isMesh)o.geometry.dispose();});fittingBody.geometry.dispose();materials.forEach(m=>m.dispose());renderer.dispose();canvas.remove();}
  };
}
