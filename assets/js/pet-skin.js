import * as T from '../vendor/three/package/build/three.module.js';

// Stylized, opaque skin: black core, no specular lobe. A small light-dependent
// transmission approximation is evaluated in the existing forward light pass.
export function createPetSkin(){
  const skin=new T.MeshLambertMaterial({color:'#000000',emissive:'#010101'});
  skin.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <lights_lambert_pars_fragment>',
      T.ShaderChunk.lights_lambert_pars_fragment.replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
        float grazing=pow(1.0-clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),3.0);
        vec3 through=normalize(directLight.direction+geometryNormal*0.45);
        float forwardScatter=pow(clamp(dot(geometryViewDir,-through),0.0,1.0),4.0);
        float softEdge=smoothstep(-0.55,0.45,dot(geometryNormal,directLight.direction));
        float scatter=grazing*(forwardScatter*0.8+softEdge*0.12);
        reflectedLight.directDiffuse += min(directLight.color,vec3(3.0))*vec3(0.012,0.010,0.009)*scatter;`
      )
    );
  };
  skin.customProgramCacheKey=()=> 'pet-black-subsurface-v1';
  return skin;
}
