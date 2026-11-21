// Sample the sky-view LUT in a world direction.
uniform sampler2D uSV;uniform float uR;uniform vec3 uSun;
vec3 skyL(vec3 D){
  float r=uR,vh=sqrt(r*r-RG*RG),beta=acos(vh/r),zh=PI-beta;
  float vza=acos(clamp(D.y,-1.,1.)),v;
  if(vza<zh){float c=1.-vza/zh;v=(1.-sqrt(c))*.5;}else{v=sqrt((vza-zh)/beta)*.5+.5;}
  vec2 hz=normalize(D.xz+1e-6*vec2(1,0)),sz=normalize(uSun.xz+1e-6*vec2(1,0));
  float u=sqrt(clamp(.5-.5*dot(hz,sz),0.,1.));
  // + faint airglow so a moonless night is not pure black (about 22 mag per square arcsecond)
  return texture(uSV,sub(vec2(u,v),vec2(192,108))).rgb+vec3(.55,.8,1.)*2.5e-9*smoothstep(-.02,.1,D.y);
}
