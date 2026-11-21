// Final sky: sky-view LUT + sun disc with limb darkening + procedural stars.
uniform mat4 uIVP;uniform mat3 uCel;uniform float uTime,uPix,uStarK;
in vec2 vUv;out vec4 o;
vec3 stars(vec3 d,float ty){
  vec3 q=d*260.,c=floor(q);
  ivec3 ic=ivec3(c);
  uint h=hsh(ivec2(ic.x*1973+ic.z*9277,ic.y*26699-ic.z*3511));
  float p=float(h>>8)/16777216.;
  if(p>.004)return vec3(0);
  uint h2=hsh(ivec2(int(h),17));
  vec3 j=vec3(float(h2&255u),float((h2>>8)&255u),float((h2>>16)&255u))/255.;
  vec3 sp=normalize((c+.2+.6*j)/260.);
  float a=length(cross(sp,d));
  float m=max(6.5+2.*log(p/.004+1e-9)/2.302585,-1.4);
  float F=pow(10.,-.4*m)*1.8e-11;
  float sg=uPix*.75,I=F/(6.2831853*sg*sg)*exp(-a*a/(2.*sg*sg));
  float t=float(h2>>24)/255.;
  vec3 col=mix(vec3(1.,.72,.48),vec3(.72,.82,1.),smoothstep(.2,.8,t));
  float tw=1.+.6*(1.-ty)*sin(uTime*(9.+14.*t)+t*40.);
  return col*I*tw;
}
void main(){
  vec4 c=uIVP*vec4(vUv*2.-1.,1,1);vec3 D=normalize(c.xyz/c.w);
  vec3 col=skyL(D);
  vec3 T=tr(uR,D.y)*limb(uR,D.y);
  float a=acos(clamp(dot(D,uSun),-1.,1.)),rs=.004653;
  if(a<rs+uPix){
    float x=min(a/rs,1.),mu=sqrt(1.-x*x);
    col+=T*14702.*(1.-.6*(1.-mu))/.8*smoothstep(rs+uPix*.5,rs-uPix*.5,a);
  }
  if(D.y>-.01)col+=T*uStarK*stars(uCel*D,max(D.y,0.));
  o=vec4(col,1);
}
