// Sky radiance in a world direction: sunlit sky-view LUT (scaled by uSunK, the fraction of sunlight
// passing the rings) plus a second LUT computed for the moon, scaled by the moon's illuminance.
uniform sampler2D uSV,uSV2;uniform float uR,uSunK,uMoonE;uniform vec3 uSun,uMoon;
vec2 svUV(vec3 D,vec3 S){
  float r=uR,vh=sqrt(r*r-RG*RG),beta=acos(vh/r),zh=PI-beta;
  float vza=acos(clamp(D.y,-1.,1.)),v;
  if(vza<zh){float c=1.-vza/zh;v=(1.-sqrt(c))*.5;}else{v=sqrt((vza-zh)/beta)*.5+.5;}
  vec2 hz=normalize(D.xz+1e-6*vec2(1,0)),sz=normalize(S.xz+1e-6*vec2(1,0));
  return sub(vec2(sqrt(clamp(.5-.5*dot(hz,sz),0.,1.)),v),vec2(192,108));
}
vec3 skyL(vec3 D){
  vec3 c=texture(uSV,svUV(D,uSun)).rgb*uSunK;
  if(uMoonE>0.)c+=texture(uSV2,svUV(D,uMoon)).rgb*uMoonE;
  // faint airglow so a moonless night is not pure black (about 22 mag per square arcsecond)
  return c+vec3(.55,.8,1.)*2.5e-9*smoothstep(-.02,.1,D.y);
}
