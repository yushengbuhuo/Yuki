import * as T from '../vendor/three/package/build/three.module.js';
import {painted,paintTexture,archGeometry,softShadow,batchStatic} from './pet-art.js';

export function createPetRoom(onExit,onAction){
  const scene=new T.Scene();scene.background=new T.Color('#e4dbca');
  const camera=new T.PerspectiveCamera(36,1,.1,40);
  const plaster=painted('#efe1c9'),sage=painted('#91a997'),timber=painted('#c4a27d','wood'),cream=painted('#fff0d4'),dark=painted('#8f6b4c','wood');
  const terracotta=painted('#c78b73'),linen=painted('#e2c4a7','fabric'),leafMat=painted('#809a6d');
  const cube=new T.BoxGeometry(1,1,1),ball=new T.SphereGeometry(1,24,16);
  function put(geo,mat,p,s=[1,1,1],parent=scene){const m=new T.Mesh(geo,mat);m.position.set(...p);m.scale.set(...s);m.receiveShadow=true;m.castShadow=true;parent.add(m);return m;}
  const ambient=new T.HemisphereLight('#fff1dc','#8c9d91',1.8);scene.add(ambient);
  const sun=new T.DirectionalLight('#ffe0ae',3.2);sun.position.set(-3.8,6,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.radius=3;
  Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:20});sun.shadow.normalBias=.022;scene.add(sun);
  const fill=new T.DirectionalLight('#cfddd7',.7);fill.position.set(4,3,1);scene.add(fill);
  put(cube,plaster,[0,3,-3],[14,6,.15]);
  put(cube,sage,[0,.57,-2.87],[14,1.14,.12]);
  put(cube,cream,[0,1.16,-2.75],[14,.07,.18]);
  put(cube,dark,[0,.075,-2.75],[14,.15,.18]);
  for(let x=-6.8;x<7;x+=.62)put(cube,sage,[x,.57,-2.78],[.035,1.05,.07]);
  const floorMat=painted('#d0af88','wood');floorMat.map=paintTexture('wood').clone();floorMat.map.repeat.set(4,3);floorMat.map.needsUpdate=true;
  put(cube,floorMat,[0,-.13,1],[16,.25,16]);
  // Visible joinery and ceiling beams frame the room without crowding the pet.
  put(cube,dark,[0,4.18,-2.65],[14,.16,.3]);for(const x of [-4.7,4.7])put(cube,timber,[x,2.1,-2.7],[.15,4.2,.23]);
  const rug=put(new T.CircleGeometry(1,96),painted('#e9cdb1','rug'),[0,.019,.38],[2.4,1.68,1]);rug.rotation.x=-Math.PI/2;rug.castShadow=false;
  const fringe=new T.InstancedMesh(cube,linen,100),dummy=new T.Object3D();
  for(let i=0;i<100;i++){const a=i/100*Math.PI*2;dummy.position.set(Math.cos(a)*2.42,.019,.38+Math.sin(a)*1.7);dummy.rotation.set(0,-a,0);dummy.scale.set(.09,.009,.014);dummy.updateMatrix();fringe.setMatrixAt(i,dummy.matrix);}scene.add(fringe);
  const contact=softShadow(4.5,.28);contact.position.set(0,.031,.26);contact.scale.y=.73;scene.add(contact);
  // Arched painted view: layered hills, framed by real curved geometry.
  put(archGeometry(2.3,2.45,.12),timber,[-2.65,1.35,-2.72]);
  const sky=new T.MeshBasicMaterial({color:'#d8e5d8'});
  put(archGeometry(2.08,2.24,.025),sky,[-2.65,1.43,-2.56]).castShadow=false;
  const skyOrb=new T.MeshBasicMaterial({color:'#fff0bd'});put(ball,skyOrb,[-3.02,2.95,-2.49],[.22,.22,.035]).castShadow=false;
  const hills=[];for(const [x,y,sx,sy,color] of [[-3,1.75,.6,.32,'#afc7ad'],[-2.25,1.75,.57,.42,'#9ab99f'],[-2.63,1.55,.85,.25,'#84a891']]){const material=new T.MeshBasicMaterial({color});hills.push({material,base:material.color.clone()});put(ball,material,[x,y,-2.48],[sx,sy,.018]).castShadow=false;}
  put(cube,cream,[-2.65,2.46,-2.39],[.065,1.96,.08]);put(cube,cream,[-2.65,2.35,-2.39],[2.09,.065,.08]);
  put(cube,timber,[-2.65,1.31,-2.35],[2.52,.13,.6]);
  // Curved, hemmed linen folds rather than flat curtain blocks.
  for(const side of [-1,1]){
    const g=new T.PlaneGeometry(.58,2.46,20,26),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),f=(y+1.23)/2.46;p.setXYZ(i,x+side*Math.sin(f*Math.PI)*.12,y,Math.sin((x+.29)*Math.PI*12)*.055);}
    g.computeVertexNormals();const cloth=linen.clone();cloth.side=T.DoubleSide;
    put(g,cloth,[-2.65+side*1.16,2.45,-2.25]);
  }
  put(cube,dark,[-2.65,3.74,-2.26],[2.92,.045,.045]);
  // Broad translucent painted light pools are inexpensive and deliberately soft.
  const patchGeo=new T.PlaneGeometry(2.2,2.7),patchMat=new T.MeshBasicMaterial({color:'#ffdfa0',transparent:true,opacity:.12,depthWrite:false});
  const patch=put(patchGeo,patchMat,[-2.05,.012,.2]);patch.rotation.set(-Math.PI/2,0,-.38);patch.castShadow=false;
  for(const x of [-.52,.52]){const p=put(new T.PlaneGeometry(.92,1.18),patchMat,[-2.05+x,.014,.2]);p.rotation.set(-Math.PI/2,0,-.38);p.castShadow=false;}
  const exit=new T.Group();scene.add(exit);
  const frame=put(archGeometry(1.4,2.87,.16),cream,[0,0,0],[1,1,1],exit);
  const door=put(archGeometry(1.17,2.66,.1),timber,[0,.06,.17],[1,1,1],exit);door.userData.activate=onExit;
  const panel=put(archGeometry(.94,2.35,.025),sage,[0,.17,.295],[1,1,1],exit);panel.userData.activate=onExit;
  for(const x of [-.31,0,.31])put(cube,sage,[x,1.17,.34],[.016,1.78,.018],exit);
  const knob=put(ball,painted('#dab377'),[-.36,1.24,.41],[.065,.065,.065],exit);knob.userData.activate=onExit;
  function label(text,width,parent=scene){
    const c=document.createElement('canvas');c.width=768;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle='#ecdec3';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#bea783';ctx.lineWidth=7;ctx.strokeRect(13,13,742,166);ctx.fillStyle='#6c6755';ctx.textBaseline='middle';ctx.textAlign='center';ctx.font='54px sans-serif';ctx.fillText(text,384,96,710);
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
    const m=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshStandardMaterial({map:t,roughness:1}));parent.add(m);return m;
  }
  const exitLabel=label('去庄园 →',.99,exit);exitLabel.position.set(0,2.16,.365);exitLabel.userData.activate=onExit;
  const title=label('有你在，就是好天气',2.05);title.position.set(.05,3.35,-2.71);scene.remove(title);title.geometry.dispose();title.material.map.dispose();title.material.dispose();
  // A small picture rail with a sun print, books and a hand-thrown vase.
  put(cube,timber,[.1,2.65,-2.54],[2.1,.095,.38]);
  const bookColors=['#b7836c','#a7b5a0','#dbc797'];
  for(let i=0;i<5;i++){const b=put(cube,painted(bookColors[i%3],'fabric'),[-.75+i*.13,2.87,-2.51],[.1,.34+(i%2)*.09,.2]);b.rotation.z=i===4?-.13:0;}
  put(new T.CylinderGeometry(.11,.16,.29,20),terracotta,[.78,2.83,-2.5]);put(ball,leafMat,[.78,3.09,-2.5],[.16,.2,.1]);
  const plants=[];
  for(const side of [-1,1]){
    const plant=new T.Group();scene.add(plant);plants.push(plant);
    put(new T.CylinderGeometry(.25,.17,.42,24),side<0?terracotta:cream,[0,.21,0],[1,1,1],plant);
    put(new T.TorusGeometry(.235,.035,8,24),side<0?terracotta:cream,[0,.42,0],[1,1,1],plant).rotation.x=-Math.PI/2;
    put(new T.CylinderGeometry(.014,.024,1.06,8),leafMat,[0,.94,0],[1,1,1],plant);
    for(let i=0;i<9;i++){
      const a=i*2.4,leaf=put(ball,leafMat,[Math.cos(a)*.18,.56+i*.11,Math.sin(a)*.1],[.24,.035,.1],plant);leaf.rotation.set(.15, -a,Math.cos(a)*.48);
    }
    const shadow=softShadow(.9,.18);shadow.position.y=.012;plant.add(shadow);
  }
  const cushion=put(ball,painted('#9bada1','fabric'),[-3.03,.21,.8],[.79,.23,.61]);cushion.userData.activate=()=>onAction('sleep');
  const piping=put(new T.TorusGeometry(1,.016,6,64),cream,[-3.03,.23,.8],[.76,.58,.8]);piping.rotation.x=-Math.PI/2;
  put(ball,linen,[-3.03,.41,.8],[.055,.025,.055]);
  const bowl=put(new T.TorusGeometry(.27,.05,10,32),cream,[2.24,.105,1]);bowl.rotation.x=-Math.PI/2;bowl.userData.activate=()=>onAction('feed');
  put(new T.CylinderGeometry(.27,.2,.1,24),terracotta,[2.24,.05,1]);
  const berries=new T.InstancedMesh(ball,painted('#bb7e56'),7);
  for(let i=0;i<7;i++){dummy.position.set(2.24+Math.cos(i*2)*.12,.11,1+Math.sin(i*2)*.12);dummy.scale.setScalar(.065);dummy.rotation.set(0,0,0);dummy.updateMatrix();berries.setMatrixAt(i,dummy.matrix);}scene.add(berries);
  put(cube,timber,[-3.95,1.05,-1.1],[.9,.12,.65]);for(const x of [-4.28,-3.62])put(cube,dark,[x,.5,-1.1],[.065,.95,.065]);
  const shade=painted('#f3d9a6','fabric');shade.emissive.set('#efb666');shade.emissiveIntensity=.16;
  put(new T.CylinderGeometry(.24,.38,.46,32),shade,[-3.95,1.87,-1.1]);put(new T.CylinderGeometry(.025,.025,.62,12),dark,[-3.95,1.44,-1.1]);put(ball,dark,[-3.95,1.14,-1.1],[.19,.045,.19]);
  const lamp=new T.PointLight('#ffd394',2.5,4,2);lamp.position.set(-3.95,1.7,-.85);scene.add(lamp);
  const targets=[door,panel,knob,exitLabel,cushion,bowl];
  batchStatic(scene,targets);
  function resize(width,height){
    const aspect=width/height;camera.aspect=aspect;
    const distance=Math.max(6.5,2.05/(Math.tan(Math.PI/10)*aspect));
    camera.position.set(0,1.85+distance*.055,distance);camera.lookAt(0,1.3,.25);camera.updateProjectionMatrix();
    const narrow=aspect<1.35;exit.position.set(aspect<.65?1.36:narrow?2.05:3.05,0,-2.66);
    plants[0].position.set(narrow?-1.72:-2.24,0,narrow?-1.05:.08);plants[1].position.set(narrow?1.75:2.26,0,narrow?-1.18:-.35);
  }
  return {scene,camera,targets,resize,exit,door,lighting:{ambient,sun,fill,sky,skyOrb,hills,shade,lamp,patchMat}};
}
