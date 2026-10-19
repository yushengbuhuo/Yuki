import {pathDistance} from './pet-garden-details.js';
import * as T from '../vendor/three/package/build/three.module.js';
import {softShadow,batchStatic} from './pet-art.js';

const loader=new T.TextureLoader();
const atlases=await Promise.all(['grass','leaf'].map(async kind=>{
  const texture=await loader.loadAsync(new URL('../textures/vegetation/'+kind+'-atlas.png',import.meta.url).href);
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}));

// Authoring source for the two local, deterministic botanical atlases.
export function makeBotanicalAtlas(kind){
  const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
  let seed=kind==='grass'?9127:4781;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let variant=0;variant<4;variant++){
    ctx.save();ctx.translate((variant%2)*512,Math.floor(variant/2)*512);
    if(kind==='grass'){
      // Different blade widths, heights and bends; root overlap hides the cards.
      for(let j=0;j<68;j++){
        const x=28+random()*456,y=493-random()*24,h=100+random()*320;
        const lean=(random()-.5)*(100+variant*30),w=3+random()*7,tip=x+lean;
        const g=ctx.createLinearGradient(0,y,0,y-h);g.addColorStop(0,'#747d66');g.addColorStop(.5,'#c1c7a6');g.addColorStop(1,'#f6f2cd');ctx.fillStyle=g;
        ctx.beginPath();ctx.moveTo(x-w,y);ctx.bezierCurveTo(x-w+lean*.05,y-h*.45,tip-lean*.2,y-h*.9,tip,y-h);
        ctx.bezierCurveTo(tip-lean*.17,y-h*.7,x+w+lean*.15,y-h*.25,x+w,y);ctx.closePath();ctx.fill();
      }
    }else{
      // A spray of overlapping pointed oval leaves, not a solid circular blob.
      for(let j=0;j<48;j++){
        const a=random()*Math.PI*2,r=Math.sqrt(random())*175,x=256+Math.cos(a)*r,y=256+Math.sin(a)*r*.87;
        ctx.save();ctx.translate(x,y);ctx.rotate(a*.5+random()*3);
        const len=27+random()*26,w=13+random()*13,v=Math.round(175+random()*64);
        const g=ctx.createLinearGradient(-len,0,len,0);g.addColorStop(0,'rgb('+v+','+v+','+Math.round(v*.87)+')');g.addColorStop(1,'#f4f0d8');ctx.fillStyle=g;
        ctx.beginPath();ctx.moveTo(-len,0);ctx.bezierCurveTo(-len*.4,-w,len*.55,-w,len,0);ctx.bezierCurveTo(len*.45,w,-len*.45,w,-len,0);ctx.fill();
        ctx.strokeStyle='rgba(255,250,215,.13)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-len*.8,0);ctx.quadraticCurveTo(0,-2,len*.85,0);ctx.stroke();ctx.restore();
      }
    }
    ctx.restore();
  }
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function createVegetation({scene,wind,height,trees,mobile,sun,ambient,localLights=[]}){
  const lightPositions=Array.from({length:7},()=>new T.Vector3()),lightColors=Array.from({length:7},()=>new T.Color()),lightRanges=new Float32Array(7);
  let seed=4837;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const [grassAtlas,leafAtlas]=atlases;
  const group=new T.Group();group.name='botanical-meadow';scene.add(group);
  const dummy=new T.Object3D(),chunks=[],canopies=[],resources=[],leafBatches=new Map(),shadowLobes=[];
  const sunDirection=new T.Vector3(),lightTarget=new T.Vector3(),frustum=new T.Frustum(),viewProjection=new T.Matrix4();
  const shadowTexel=new T.Vector2(1/1024,1/1024);
  function material(atlas,leaf=false){
    return new T.ShaderMaterial({side:T.DoubleSide,uniforms:{sunDirection:{value:sunDirection},sunShadowMap:{value:null},sunShadowMatrix:{value:sun.shadow.matrix},shadowTexel:{value:shadowTexel},shadowReady:{value:0},shadowStrength:{value:.6},localPosition:{value:lightPositions},localColor:{value:lightColors},localRange:{value:lightRanges},dayTint:{value:new T.Color('#ffffff')},atlas:{value:atlas},clock:wind,leaf:{value:leaf?1:0},fogColor:{value:new T.Color('#dce8db')},fogNear:{value:40},fogFar:{value:75}},
      vertexShader:`
        uniform float clock;uniform float leaf;uniform vec3 sunDirection;uniform mat4 sunShadowMatrix;attribute vec3 tint;attribute vec3 crownNormal;attribute float variant;
        varying vec3 vWorld;varying vec2 vUv;varying vec3 vTint;varying float vLight;varying float vHeight;varying float vDepth;varying vec4 vSunShadow;
        void main(){
          vUv=(uv+vec2(mod(variant,2.),floor(variant/2.)))*.5;vTint=tint;vHeight=uv.y;
          vec4 center=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
          vec3 p=position;
          float wave=sin(center.x*.42+center.z*.31-clock*.85)+sin(center.x*.19-center.z*.55-clock*.55)*.45;
          vec4 world;
          if(leaf>.5){
            float sx=length(instanceMatrix[0].xyz),sy=length(instanceMatrix[1].xyz);
            vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
            vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
            world=vec4(center.xyz+right*p.x*sx+up*p.y*sy,1.);
            world.x+=wave*.075;world.y+=sin(clock*1.1+center.x)*.023;
            float diffuse=dot(normalize(crownNormal),sunDirection);
            vLight=.61+.39*smoothstep(-.5,.85,diffuse);
          }else{
            p.x+=wave*p.y*p.y*.42;p.z+=sin(clock*.7+center.z*.45)*p.y*p.y*.18;
            world=modelMatrix*instanceMatrix*vec4(p,1.);
            vLight=.88+.12*max(0.,dot(normalize(crownNormal),sunDirection));
          }
          vWorld=world.xyz;vSunShadow=sunShadowMatrix*vec4(world.xyz+vec3(0.,.035,0.),1.);vec4 view=viewMatrix*world;
          vDepth=-view.z;gl_Position=projectionMatrix*view;
        }`,
      fragmentShader:`
        uniform sampler2D sunShadowMap;uniform vec2 shadowTexel;uniform float shadowReady;uniform float shadowStrength;
        uniform vec3 localPosition[7];uniform vec3 localColor[7];uniform float localRange[7];uniform vec3 dayTint;uniform sampler2D atlas;uniform float leaf;uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;
        varying vec3 vWorld;varying vec2 vUv;varying vec3 vTint;varying float vLight;varying float vHeight;varying float vDepth;varying vec4 vSunShadow;
        #include <packing>
        float shadowTap(vec2 uv,float depth){return step(depth,unpackRGBAToDepth(texture2D(sunShadowMap,uv)));}
        float grassShadow(){
          if(shadowReady<.5)return 1.;
          vec3 p=vSunShadow.xyz/vSunShadow.w;
          if(p.x<=0.||p.x>=1.||p.y<=0.||p.y>=1.||p.z<=0.||p.z>=1.)return 1.;
          float depth=p.z-.0012;
          ${mobile?'return shadowTap(p.xy,depth);':`
          vec2 texel=shadowTexel*.85;
          return .25*(shadowTap(p.xy+texel,depth)+shadowTap(p.xy-texel,depth)+shadowTap(p.xy+vec2(texel.x,-texel.y),depth)+shadowTap(p.xy+vec2(-texel.x,texel.y),depth));`}
        }
        void main(){
          vec4 tex=texture2D(atlas,vUv);if(tex.a<.38)discard;
          float detail=mix(.82,1.08,tex.r);
          float root=mix(.76,1.06,smoothstep(0.,.85,vHeight));
          vec3 col=vTint*detail*vLight*mix(root,1.,leaf)*dayTint;
          if(leaf<.5)col*=mix(1.,.30+.70*grassShadow(),shadowStrength);
          for(int i=0;i<7;i++){float d=distance(vWorld,localPosition[i]);float fall=pow(max(0.,1.-d/max(.01,localRange[i])),2.)/(1.+d*d);col+=vTint*localColor[i]*fall*2.4;}
          col=mix(col,fogColor,smoothstep(fogNear,fogFar,vDepth));
          // Reserved opaque-target alpha: skip the added near contour, while
          // retaining the original depth edges and full RGB vegetation.
          gl_FragColor=vec4(col,0.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
  }
  const grassMat=material(grassAtlas),leafMat=material(leafAtlas,true);resources.push(grassMat,leafMat);
  // Three curved intersecting cards per clump. Subdivision anchors bending at the root.
  const pos=[],uv=[],indices=[];
  for(let face=0;face<3;face++){
    const a=face*Math.PI/3,base=pos.length/3;
    for(let row=0;row<=2;row++)for(let side=0;side<2;side++){
      const y=row/2,x=(side-.5)*.85,bend=y*y*.1;
      pos.push(Math.cos(a)*x+Math.sin(a)*bend,y,Math.sin(a)*x-Math.cos(a)*bend);uv.push(side,y);
    }
    for(let row=0;row<2;row++){const b=base+row*2;indices.push(b,b+1,b+2,b+1,b+3,b+2);}
  }
  const tuft=new T.BufferGeometry();tuft.setAttribute('position',new T.Float32BufferAttribute(pos,3));tuft.setAttribute('uv',new T.Float32BufferAttribute(uv,2));tuft.setIndex(indices);
  // The outer meadow uses two unsubdivided cards (4 triangles instead of 12).
  const farPos=[],farUv=[],farIndices=[];
  for(let face=0;face<2;face++){const a=face*Math.PI/2,b=farPos.length/3;for(const [x,y] of [[-.5,0],[.5,0],[-.5,1],[.5,1]]){farPos.push(Math.cos(a)*x,y,Math.sin(a)*x);farUv.push(x+.5,y);}farIndices.push(b,b+1,b+2,b+1,b+3,b+2);}
  const farTuft=new T.BufferGeometry();farTuft.setAttribute('position',new T.Float32BufferAttribute(farPos,3));farTuft.setAttribute('uv',new T.Float32BufferAttribute(farUv,2));farTuft.setIndex(farIndices);
  const card=new T.PlaneGeometry(1,1);resources.push(tuft,farTuft,card);
  function attributes(geo,tints,normals,variants){geo.setAttribute('tint',new T.InstancedBufferAttribute(new Float32Array(tints),3));geo.setAttribute('crownNormal',new T.InstancedBufferAttribute(new Float32Array(normals),3));geo.setAttribute('variant',new T.InstancedBufferAttribute(new Float32Array(variants),1));}
  let grassCount=0,leafCount=0;
  const sectorSize=8;
  for(let gx=-4;gx<=4;gx++)for(let gz=-4;gz<=3;gz++){
    const centerX=gx*sectorSize,centerZ=gz*sectorSize;
    if(Math.hypot(centerX,centerZ+3)>38)continue;
    const items=[],tints=[],normals=[],variants=[],density=mobile?660:1060;
    for(let i=0;i<density;i++){
      const x=centerX+(random()-.5)*sectorSize,z=centerZ+(random()-.5)*sectorSize;
      const radius=Math.hypot(x,(z+3)*.94),patch=(Math.sin(x*.48+z*.27)+Math.cos(z*.45-x*.18))*.5;
      const edge=1.-T.MathUtils.smoothstep(radius,28+patch*2.5,36+patch*2.5);
      const densityFalloff=radius<14?1:radius<24?.34:.14;
      if(random()>edge*densityFalloff*(.8+patch*.2))continue;
      if(Math.hypot((x-5.3)/3.65,(z-1.5)/2.65)<1||Math.hypot((x+3.7)/2.2,(z+3.6)/1.85)<1||(Math.abs(x-1.1)<1.1&&Math.abs(z+5.4)<.95))continue;
      if(pathDistance(x,z)<.62)continue;
      const clearing=T.MathUtils.smoothstep(Math.hypot(x,z-1),1.05,2.2);
      if(clearing<.1)continue;
      const outer=radius>18;
      items.push({x,z,h:(.25+random()*.2+patch*.035)*clearing*(outer?.82:1),s:(.8+random()*.55)*(mobile?1.16:1)*(outer?1.3:1)});
      const c=new T.Color().setRGB(.17+patch*.025,.30+patch*.034,.075+patch*.016);tints.push(c.r,c.g,c.b);
      const n=new T.Vector3(height(x-.1,z)-height(x+.1,z),.2,height(x,z-.1)-height(x,z+.1)).normalize();normals.push(n.x,n.y,n.z);variants.push(Math.floor(random()*4));
    }
    if(!items.length)continue;
    const geo=(Math.hypot(centerX,centerZ+3)>18?farTuft:tuft).clone();attributes(geo,tints,normals,variants);
    const mesh=new T.InstancedMesh(geo,grassMat,items.length);mesh.name='grass-sector';
    items.forEach((o,i)=>{dummy.position.set(o.x,height(o.x,o.z)-.018,o.z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.set(o.s,o.h,o.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.4;group.add(mesh);chunks.push({mesh,count:items.length,wanted:items.length,center:new T.Vector3(centerX,0,centerZ)});grassCount+=items.length;resources.push(geo);
  }
  const bark=new T.MeshStandardMaterial({color:'#99836a',roughness:1});
  function branch(points,radius,distant=false){
    const rings=distant?6:12,sides=distant?5:7;
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),geo=new T.TubeGeometry(curve,rings,radius,sides,false);
    // Taper along the tube's local rings.
    const p=geo.attributes.position;
    for(let ring=0;ring<=rings;ring++){const center=curve.getPointAt(ring/rings),scale=1-ring/rings*.68;for(let j=0;j<=sides;j++){const i=ring*(sides+1)+j;p.setXYZ(i,center.x+(p.getX(i)-center.x)*scale,center.y+(p.getY(i)-center.y)*scale,center.z+(p.getZ(i)-center.z)*scale);}}
    geo.computeVertexNormals();const mesh=new T.Mesh(geo,bark);mesh.castShadow=true;group.add(mesh);resources.push(geo);
  }
  trees.forEach(([x,z,s],treeIndex)=>{
    const base=height(x,z),lean=(treeIndex%2?-.22:.2)*s,distant=treeIndex>=6;
    // Broad tree shade now comes from the sun's real shadow map. A small
    // contact patch is only needed at the trunk, not under the entire crown.
    if(!distant){const shadow=softShadow(1.7*s,.13);shadow.position.set(x,base+.018,z);group.add(shadow);resources.push(shadow.geometry,shadow.material,shadow.material.map);}
    branch([[x,base,z],[x+lean*.3,base+1.1*s,z+.05],[x+lean,base+2.3*s,z-.08],[x+lean*.6,base+3.7*s,z]],.23*s,distant);
    const lobes=[];
    for(let j=0;j<9;j++){
      const a=j*2.4,r=j===0?0:1.03*s,cy=(j===0?4.55:3.65+Math.sin(j*1.7)*.38)*s;
      const center=new T.Vector3(x+Math.cos(a)*r,base+cy,z+Math.sin(a)*r*.85);
      lobes.push({center,radius:(j===0?1.05:.84+random()*.25)*s});
      if(j<(distant?3:6))branch([[x+lean,base+1.7*s,z],[x+Math.cos(a)*.45*s,base+2.7*s,z+Math.sin(a)*.4*s],center.toArray()],.095*s,distant);
    }
    const cards=[],tints=[],normals=[],variants=[],perLobe=distant?(mobile?16:24):(mobile?48:76);
    lobes.forEach(({center,radius},j)=>{
      for(let i=0;i<perLobe;i++){
        const a=random()*Math.PI*2,ny=random()*2-1,rr=Math.sqrt(1-ny*ny),n=new T.Vector3(rr*Math.cos(a),ny,rr*Math.sin(a));
        const dist=radius*(.72+random()*.28),p=center.clone().add(new T.Vector3(n.x*dist,n.y*dist*.85,n.z*dist));
        cards.push({p,size:(distant?.92+random()*.32:.63+random()*.27)*s});
        const lit=T.MathUtils.clamp(((p.y-base)/s-2.5)/3,0,1),shift=Math.sin(j*1.9)*.018;
        tints.push(.095+lit*.15+shift,.205+lit*.20+shift,.065+lit*.07);normals.push(n.x,n.y,n.z);variants.push(Math.floor(random()*4));
      }
    });
    // Distant trees share spatial batches rather than adding a draw per tree.
    const key=distant?'forest-'+Math.floor(x/16)+':'+Math.floor(z/16):'hero-'+treeIndex;
    if(!leafBatches.has(key))leafBatches.set(key,{cards:[],tints:[],normals:[],variants:[],distant});
    const batch=leafBatches.get(key);batch.cards.push(...cards);batch.tints.push(...tints);batch.normals.push(...normals);batch.variants.push(...variants);
    // One opaque, low-poly volume per main crown lobe, three per distant crown.
    for(const [j,lobe] of lobes.entries())if(!distant||j===0||j===3||j===6)shadowLobes.push(lobe);
  });
  for(const batch of leafBatches.values()){
    const {cards,tints,normals,variants}=batch;
    // A reduced instance prefix must thin every tree, rather than hide the
    // last trees in a shared batch. Keep each card's attributes together.
    for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];[variants[i],variants[j]]=[variants[j],variants[i]];for(let k=0;k<3;k++){[tints[i*3+k],tints[j*3+k]]=[tints[j*3+k],tints[i*3+k]];[normals[i*3+k],normals[j*3+k]]=[normals[j*3+k],normals[i*3+k]];}}
    const geo=card.clone();attributes(geo,tints,normals,variants);
    const mesh=new T.InstancedMesh(geo,leafMat,cards.length);mesh.name='leaf-sprays';
    cards.forEach((o,i)=>{dummy.position.copy(o.p);dummy.rotation.set(0,0,0);dummy.scale.setScalar(o.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;group.add(mesh);leafCount+=cards.length;canopies.push({mesh,count:cards.length,distant:batch.distant});resources.push(geo);
  }
  // No alpha leaf shadow pass: all crowns cast through one instanced draw.
  const proxyGeometry=new T.IcosahedronGeometry(1,1),proxyMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,shadowSide:T.FrontSide});
  const crownShadows=new T.InstancedMesh(proxyGeometry,proxyMaterial,shadowLobes.length);crownShadows.name='canopy-shadow-volumes';crownShadows.castShadow=true;
  shadowLobes.forEach(({center,radius},i)=>{dummy.position.copy(center);dummy.rotation.set(0,0,0);dummy.scale.set(radius*.92,radius*.78,radius*.92);dummy.updateMatrix();crownShadows.setMatrixAt(i,dummy.matrix);});
  crownShadows.computeBoundingSphere();group.add(crownShadows);resources.push(proxyGeometry,proxyMaterial);
  batchStatic(group);
  group.traverse(o=>{if(o.geometry&&!resources.includes(o.geometry))resources.push(o.geometry);if(o.isInstancedMesh)resources.push(o);});
  let level=1,activeGrass=0,activeLeaves=leafCount;
  return {grassCount,leafCount,grassAtlas,leafAtlas,
    setDaylight(tint){for(const mat of [grassMat,leafMat])mat.uniforms.dayTint.value.copy(tint);},
    update(camera,fog){
      sun.getWorldPosition(sunDirection);sun.target.getWorldPosition(lightTarget);sunDirection.sub(lightTarget).normalize();
      const map=sun.shadow.map;
      grassMat.uniforms.sunShadowMap.value=map?.texture||null;grassMat.uniforms.shadowReady.value=map?1:0;
      shadowTexel.set(1/sun.shadow.mapSize.x,1/sun.shadow.mapSize.y);
      grassMat.uniforms.shadowStrength.value=T.MathUtils.clamp(sun.intensity/(sun.intensity+ambient.intensity*.8),.25,.8);
      for(let i=0;i<7;i++){const l=localLights[i];if(l){lightPositions[i].copy(l.position);lightColors[i].copy(l.color).multiplyScalar(l.intensity);lightRanges[i]=l.distance;}}
      for(const mat of [grassMat,leafMat]){mat.uniforms.fogColor.value.copy(fog.color);mat.uniforms.fogNear.value=fog.near;mat.uniforms.fogFar.value=fog.far;}
      camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
      let wanted=0;
      for(const chunk of chunks){
        const d=camera.position.distanceTo(chunk.center),fraction=d>50?.20:d>38?.40:d>28?.7:1;
        chunk.mesh.visible=d<60&&frustum.intersectsObject(chunk.mesh);
        chunk.wanted=chunk.mesh.visible?Math.max(1,Math.floor(chunk.count*fraction*level)):0;wanted+=chunk.wanted;
      }
      const budget=(mobile?6500:11500)*level,scale=Math.min(1,budget/Math.max(1,wanted));activeGrass=0;
      for(const chunk of chunks){chunk.mesh.count=Math.floor(chunk.wanted*scale);activeGrass+=chunk.mesh.count;}
      activeLeaves=0;
      for(const canopy of canopies){
        const d=camera.position.distanceTo(canopy.mesh.boundingSphere.center),fraction=canopy.distant?(d>50?.5:d>38?.75:1):1;
        canopy.mesh.count=Math.floor(canopy.count*fraction);canopy.mesh.visible=frustum.intersectsObject(canopy.mesh);
        if(canopy.mesh.visible)activeLeaves+=canopy.mesh.count;
      }
    },
    carryVolumes:shadowLobes.map(({center,radius})=>({center,rx:radius*.92,ry:radius*.78,rz:radius*.92,bottom:center.y-radius*.78,top:center.y+radius*.78})),
    reduce(){level=Math.max(.65,level-.15);},
    diagnostics:()=>({trees:trees.length,grassSectors:chunks.length,grassTotal:grassCount,grassActive:activeGrass,grassBudget:Math.floor((mobile?6500:11500)*level),leafBatches:canopies.length,leavesActive:activeLeaves,shadowVolumes:shadowLobes.length,grassReceivesShadow:grassMat.uniforms.shadowReady.value===1,shadowMapSize:sun.shadow.mapSize.x,shadowTaps:mobile?1:4,quality:level}),
    dispose(){group.removeFromParent();new Set(resources).forEach(r=>r.dispose());grassAtlas.dispose();leafAtlas.dispose();bark.dispose();}
  };
}
