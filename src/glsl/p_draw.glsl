// Particle rendering. Sand grains: motion-blurred streaks (1/30 s) at sub-pixel width with coverage
// alpha, forward scattering when backlit. Dust and dust devils: soft sprites with a
// Henyey-Greenstein phase (g = 0.7). Premultiplied alpha into the pre-exposed HDR buffer.
#ifdef VERT
uniform highp sampler2D uP,uV;uniform mat4 uVP;uniform vec3 uCamO,uRt,uUpv,uSunD,uMoonD,uLs,uLm,uAmb;
uniform vec2 uRes;uniform float uSalt,uPE,uPxK,uDustK,uTime,uMode;
uniform vec4 uDv[3],uDp[3];
out vec4 vC;out vec2 vQ;flat out float vT;
vec3 shade(vec3 alb,vec3 vd,float g){
  float cs=dot(uSunD,vd),cm=dot(uMoonD,vd),g2=g*g;
  float ps=(1.-g2)/pow(1.+g2-2.*g*cs,1.5),pm=(1.-g2)/pow(1.+g2-2.*g*cm,1.5);
  return alb*(uLs*(.25+.75*ps)+uLm*(.25+.75*pm)+uAmb)*.3183;
}
void main(){
  int id=gl_VertexID/6,k=gl_VertexID%6;
  vec2 cr=vec2(k==1||k==2||k==4?1.:-1.,k==2||k==4||k==5?1.:-1.);
  vQ=cr;gl_Position=vec4(2,2,2,1);vC=vec4(0);
  if(uMode<.5){
    int W=textureSize(uP,0).x;ivec2 c=ivec2(id%W,id/W);
    vec4 p=texelFetch(uP,c,0),v=texelFetch(uV,c,0);
    vec3 rp=p.xyz-uCamO;float dist=length(rp);vec3 vd=rp/max(dist,1e-3);
    if(float(id)<uSalt){
      if(p.w<=0.)return;
      vT=0.;
      vec4 A=uVP*vec4(rp-v.xyz*.033,1),B=uVP*vec4(rp,1);
      if(A.w<.1||B.w<.1)return;
      vec2 sa=A.xy/A.w*uRes*.5,sb=B.xy/B.w*uRes*.5,dr=sb-sa;float L=length(dr);dr=L>.01?dr/L:vec2(1,0);
      float wpx=.003*uPxK/B.w,t=cr.x*.5+.5;
      vec4 P=mix(A,B,t);
      P.xy+=(vec2(-dr.y,dr.x)*cr.y*max(wpx,1.4)*.5+dr*cr.x*.7)/(uRes*.5)*P.w;
      gl_Position=P;
      float a=.85*min(wpx/1.4+.08,1.)*(1.-smoothstep(30.,58.,dist))*smoothstep(0.,.3,p.w);
      vC=vec4(shade(vec3(.7,.56,.4),vd,.55)*1.8*a*uPE,a);
    }else{
      if(p.w<=0.)return;
      vT=1.;
      float s=.03+.09*v.w;
      gl_Position=uVP*vec4(rp+(uRt*cr.x+uUpv*cr.y)*s*.5,1);
      float a=.22*uDustK*(1.-smoothstep(18.,45.,dist))*smoothstep(1.,3.,dist);
      vC=vec4(shade(vec3(.6,.48,.36),vd,.7)*a*uPE,a);
    }
  }else{
    int dv=id/900,j=id%900;
    vec4 D=uDv[dv],Pm=uDp[dv];
    if(D.w<=0.)return;
    vT=1.;
    float fj=float(j),r1=fract(fj*.7548777),r2=fract(fj*.5698403);
    float hfr=fract(fj*.6180339+uTime*(.035+.03*r1));
    float rad=Pm.y*(.45+2.6*hfr*hfr)*(.8+.4*r2);
    float an=r2*6.2832+uTime*Pm.z/(.35+hfr*1.5);
    vec3 c=vec3(D.x,D.z,D.y)+vec3(sin(uTime*.31+hfr*3.+Pm.w),0,cos(uTime*.27+hfr*2.5+Pm.w))*hfr*Pm.x*.07;
    vec3 wp=c+vec3(cos(an)*rad,hfr*Pm.x,sin(an)*rad);
    vec3 rp=wp-uCamO;float dist=length(rp);
    float s=2.+hfr*12.+Pm.y*.5;
    gl_Position=uVP*vec4(rp+(uRt*cr.x+uUpv*cr.y)*s*.5,1);
    float a=.06*D.w*pow(1.-hfr,.8)*smoothstep(0.,.06,hfr)*(1.-smoothstep(2500.,4000.,dist));
    vC=vec4(shade(vec3(.62,.5,.37),rp/dist,.7)*a*uPE,a);
  }
}
#else
in vec4 vC;in vec2 vQ;flat in float vT;out vec4 o;
void main(){
  float m=vT<.5?1.-abs(vQ.y):exp(-dot(vQ,vQ)*2.8)*(1.-step(1.,dot(vQ,vQ)));
  o=vC*m;
}
#endif
