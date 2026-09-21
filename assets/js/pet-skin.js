import * as T from '../vendor/three/package/build/three.module.js';

// Stylized, opaque skin: black core, no specular lobe. A small light-dependent
// transmission approximation is evaluated in the existing forward light pass.
export function createPetSkin(){
  const skin=new T.MeshLambertMaterial({color:'#484848',emissive:'#030303'});
  skin.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <lights_lambert_pars_fragment>',
      T.ShaderChunk.lights_lambert_pars_fragment.replace(
        'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ) * 0.14;'
      ).replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        `float lightLevel=dot(directLight.color,vec3(0.2126,0.7152,0.0722));
        vec3 softLight=mix(vec3(lightLevel),directLight.color,0.22);
        float form=pow(max(0.0,dot(geometryNormal,directLight.direction)),1.45);
        reflectedLight.directDiffuse += softLight * form * BRDF_Lambert( material.diffuseColor );
        float grazing=pow(1.0-clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),1.7);
        vec3 through=normalize(directLight.direction+geometryNormal*0.45);
        float forwardScatter=pow(clamp(dot(geometryViewDir,-through),0.0,1.0),4.0);
        float softEdge=smoothstep(-0.15,0.8,dot(geometryNormal,directLight.direction));
        float scatter=grazing*(forwardScatter*0.85+softEdge*0.22);
        reflectedLight.directDiffuse += min(directLight.color,vec3(3.0))*vec3(0.04,0.027,0.022)*scatter;`
      )
    );
  };
  skin.customProgramCacheKey=()=> 'pet-black-subsurface-v4';
  return skin;
}
