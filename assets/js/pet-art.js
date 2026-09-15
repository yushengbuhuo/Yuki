import * as T from '../vendor/three/package/build/three.module.js';

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
  return new T.MeshStandardMaterial({color,map:paintTexture(kind),roughness:.92});
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

// A single bounded-resolution pass: warm highlights, cool soft shadows and a
// very small four-tap highlight diffusion. No SSAO, reflection or bloom pyramid.
export function createFinish(renderer){
  const hdr=renderer.extensions.has('EXT_color_buffer_float');
  if(!hdr)return {render(world,view){renderer.render(world,view);},dispose(){}};
  const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,type:hdr?T.HalfFloatType:T.UnsignedByteType});
  target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const focalPoint=new T.Vector3();
  const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{depthMap:{value:target.depthTexture},near:{value:.1},far:{value:100},focus:{value:20},focusWidth:{value:4},blurRadius:{value:7},image:{value:target.texture},texel:{value:new T.Vector2()},indoor:{value:1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      uniform sampler2D image;uniform sampler2D depthMap;uniform float near;uniform float far;uniform float focus;uniform float focusWidth;uniform float blurRadius;uniform vec2 texel;uniform float indoor;varying vec2 vUv;
      float distanceAt(vec2 uv){float d=texture2D(depthMap,uv).x;return near*far/(far-d*(far-near));}
      float coc(float d){return smoothstep(focusWidth,focusWidth*3.5,abs(d-focus));}
      void main(){
        vec3 c=texture2D(image,vUv).rgb;
        float depth=distanceAt(vUv),blur=coc(depth);
        vec3 sum=c;float weights=1.;
        for(int i=0;i<12;i++){float angle=float(i)*2.399963,r=sqrt((float(i)+.5)/12.);vec2 p=clamp(vUv+vec2(cos(angle),sin(angle))*texel*blurRadius*blur*r,vec2(0.),vec2(1.));float sd=distanceAt(p);float w=smoothstep(.0,.4,coc(sd))*(1.-smoothstep(focusWidth,focusWidth*2.,depth-sd));sum+=texture2D(image,p).rgb*w;weights+=w;}
        c=mix(c,sum/weights,blur);
        vec3 b=(texture2D(image,vUv+texel*vec2(2.,1.)).rgb+texture2D(image,vUv+texel*vec2(-2.,-1.)).rgb+texture2D(image,vUv+texel*vec2(-1.,2.)).rgb+texture2D(image,vUv+texel*vec2(1.,-2.)).rgb)*.25;
        c+=max(b-.7,0.)*.055;
        c=mix(c,c*vec3(1.025,1.002,.975),.4+indoor*.25);
        float vignette=smoothstep(.18,.85,length((vUv-.5)*vec2(1.,.8)));
        c*=1.-vignette*.07;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),material),scene=new T.Scene(),camera=new T.Camera();scene.add(quad);
  const size=new T.Vector2();
  return {render(world,view,indoor,subject){renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y){target.setSize(size.x,size.y);material.uniforms.texel.value.set(1/size.x,1/size.y);}
    view.updateMatrixWorld();focalPoint.copy(subject?.position||new T.Vector3());focalPoint.y+=indoor?1.2:.65;focalPoint.applyMatrix4(view.matrixWorldInverse);
    material.uniforms.focus.value=-focalPoint.z;material.uniforms.near.value=view.near;material.uniforms.far.value=view.far;material.uniforms.focusWidth.value=indoor?1.1:3.2;material.uniforms.blurRadius.value=(indoor?5:11)*renderer.getPixelRatio();
    material.uniforms.indoor.value=indoor?1:0;renderer.setRenderTarget(target);renderer.render(world,view);renderer.setRenderTarget(null);renderer.render(scene,camera);
  },dispose(){target.depthTexture.dispose();target.dispose();quad.geometry.dispose();material.dispose();}};
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
