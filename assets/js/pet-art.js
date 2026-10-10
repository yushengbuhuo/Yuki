import * as T from '../vendor/three/package/build/three.module.js';
import {stylizeMaterial} from './pet-style.js';

const maps=new Map();
export function paintTexture(kind='plaster'){
  if(maps.has(kind))return maps.get(kind);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
  let seed=641;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  c.fillStyle='#eee9dd';c.fillRect(0,0,512,512);
  for(let i=0;i<1200;i++){const a=.004+rand()*.009;c.fillStyle='rgba(106,91,66,'+a+')';c.beginPath();c.ellipse(rand()*512,rand()*512,2+rand()*22,1+rand()*8,rand()*6.28,0,6.28);c.fill();}
  if(kind==='wood'){
    for(let i=0;i<125;i++){const x=rand()*512;c.strokeStyle='rgba(118,88,55,'+(.03+rand()*.065)+')';c.lineWidth=.6+rand()*2;c.beginPath();c.moveTo(x,0);for(let y=0;y<=512;y+=16)c.lineTo(x+Math.sin(y*.018+i)*3,y);c.stroke();}
    for(let i=0;i<4;i++){c.fillStyle='rgba(100,74,50,.2)';c.fillRect(i*128,0,1.5,512);c.fillRect(i*128,(i%2)*256,128,1.5);}
  }
  if(kind==='fabric'||kind==='rug'){
    for(let i=0;i<512;i+=4){c.fillStyle='rgba(118,99,76,.045)';c.fillRect(i,0,1,512);c.fillRect(0,i,512,1);}
  }
  if(kind==='rug'){
    c.strokeStyle='#b68269';c.lineWidth=11;c.beginPath();c.ellipse(256,256,234,234,0,0,6.28);c.stroke();
    c.strokeStyle='#acb699';c.lineWidth=6;c.beginPath();c.ellipse(256,256,211,211,0,0,6.28);c.stroke();
    for(let i=0;i<32;i++){const a=i/32*6.28,x=256+Math.cos(a)*224,y=256+Math.sin(a)*224;c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#b68269';c.beginPath();c.ellipse(0,0,4,8,.55,0,6.28);c.fill();c.restore();}
  }
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;maps.set(kind,tex);return tex;
}
export function painted(color,kind='plaster'){
  const material=new T.MeshStandardMaterial({color,map:paintTexture(kind),roughness:.92});
  material.userData.manorPainted=true;
  return stylizeMaterial(material);
}
export function archGeometry(width,height,depth=.1){
  const r=width/2,s=new T.Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,height-r);s.absarc(0,height-r,r,0,Math.PI,false);s.lineTo(-r,0);
  const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1,curveSegments:20});g.computeVertexNormals();return g;
}
export function softShadow(width=2,opacity=.22){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,8,64,64,64);
  g.addColorStop(0,'rgba(67,52,38,1)');g.addColorStop(.4,'rgba(67,52,38,.55)');g.addColorStop(1,'rgba(67,52,38,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  const m=new T.Mesh(new T.PlaneGeometry(width,width),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,opacity,depthWrite:false,toneMapped:false}));m.rotation.x=-Math.PI/2;return m;
}

// One full-size finish, an optional single-channel ink mask, and three small
// passes for highlight bloom. No scene supersampling or full-size color blur.
export function createFinish(renderer){
  const hdr=renderer.extensions.has('EXT_color_buffer_float');
  const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,type:hdr?T.HalfFloatType:T.UnsignedByteType});
  target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  // Only ink coverage is needed: R8 saves 75% over an RGBA8 mask, with no
  // duplicate scene draw, depth attachment or multisample storage.
  const contourTarget=new T.WebGLRenderTarget(1,1,{depthBuffer:false,format:T.RedFormat,type:T.UnsignedByteType});
  const mobile=matchMedia('(max-width:700px)').matches;
  const bloomA=new T.WebGLRenderTarget(1,1,{depthBuffer:false,type:hdr?T.HalfFloatType:T.UnsignedByteType});
  const bloomB=bloomA.clone();
  const screenVertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const extract=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:target.texture},sourceTexel:{value:new T.Vector2()},threshold:{value:hdr?1.1:.64},knee:{value:hdr?.55:.25}},vertexShader:screenVertex,fragmentShader:`
    uniform sampler2D image;uniform vec2 sourceTexel;uniform float threshold;uniform float knee;varying vec2 vUv;
    vec3 bright(vec2 uv){
      vec3 c=texture2D(image,clamp(uv,vec2(0.),vec2(1.))).rgb;
      float l=dot(c,vec3(.2126,.7152,.0722)),soft=clamp(l-threshold+knee,0.,2.*knee);
      soft=soft*soft/(4.*knee+.0001);
      return min(c*max(l-threshold,soft)/max(l,.0001),vec3(3.));
    }
    void main(){vec2 d=sourceTexel*1.5;gl_FragColor=vec4((bright(vUv+d)+bright(vUv-d)+bright(vUv+vec2(d.x,-d.y))+bright(vUv+vec2(-d.x,d.y)))*.25,1.);}
  `});
  const blurMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:bloomA.texture},direction:{value:new T.Vector2()}},vertexShader:screenVertex,fragmentShader:`
    uniform sampler2D image;uniform vec2 direction;varying vec2 vUv;
    vec3 tap(vec2 uv){return texture2D(image,clamp(uv,vec2(0.),vec2(1.))).rgb;}
    void main(){vec3 c=tap(vUv)*.227027;c+=(tap(vUv+direction*1.384615)+tap(vUv-direction*1.384615))*.316216;c+=(tap(vUv+direction*3.230769)+tap(vUv-direction*3.230769))*.070270;gl_FragColor=vec4(c,1.);}
  `});
  let glow=.35,glowQuality=1,bloomActive=false,outlineActive=false;
  const focalPoint=new T.Vector3();
  const outline={enabled:true,width:1.6,strength:.7,brush:.6,scale:1};
  const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{contourMap:{value:contourTarget.texture},outlineActive:{value:0},outlineEnabled:{value:1},outlineWidth:{value:1.6},outlineStrength:{value:.7},outlineBrush:{value:.6},outlineScale:{value:1},pixelRatio:{value:1},inverseProjection:{value:new T.Matrix4()},viewWorld:{value:new T.Matrix4()},bloomMap:{value:bloomA.texture},glowStrength:{value:0},artStyle:{value:1},artDetail:{value:1},focusBlur:{value:0},depthMap:{value:target.depthTexture},near:{value:.1},far:{value:100},focus:{value:20},focusWidth:{value:4},blurRadius:{value:7},image:{value:target.texture},texel:{value:new T.Vector2()},indoor:{value:1}},
    vertexShader:screenVertex,
    fragmentShader:`
      uniform sampler2D image;uniform sampler2D depthMap;uniform float near;uniform float far;uniform float focus;uniform float focusWidth;uniform float blurRadius;uniform vec2 texel;uniform float indoor;varying vec2 vUv;
      uniform float artStyle;uniform float artDetail;uniform float focusBlur;uniform sampler2D bloomMap;uniform float glowStrength;
      uniform sampler2D contourMap;uniform float outlineActive;
      float grain(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      // Keep the existing distant contour's nearest-depth appearance intact.
      float distanceAt(vec2 uv){vec2 p=(floor(uv/texel)+.5)*texel;float d=texture2D(depthMap,p).x;return near*far/(far-d*(far-near));}
      float coc(float d){return smoothstep(focusWidth,focusWidth*3.5,abs(d-focus));}
      float contourAt(vec2 uv){return texture2D(contourMap,clamp(uv,vec2(0.),vec2(1.))).r;}
      float filteredContour(){
        float center=contourAt(vUv),nw=contourAt(vUv+texel*vec2(-1,1)),ne=contourAt(vUv+texel*vec2(1,1));
        float sw=contourAt(vUv+texel*vec2(-1,-1)),se=contourAt(vUv+texel*vec2(1,-1));
        float low=min(center,min(min(nw,ne),min(sw,se))),high=max(center,max(max(nw,ne),max(sw,se)));
        if(high-low<max(.035,high*.15))return center;
        // A short FXAA-style search on the ink mask only. Texture detail,
        // vegetation and the existing distant lines are not blurred.
        vec2 dir=vec2(-(nw+ne-sw-se),nw+sw-ne-se);
        float reduce=max((nw+ne+sw+se)*.03125,.0078125);
        dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-2.),vec2(2.))*texel;
        float a=.5*(contourAt(vUv-dir/6.)+contourAt(vUv+dir/6.));
        float b=a*.5+.25*(contourAt(vUv-dir*.5)+contourAt(vUv+dir*.5));
        return mix(center,b<low||b>high?a:b,.8);
      }
      void main(){
        vec4 source=texture2D(image,vUv);vec3 c=source.rgb;
        float depth=distanceAt(vUv),blur=coc(depth)*focusBlur;
        vec3 sum=c;float weights=1.;
        if(blur>.001)for(int i=0;i<12;i++){float angle=float(i)*2.399963,r=sqrt((float(i)+.5)/12.);vec2 p=clamp(vUv+vec2(cos(angle),sin(angle))*texel*blurRadius*blur*r,vec2(0.),vec2(1.));float sd=distanceAt(p);float w=smoothstep(.0,.4,coc(sd))*(1.-smoothstep(focusWidth,focusWidth*2.,depth-sd));sum+=texture2D(image,p).rgb*w;weights+=w;}
        c=mix(c,sum/weights,blur);
        if(glowStrength>.001)c+=texture2D(bloomMap,vUv).rgb*vec3(1.,.95,.86)*glowStrength;
        c=mix(c,c*vec3(1.025,1.002,.975),.4+indoor*.25);
        if(artStyle>.5){
          float luma=dot(c,vec3(.2126,.7152,.0722));
          if(artStyle<1.5)c=mix(vec3(luma),c,1.08);
          else if(artStyle<2.5){
            c=mix(vec3(luma),c,1.17);
          }else if(artStyle<3.5){
            c=mix(vec3(luma),c,.88)*vec3(1.035,1.012,.965);
            c*=1.+(grain(gl_FragCoord.xy)-.5)*.025*artDetail;
          }else if(artStyle<4.5){
            c=mix(vec3(luma),c,.78);
            c*=vec3(1.04,1.015,.955);
            c*=1.+(grain(gl_FragCoord.xy)-.5)*.018*artDetail;
          }else{
            c=mix(vec3(luma),c,1.27);
            c=max(vec3(0.),(c-.18)*1.025+.18)*vec3(1.025,1.005,.98);
            c*=1.+(grain(gl_FragCoord.xy)-.5)*.014*artDetail;
          }
          if(artStyle>1.5){
            float edge=0.;
            for(int i=0;i<4;i++){
              vec2 offset=i==0?vec2(1,0):i==1?vec2(-1,0):i==2?vec2(0,1):vec2(0,-1);
              float neighbor=distanceAt(clamp(vUv+offset*texel*1.15,vec2(0.),vec2(1.)));
              edge=max(edge,smoothstep(.012,.065,abs(neighbor-depth)/max(depth,1.)));
            }
            c*=1.-edge*(artStyle<2.5?.20:artStyle<3.5?.11:.16);
          }
          if(outlineActive>.5){
            float ink=filteredContour();
            c*=mix(vec3(1.),vec3(.14,.10,.065),ink);
          }
        }
        float vignette=smoothstep(.18,.85,length((vUv-.5)*vec2(1.,.8)));
        c*=1.-vignette*.07;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const contourMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:material.uniforms,vertexShader:screenVertex,fragmentShader:`
    uniform sampler2D image;uniform sampler2D depthMap;uniform vec2 texel;uniform float near;uniform float far;
    uniform float outlineWidth;uniform float outlineStrength;uniform float outlineBrush;uniform float outlineScale;uniform float pixelRatio;uniform mat4 inverseProjection;uniform mat4 viewWorld;varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float depthAt(vec2 uv){float d=texture2D(depthMap,clamp(uv,vec2(0.),vec2(1.))).x;return near*far/(far-d*(far-near));}
    // Integer depth textures are not portably linearly filterable. Blend two
    // nearest taps in view space for continuous fractional brush widths.
    float axialDepth(vec2 axis,float radius){
      float r=floor(radius),a=depthAt(vUv+axis*texel*r),b=depthAt(vUv+axis*texel*(r+1.));
      return mix(a,b,fract(radius));
    }
    void main(){
      if(texture2D(image,vUv).a<.5){gl_FragColor=vec4(0.);return;}
      float depth=depthAt(vUv),fade=1.-smoothstep(32.,44.,depth);
      if(fade<.001){gl_FragColor=vec4(0.);return;}
      float rough=.5,dry=1.;
      if(outlineBrush>.001){
        vec4 ray=inverseProjection*vec4(vUv*2.-1.,1.,1.);vec3 vp=ray.xyz/ray.w;vp*=depth/max(.0001,-vp.z);
        vec3 wp=(viewWorld*vec4(vp,1.)).xyz*outlineScale;
        vec2 q=vec2(dot(wp,vec3(.87,.13,.48)),dot(wp,vec3(-.15,.96,.25)));
        float footprint=2.*depth*max(texel.x*abs(inverseProjection[0][0]),texel.y*abs(inverseProjection[1][1]))*outlineScale;
        rough=mix(.5,noise(q*vec2(3.2,9.)),1.-smoothstep(.4,1.1,footprint*9.));
        float fine=mix(.5,noise(q*vec2(18.,55.)),1.-smoothstep(.35,1.1,footprint*55.));
        float soft=min(.16,footprint*55.*.14);
        dry=mix(1.,.68+.32*smoothstep(.16-soft,.65+soft,fine),outlineBrush);
        dry*=mix(1.,smoothstep(.10-soft,.38+soft,fine),outlineBrush*.65);
      }
      float radius=outlineWidth*pixelRatio*mix(1.,.65+rough*.7,outlineBrush);
      float l=axialDepth(vec2(-1,0),radius),right=axialDepth(vec2(1,0),radius),u=axialDepth(vec2(0,1),radius),d=axialDepth(vec2(0,-1),radius);
      float curvature=max(abs(l+right-2.*depth),abs(u+d-2.*depth))/max(depth,1.);
      float ink=smoothstep(.001,.008,curvature)*fade*dry*outlineStrength;
      gl_FragColor=vec4(ink,0.,0.,1.);
    }
  `});
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),material),scene=new T.Scene(),camera=new T.Camera();scene.add(quad);
  const size=new T.Vector2();
  return {supported:true,hdr,setStyle(value){material.uniforms.artStyle.value=value;},setDetail(value){material.uniforms.artDetail.value=value;},setFocusBlur(value){material.uniforms.focusBlur.value=value?1:0;},setGlow(value){glow=T.MathUtils.clamp(value,0,1);},setOutline(value){Object.assign(outline,value);for(const [key,v] of Object.entries(outline))material.uniforms['outline'+key[0].toUpperCase()+key.slice(1)].value=key==='enabled'?(v?1:0):v;},reduce(){glowQuality=Math.max(.55,glowQuality-.2);},diagnostics:()=>({hdr,bloomActive,glow,outline:{...outline,antialias:'mask',maskSize:outlineActive?[contourTarget.width,contourTarget.height]:[0,0],extraPasses:outlineActive?1:0},quality:glowQuality,bloomSize:bloomActive?[bloomA.width,bloomA.height]:[0,0],bloomPasses:bloomActive?3:0}),render(world,view,indoor,subject){renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y){target.setSize(size.x,size.y);material.uniforms.texel.value.set(1/size.x,1/size.y);}
    view.updateMatrixWorld();focalPoint.copy(subject?.position||new T.Vector3());focalPoint.y+=indoor?1.2:.65;focalPoint.applyMatrix4(view.matrixWorldInverse);
    material.uniforms.inverseProjection.value.copy(view.projectionMatrixInverse);material.uniforms.viewWorld.value.copy(view.matrixWorld);material.uniforms.pixelRatio.value=renderer.getPixelRatio();
    material.uniforms.focus.value=-focalPoint.z;material.uniforms.near.value=view.near;material.uniforms.far.value=view.far;material.uniforms.focusWidth.value=indoor?1.1:3.2;material.uniforms.blurRadius.value=(indoor?5:11)*renderer.getPixelRatio();
    material.uniforms.indoor.value=indoor?1:0;renderer.setRenderTarget(target);renderer.render(world,view);
    outlineActive=outline.enabled&&outline.width>.001&&outline.strength>.001&&material.uniforms.artStyle.value>.5;
    material.uniforms.outlineActive.value=outlineActive?1:0;
    if(outlineActive){
      if(contourTarget.width!==size.x||contourTarget.height!==size.y)contourTarget.setSize(size.x,size.y);
      quad.material=contourMaterial;renderer.setRenderTarget(contourTarget);renderer.render(scene,camera);
    }
    bloomActive=glow>.001&&material.uniforms.artStyle.value>.5;
    material.uniforms.glowStrength.value=bloomActive?glow*(indoor?.55:.45):0;
    if(bloomActive){
      const scale=Math.min((mobile?1/6:1/4)*glowQuality,(mobile?256:512)/Math.max(size.x,size.y));
      const w=Math.max(1,Math.round(size.x*scale)),h=Math.max(1,Math.round(size.y*scale));
      if(bloomA.width!==w||bloomA.height!==h){bloomA.setSize(w,h);bloomB.setSize(w,h);}
      extract.uniforms.sourceTexel.value.set(1/size.x,1/size.y);quad.material=extract;renderer.setRenderTarget(bloomA);renderer.render(scene,camera);
      // Bilinear Gaussian offsets assume adjacent texels: increasing the
      // stride leaves separate halo spots around tiny lanterns.
      quad.material=blurMaterial;blurMaterial.uniforms.image.value=bloomA.texture;blurMaterial.uniforms.direction.value.set(1/w,0);renderer.setRenderTarget(bloomB);renderer.render(scene,camera);
      blurMaterial.uniforms.image.value=bloomB.texture;blurMaterial.uniforms.direction.value.set(0,1/h);renderer.setRenderTarget(bloomA);renderer.render(scene,camera);
    }
    quad.material=material;renderer.setRenderTarget(null);renderer.render(scene,camera);
  },dispose(){target.depthTexture.dispose();target.dispose();contourTarget.dispose();contourMaterial.dispose();bloomA.dispose();bloomB.dispose();extract.dispose();blurMaterial.dispose();quad.geometry.dispose();material.dispose();}};
}

export function batchStatic(scene,exclude=[]){
  const batches=new Map();
  for(const o of [...scene.children]){
    if(!o.isMesh||o.isInstancedMesh||exclude.includes(o)||o.material.transparent)continue;
    const key=o.material.uuid+':'+o.castShadow;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);
  }
  for(const objects of batches.values()){
    if(objects.length<2)continue;const positions=[],normals=[],uvs=[];
    for(const o of objects){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);
      for(const v of g.attributes.position.array)positions.push(v);for(const v of g.attributes.normal.array)normals.push(v);
      if(g.attributes.uv)for(const v of g.attributes.uv.array)uvs.push(v);else for(let i=0;i<g.attributes.position.count;i++)uvs.push(0,0);
      g.dispose();scene.remove(o);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeBoundingSphere();
    const mesh=new T.Mesh(g,objects[0].material);mesh.castShadow=objects[0].castShadow;mesh.receiveShadow=true;scene.add(mesh);
  }
}
