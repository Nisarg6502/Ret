// Sky-view LUT, 192x108, latitude/longitude around the sun azimuth (Hillaire 2020, 5.3).
uniform vec3 uSun;uniform float uR;
out vec4 o;
void main(){
  vec2 uv=(gl_FragCoord.xy-.5)/vec2(191,107);
  float r=uR,vh=sqrt(r*r-RG*RG),beta=acos(vh/r),zh=PI-beta,vza;
  if(uv.y<.5){float c=1.-2.*uv.y;c=1.-c*c;vza=zh*c;}else{float c=uv.y*2.-1.;vza=zh+beta*c*c;}
  float vzc=cos(vza),vzs=sin(vza),c=uv.x*uv.x,lvc=1.-2.*c;
  vec3 D=vec3(vzs*lvc,vzc,vzs*sqrt(max(0.,1.-lvc*lvc)));
  vec3 S=vec3(sqrt(max(0.,1.-uSun.y*uSun.y)),uSun.y,0);
  vec3 O=vec3(0,r,0),T;
  o=vec4(integ(O,D,S,rayLen(O,D),32,T),1);
}
