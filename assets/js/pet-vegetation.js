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

export function createVegetation({scene,wind,height,trees,mobile}){
  let seed=4837;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const [grassAtlas,leafAtlas]=atlases;
  const group=new T.Group();group.name='botanical-meadow';scene.add(group);
  const dummy=new T.Object3D(),chunks=[],canopies=[],resources=[];
  function material(atlas,leaf=false){
    return new T.ShaderMaterial({side:T.DoubleSide,uniforms:{dayTint:{value:new T.Color('#ffffff')},atlas:{value:atlas},clock:wind,leaf:{value:leaf?1:0},treeCenters:{value:trees.map(([x,z,s])=>new T.Vector3(x+1.1*s,z-.65*s,s))},fogColor:{value:new T.Color('#dce8db')},fogNear:{value:40},fogFar:{value:75}},
      vertexShader:`
        uniform float clock;uniform float leaf;uniform vec3 treeCenters[6];attribute vec3 tint;attribute vec3 crownNormal;attribute float variant;
        varying vec2 vUv;varying vec3 vTint;varying float vLight;varying float vHeight;varying float vDepth;
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
            float diffuse=dot(normalize(crownNormal),normalize(vec3(-.5,.85,.3)));
            vLight=.61+.39*smoothstep(-.5,.85,diffuse);
          }else{
            p.x+=wave*p.y*p.y*.42;p.z+=sin(clock*.7+center.z*.45)*p.y*p.y*.18;
            world=modelMatrix*instanceMatrix*vec4(p,1.);vLight=.97+sin(center.x*.29+center.z*.23)*.03;
            for(int i=0;i<6;i++){vec2 d=(center.xz-treeCenters[i].xy)/(treeCenters[i].z*1.5);vLight*=1.-exp(-dot(d,d))*.26;}
          }
          vec4 view=viewMatrix*world;
          vDepth=-view.z;gl_Position=projectionMatrix*view;
        }`,
      fragmentShader:`
        uniform vec3 dayTint;uniform sampler2D atlas;uniform float leaf;uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;
        varying vec2 vUv;varying vec3 vTint;varying float vLight;varying float vHeight;varying float vDepth;
        void main(){
          vec4 tex=texture2D(atlas,vUv);if(tex.a<.38)discard;
          float detail=mix(.82,1.08,tex.r);
          float root=mix(.76,1.06,smoothstep(0.,.85,vHeight));
          vec3 col=vTint*detail*vLight*mix(root,1.,leaf)*dayTint;
          col=mix(col,fogColor,smoothstep(fogNear,fogFar,vDepth));
          gl_FragColor=vec4(col,1.);
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
  const card=new T.PlaneGeometry(1,1);resources.push(tuft,card);
  function attributes(geo,tints,normals,variants){geo.setAttribute('tint',new T.InstancedBufferAttribute(new Float32Array(tints),3));geo.setAttribute('crownNormal',new T.InstancedBufferAttribute(new Float32Array(normals),3));geo.setAttribute('variant',new T.InstancedBufferAttribute(new Float32Array(variants),1));}
  let grassCount=0,leafCount=0;
  for(let gx=-3;gx<=3;gx++)for(let gz=-3;gz<=2;gz++){
    const items=[],tints=[],normals=[],variants=[],density=mobile?165:265;
    for(let i=0;i<density;i++){
      const x=gx*4+(random()-.5)*4,z=gz*4+(random()-.5)*4;
      if(Math.hypot((x-5.3)/3.65,(z-1.5)/2.65)<1||Math.hypot((x+3.7)/2.2,(z+3.6)/1.85)<1)continue;
      const clearing=T.MathUtils.smoothstep(Math.hypot(x,z-1),1.05,2.2);
      if(clearing<.1)continue;
      const patch=(Math.sin(x*.48+z*.27)+Math.cos(z*.45-x*.18))*.5;
      items.push({x,z,h:(.25+random()*.2+patch*.035)*clearing,s:(.8+random()*.55)*(mobile?1.16:1)});
      const c=new T.Color().setRGB(.17+patch*.025,.30+patch*.034,.075+patch*.016);tints.push(c.r,c.g,c.b);normals.push(0,1,0);variants.push(Math.floor(random()*4));
    }
    const geo=tuft.clone();attributes(geo,tints,normals,variants);
    const mesh=new T.InstancedMesh(geo,grassMat,items.length);mesh.name='grass-sector';
    items.forEach((o,i)=>{dummy.position.set(o.x,height(o.x,o.z)-.018,o.z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.set(o.s,o.h,o.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.4;group.add(mesh);chunks.push({mesh,count:items.length,center:new T.Vector3(gx*4,0,gz*4)});grassCount+=items.length;resources.push(geo);
  }
  const bark=new T.MeshStandardMaterial({color:'#99836a',roughness:1});
  function branch(points,radius){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),geo=new T.TubeGeometry(curve,12,radius,7,false);
    // Taper along the tube's local rings.
    const p=geo.attributes.position;
    for(let ring=0;ring<=12;ring++){const center=curve.getPointAt(ring/12),scale=1-ring/12*.68;for(let j=0;j<=7;j++){const i=ring*8+j;p.setXYZ(i,center.x+(p.getX(i)-center.x)*scale,center.y+(p.getY(i)-center.y)*scale,center.z+(p.getZ(i)-center.z)*scale);}}
    geo.computeVertexNormals();const mesh=new T.Mesh(geo,bark);mesh.castShadow=true;group.add(mesh);resources.push(geo);
  }
  trees.forEach(([x,z,s],treeIndex)=>{
    const base=height(x,z),lean=(treeIndex%2?-.22:.2)*s;
    const shadow=softShadow(6*s,.19);shadow.position.set(x+1.1*s,height(x+1.1*s,z-.65*s)+.018,z-.65*s);group.add(shadow);
    resources.push(shadow.geometry,shadow.material,shadow.material.map);
    branch([[x,base,z],[x+lean*.3,1.1*s,z+.05],[x+lean,2.3*s,z-.08],[x+lean*.6,3.7*s,z]],.23*s);
    const lobes=[];
    for(let j=0;j<9;j++){
      const a=j*2.4,r=j===0?0:1.03*s,cy=(j===0?4.55:3.65+Math.sin(j*1.7)*.38)*s;
      const center=new T.Vector3(x+Math.cos(a)*r,cy,z+Math.sin(a)*r*.85);
      lobes.push({center,radius:(j===0?1.05:.84+random()*.25)*s});
      if(j<6)branch([[x+lean,1.7*s,z],[x+Math.cos(a)*.45*s,2.7*s,z+Math.sin(a)*.4*s],center.toArray()],.095*s);
    }
    const cards=[],tints=[],normals=[],variants=[],perLobe=mobile?48:76;
    lobes.forEach(({center,radius},j)=>{
      for(let i=0;i<perLobe;i++){
        const a=random()*Math.PI*2,ny=random()*2-1,rr=Math.sqrt(1-ny*ny),n=new T.Vector3(rr*Math.cos(a),ny,rr*Math.sin(a));
        const dist=radius*(.72+random()*.28),p=center.clone().add(new T.Vector3(n.x*dist,n.y*dist*.85,n.z*dist));
        cards.push({p,size:(.63+random()*.27)*s});
        const lit=T.MathUtils.clamp((p.y/s-2.5)/3,0,1),shift=Math.sin(j*1.9)*.018;
        tints.push(.095+lit*.15+shift,.205+lit*.20+shift,.065+lit*.07);normals.push(n.x,n.y,n.z);variants.push(Math.floor(random()*4));
      }
    });
    const geo=card.clone();attributes(geo,tints,normals,variants);
    const mesh=new T.InstancedMesh(geo,leafMat,cards.length);mesh.name='leaf-sprays';
    cards.forEach((o,i)=>{dummy.position.copy(o.p);dummy.rotation.set(0,0,0);dummy.scale.setScalar(o.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;group.add(mesh);leafCount+=cards.length;canopies.push(mesh);resources.push(geo);
  });
  batchStatic(group);
  group.traverse(o=>{if(o.geometry&&!resources.includes(o.geometry))resources.push(o.geometry);});
  let level=1;
  return {grassCount,leafCount,grassAtlas,leafAtlas,
    setDaylight(tint){for(const mat of [grassMat,leafMat])mat.uniforms.dayTint.value.copy(tint);},
    update(camera,fog){
      for(const mat of [grassMat,leafMat]){mat.uniforms.fogColor.value.copy(fog.color);mat.uniforms.fogNear.value=fog.near;mat.uniforms.fogFar.value=fog.far;}
      for(const chunk of chunks){
        const d=camera.position.distanceTo(chunk.center),fraction=mobile?1:d>43?.38:d>32?.65:1;
        chunk.mesh.count=Math.max(1,Math.floor(chunk.count*fraction*level));
      }
    },
    reduce(){level=Math.max(.65,level-.15);},
    dispose(){group.removeFromParent();resources.forEach(r=>r.dispose());grassAtlas.dispose();leafAtlas.dispose();bark.dispose();}
  };
}
