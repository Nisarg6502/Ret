// Geometry clipmap level. Vertices near the outer edge morph onto the coarser level's grid and
// heights (CDLOD style) so neighbouring levels meet without cracks.
layout(location=0) in vec2 aG;
uniform highp sampler2DArray uH;
uniform int uL,uLast;uniform float uS;
uniform vec2 uCT,uWO1;uniform ivec2 uOM,uOM1;
uniform vec3 uCam;uniform mat4 uVP;
out vec3 vRel;out vec2 vQ,vT0,vT1;out float vM,vH;
float hb(vec2 t,int l,ivec2 om){
  vec2 f=floor(t),w=t-f;ivec2 i=ivec2(f)+om;
  float a=texelFetch(uH,ivec3(i%TS,l),0).r,b=texelFetch(uH,ivec3((i+ivec2(1,0))%TS,l),0).r,
        c=texelFetch(uH,ivec3((i+ivec2(0,1))%TS,l),0).r,d=texelFetch(uH,ivec3((i+ivec2(1,1))%TS,l),0).r;
  return mix(mix(a,b,w.x),mix(c,d,w.x),w.y);
}
void main(){
  float r=max(abs(aG.x),abs(aG.y));
  float m=uL<uLast?clamp((r/float(GR/2)-.7)/.22,0.,1.):0.;
  vec2 g=aG-fract(aG*.5)*2.*m;
  vec2 t0=g+float(TS/2),t1=(uCT+g)*.5-uWO1;
  float h=hb(t0,uL,uOM);
  if(m>0.)h=mix(h,hb(t1,uL+1,uOM1),m);
  vec2 q=(uCT+g)*uS;
  if(uL==uLast&&r>=float(GR/2)){q=(uCT+aG*4.)*uS;h-=30.;}
  vec3 rel=vec3(q.x-uCam.x,h-uCam.y,q.y-uCam.z);
  rel.y-=dot(rel.xz,rel.xz)/1.272e7;
  vRel=rel;vQ=q;vH=h;vM=m;
  vT0=(t0+vec2(uOM)+.5)/float(TS);vT1=(t1+vec2(uOM1)+.5)/float(TS);
  gl_Position=uVP*vec4(rel,1);
}
