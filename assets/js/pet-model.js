// Silhouette landmarks measured as proportions of the supplied three-view art.
// World units: front width 3.2, height 2.52, side depth approximately 3.09.
export const PROFILE = [
  [0,0], [.025,1.02], [.06,1.23], [.14,1.36], [.3,1.48],
  [.52,1.56], [.78,1.595], [1.0,1.6], [1.25,1.565],
  [1.5,1.48], [1.75,1.345], [2,1.145], [2.2,.91],
  [2.36,.63], [2.46,.35], [2.52,0]
];
export function radiusAt(y) {
  if(y<=0||y>=2.52)return 0;
  // A broad, gently flattened dome instead of a narrow circular crown.
  // Meet the widest waist with a horizontal tangent and close smoothly at the top.
  if(y>=1){const t=(y-1)/1.52;return 1.6*Math.pow(Math.max(0,1-Math.pow(t,2.25)),1/2.25);}
  let i=0;while(i<PROFILE.length-2&&y>PROFILE[i+1][0])i++;
  const a=PROFILE[i],b=PROFILE[i+1],t=(y-a[0])/(b[0]-a[0]);
  return a[1]+(b[1]-a[1])*t;
}
export function frontSurface(x,y) {
  const r=radiusAt(y);
  return .965*Math.sqrt(Math.max(0,r*r-x*x));
}
export const EYES = [
  {x:-.25,y:1.45,width:.21,height:.26},
  {x:.36,y:1.44,width:.19,height:.192}
];
// Preserve the reference eye outline when the parent body changes proportions.
// Expressions can close the eyes; surprise enlarges BOTH axes, not just height.
export function eyeRadii(spec, scaleX, scaleY, expression, blink=1) {
  const size=Math.sqrt(scaleX*scaleY)*(expression==='surprised'?1.04:1);
  const closure=expression==='sleepy'?.16:expression==='happy'?.42:1;
  return {x:spec.width*size/scaleX,y:spec.height*size/scaleY*closure*blink};
}
