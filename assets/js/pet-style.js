import * as T from '../vendor/three/package/build/three.module.js';
import {mountOutlineControls} from './pet-outline-controls.js';

export const ART_STYLES = [
  {id:'lowpoly',name:'LowPoly 手绘',note:'分面体积 · 克制手绘 · 柔和投影',mode:1,ambient:.76,sun:1.05,exposure:1.15,texture:.7},
  {id:'cel',name:'卡通色块',note:'三层明暗 · 清晰色块 · 轮廓收边',mode:2,ambient:.48,sun:1.12,exposure:1.14,texture:.12},
  {id:'paper',name:'纸艺立体书',note:'折面受光 · 纸纤维 · 温暖接触阴影',mode:3,ambient:.72,sun:1.05,exposure:1.16,texture:.36},
  {id:'print',name:'版画绘本',note:'分层油墨 · 定向笔触 · 动态阴影破边',mode:4,ambient:.52,sun:1.1,exposure:1.14,texture:.48},
  {id:'vivid-print',name:'鲜彩版画',note:'鲜艳色块 · 版画笔触 · 分层光影与暖光',mode:5,ambient:.58,sun:1.12,exposure:1.14,texture:.48},
  {id:'original',name:'原始效果',note:'原始材质与光照，方便对照',mode:0,ambient:1,sun:1,exposure:1.1,texture:1}
];

// Shared uniforms switch styles without recompiling every material. Texture
// marks live in object space, so neither camera motion nor a walking sheep
// makes them swim. No per-model texture painting or normal maps are required.
export const artUniforms={manorStyle:{value:1},manorTexture:{value:.7},manorDetail:{value:1}};
const fragment = /* glsl */`
uniform float manorStyle;
uniform float manorTexture;
uniform float manorDetail;
varying vec3 vManorLocal;
varying vec3 vManorNormal;
float manorBrush;
float manorGrain;
float manorHash(vec3 p){p=fract(p*.3183099+vec3(.13,.37,.71));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float manorNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(manorHash(i),manorHash(i+vec3(1,0,0)),f.x),mix(manorHash(i+vec3(0,1,0)),manorHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(manorHash(i+vec3(0,0,1)),manorHash(i+vec3(1,0,1)),f.x),mix(manorHash(i+vec3(0,1,1)),manorHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float manorMarks(vec3 p,vec3 n){
  // Dominant-axis projection: elongated broken marks, not isotropic speckles.
  vec3 a=abs(n);vec2 q=a.y>max(a.x,a.z)?p.xz:(a.x>a.z?p.zy:p.xy);
  q=mat2(.94,-.34,.34,.94)*q;
  float coarse=manorNoise(vec3(q*vec2(25.,5.),1.7));
  float fine=manorNoise(vec3(q*vec2(67.,11.),4.2));
  return mix(coarse,fine,.35);
}
float manorDiffuse(float nl){
  if(manorStyle<.5)return max(nl,0.);
  if(manorStyle<1.5)return max(nl,0.)*(.94+.10*manorBrush);
  float width=max(fwidth(nl)*1.25,.012);
  if(manorStyle<2.5)return .07+.45*smoothstep(.16-width,.16+width,nl)+.48*smoothstep(.63-width,.63+width,nl);
  if(manorStyle<3.5)return mix(max(nl,0.),.08+.48*smoothstep(.22-width,.22+width,nl)+.44*smoothstep(.69-width,.69+width,nl),.65);
  float shifted=nl+(manorBrush-.5)*.24*manorDetail;
  return .05+.43*smoothstep(.19-width,.19+width,shifted)+.52*smoothstep(.65-width,.65+width,shifted);
}
float manorShadow(float s){
  if(manorStyle<1.5)return s;
  if(manorStyle<2.5)return smoothstep(.36,.64,s);
  if(manorStyle<3.5)return smoothstep(.12,.88,s);
  // Shadow-map visibility is shaped independently of the surface normal.
  // Only the moving penumbra is broken up; fully lit/shadowed areas stay calm.
  return smoothstep(.34,.66,s+(manorBrush-.5)*.38*manorDetail);
}
`;

export function stylizeMaterial(material){
  if(material.userData.manorStyled||material.userData.manorExclude||(!material.isMeshStandardMaterial&&!material.isMeshLambertMaterial))return material;
  material.userData.manorStyled=true;
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    Object.assign(shader.uniforms,artUniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vManorLocal;varying vec3 vManorNormal;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 manorScale=vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));
        #ifdef USE_INSTANCING
          manorScale*=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
        #endif
        vManorLocal=position*manorScale;vManorNormal=normal;
      `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+fragment);
    const lighting=material.isMeshStandardMaterial?'lights_physical_pars_fragment':'lights_lambert_pars_fragment';
    const lightingChunk=material.isMeshStandardMaterial
      ?T.ShaderChunk[lighting].replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );','reflectedLight.directDiffuse += manorDiffuse( dot( geometryNormal, directLight.direction ) ) * directLight.color * BRDF_Lambert( material.diffuseColor );')
      :T.ShaderChunk[lighting].replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );','float dotNL = manorDiffuse( dot( geometryNormal, directLight.direction ) );');
    shader.fragmentShader=shader.fragmentShader.replace('#include <'+lighting+'>',lightingChunk);
    shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',T.ShaderChunk.shadowmap_pars_fragment.replaceAll('return mix( 1.0, shadow, shadowIntensity );','return manorShadow( mix( 1.0, shadow, shadowIntensity ) );'));
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nif(manorStyle>.5)roughnessFactor=1.;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      manorBrush=.5;manorGrain=.5;
      if(manorStyle>3.5&&manorDetail>0.)manorBrush=manorMarks(vManorLocal,normalize(vManorNormal));
      if(manorStyle>2.5&&manorDetail>0.){
        float manorFootprint=max(length(dFdx(vManorLocal)),length(dFdy(vManorLocal)));
        manorGrain=mix(.5,manorNoise(vManorLocal*75.),1.-smoothstep(.35,1.2,manorFootprint*75.));
      }
      vec3 manorBase=diffuseColor.rgb;
      #include <map_fragment>
      ${material.userData.manorPainted?'diffuseColor.rgb=mix(manorBase,diffuseColor.rgb,manorTexture);':''}
      if(manorStyle>.5&&manorStyle<1.5)diffuseColor.rgb*=1.+(manorNoise(vManorLocal*3.)-.5)*.09*manorDetail;
      if(manorStyle>2.5&&manorStyle<3.5)diffuseColor.rgb*=1.+(manorGrain-.5)*.11*manorDetail;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      if(manorStyle>.5&&manorStyle<1.5){vec3 facet=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));normal=normalize(mix(normal,facet*faceDirection,.82));}
      if(manorStyle>2.5&&manorStyle<3.5){vec3 facet=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));normal=normalize(mix(normal,facet*faceDirection,.6));}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      if(manorStyle>1.5&&manorStyle<2.5){
        float edge=1.-abs(dot(normal,normalize(vViewPosition)));
        outgoingLight*=1.-smoothstep(.77,.97,edge)*.25;
      }
      if(manorStyle>3.5){
        float illumination=dot(reflectedLight.directDiffuse,vec3(.2126,.7152,.0722))/max(.035,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
        float shadowInk=1.-smoothstep(.12,.5,illumination);
        outgoingLight*=mix(vec3(1.),vec3(.83,.87,.96),shadowInk*.42);
        float strokes=smoothstep(.62,.8,manorBrush)*shadowInk;
        outgoingLight=mix(outgoingLight,outgoingLight*vec3(.70,.73,.79),strokes*.36*manorDetail);
        float missedInk=smoothstep(.73,.86,manorGrain)*(1.-smoothstep(.4,.8,manorBrush));
        outgoingLight=mix(outgoingLight,outgoingLight*1.22+diffuseColor.rgb*.012,missedInk*.38*manorDetail);
      }
      #include <opaque_fragment>
      ${material.userData.manorOutlineExclude?'gl_FragColor.a=0.;':''}
    `);
  };
  material.customProgramCacheKey=()=>cacheKey+'-manor-styles-v3-'+(material.userData.manorPainted?'painted':'mapped')+(material.userData.manorOutlineExclude?'-no-outline':'');
  material.needsUpdate=true;
  return material;
}

export function createStyleSystem({renderer,finish,scenes,ambient,sun,room,water,status}){
  const selector=document.querySelector('#art-style'),detail=document.querySelector('#art-detail'),dof=document.querySelector('#art-dof'),glow=document.querySelector('#art-glow'),note=document.querySelector('#art-style-note');
  let selected=ART_STYLES[0];
  const materials=new Set();
  function collect(){for(const scene of scenes)scene.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&!materials.has(m)){materials.add(m);stylizeMaterial(m);}});}
  collect();
  function select(id,announce=true){
    selected=ART_STYLES.find(s=>s.id===id)||ART_STYLES[0];
    artUniforms.manorStyle.value=selected.mode;artUniforms.manorTexture.value=selected.texture;
    finish.setStyle?.(selected.mode);water.uniforms.artStyle.value=selected.mode;
    renderer.toneMappingExposure=selected.exposure;
    selector.value=selected.id;note.textContent=selected.note;
    document.documentElement.dataset.artStyle=selected.id;
    try{localStorage.setItem('manor-art-style',selected.id);}catch{}
    if(announce)status.textContent='画面已切换为「'+selected.name+'」。';
    renderer.shadowMap.needsUpdate=true;
  }
  let saved;try{saved=localStorage.getItem('manor-art-style');}catch{}
  select(new URLSearchParams(location.search).get('style')||saved||'lowpoly',false);
  try{const savedGlow=localStorage.getItem('manor-art-glow');if(savedGlow!==null&&Number.isFinite(Number(savedGlow)))glow.value=String(T.MathUtils.clamp(Number(savedGlow),0,1));}catch{}
  const onSelect=()=>select(selector.value),onDetail=()=>{artUniforms.manorDetail.value=Number(detail.value);finish.setDetail?.(Number(detail.value));},onDof=()=>finish.setFocusBlur?.(dof.checked),onGlow=()=>{finish.setGlow(Number(glow.value));try{localStorage.setItem('manor-art-glow',glow.value);}catch{}};
  selector.addEventListener('change',onSelect);detail.addEventListener('input',onDetail);dof.addEventListener('change',onDof);glow.addEventListener('input',onGlow);onDetail();onDof();onGlow();
  const outlineControls=mountOutlineControls(finish);
  return {
    update(){
      // Called immediately after the day/night system resets its light values.
      ambient.intensity*=selected.ambient;sun.intensity*=selected.sun;
      room.lighting.ambient.intensity*=selected.ambient;room.lighting.sun.intensity*=selected.sun;room.lighting.fill.intensity*=selected.ambient;
      if(selected.mode===5){room.lighting.ambient.intensity*=1.25;room.lighting.fill.intensity*=1.35;}
      // A brighter lampshade feeds the highlight pass without adding a light.
      if(selected.mode>0)room.lighting.shade.emissiveIntensity*=2.4;
    },
    diagnostics:()=>({id:selected.id,name:selected.name,detail:artUniforms.manorDetail.value,focusBlur:dof.checked,glow:Number(glow.value),finish:finish.diagnostics(),materialCount:materials.size,postprocessing:finish.supported!==false}),
    dispose(){outlineControls.dispose();selector.removeEventListener('change',onSelect);detail.removeEventListener('input',onDetail);dof.removeEventListener('change',onDof);glow.removeEventListener('input',onGlow);}
  };
}
