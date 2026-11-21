// GPU particles. Blowing sand: grains launched from the bed where gusts lift u* past the threshold,
// flying ballistic hops with quadratic air drag toward the log-law wind, rebounding or settling on
// impact; at slip-face brinks they are flung out over the lee as a plume. Dust: suspended fines that
// ride the turbulent wind. Positions in metres relative to the particle origin.
uniform highp sampler2D uP,uV;uniform highp sampler2DArray uH,uGr,uAt;
uniform vec2 uWin0,uWin1,uOA,uWd;uniform ivec2 uOM0,uOM1;uniform vec3 uCam,uShift;
uniform float uU10,uUs,uTime,uDt,uFrame,uSalt,uDustK;
layout(location=0) out vec4 oP;layout(location=1) out vec4 oV;
float Hl(vec2 xz,int l,vec2 win,ivec2 om,float s){
  vec2 t=(xz-win)/s;
  if(t.x<1.||t.y<1.||t.x>float(TS-2)||t.y>float(TS-2))return -1e4;
  vec2 f=floor(t),w=t-f;ivec2 i=ivec2(f)+om;
  float a=texelFetch(uH,ivec3(i%TS,l),0).r,b=texelFetch(uH,ivec3((i+ivec2(1,0))%TS,l),0).r,
        c=texelFetch(uH,ivec3((i+ivec2(0,1))%TS,l),0).r,d=texelFetch(uH,ivec3((i+ivec2(1,1))%TS,l),0).r;
  return mix(mix(a,b,w.x),mix(c,d,w.x),w.y);
}
float H0(vec2 xz){return Hl(xz,0,uWin0,uOM0,1.);}
float H1(vec2 xz){return Hl(xz,1,uWin1,uOM1,2.);}
vec2 Gr(vec2 xz){return texture(uGr,vec3((xz-uWin0+vec2(uOM0)+.5)/float(TS),0.)).xy;}
float Sand(vec2 xz){vec4 a=texture(uAt,vec3((xz-uWin0+vec2(uOM0)+.5)/float(TS),0.));return (1.-a.x)*(1.-a.y);}
float R(float k){return hf(ivec2(int(gl_FragCoord.x)+int(gl_FragCoord.y)*1024,int(uFrame)*13+int(k)));}
float gust(vec2 q){return 1.+.5*gn((q-uWd*uU10*uTime*.9)/70.)+.25*gn((q-uWd*uU10*uTime*1.1)/23.+7.);}
void main(){
  ivec2 c=ivec2(gl_FragCoord.xy);
  vec4 p=texelFetch(uP,c,0),v=texelFetch(uV,c,0);
  p.xyz-=uShift;
  float id=float(c.y*textureSize(uP,0).x+c.x),dt=uDt;
  vec2 Wq=vec2(-uWd.y,uWd.x);
  if(id<uSalt){
    if(p.w<=0.){
      float a=R(1.)*6.2832,rr=3.+sqrt(R(2.))*47.;
      vec2 xz=uCam.xz+vec2(cos(a),sin(a))*rr;
      float h=H0(xz);
      float us=uUs*gust(xz+uOA)*clamp(1.+1.6*dot(Gr(xz),uWd),.2,1.7);
      float fl=max(us-.22,0.)*Sand(xz);
      if(h>-1e3&&R(3.)<fl*dt*40.){
        float pl=smoothstep(.7,2.,h-H0(xz+uWd*3.));
        vec2 hv=uWd*us*(1.5+2.*R(4.))+Wq*us*(R(5.)-.5);
        v=vec4(hv.x,us*(2.+3.*R(6.))*(1.+2.*pl),hv.y,0);
        p=vec4(xz.x,h+.01,xz.y,1.5+2.5*R(7.));
      }
    }else{
      for(int s=0;s<2;s++){
        float h=H0(p.xz),z=max(p.y-h,5e-4),us=uUs*gust(p.xz+uOA);
        float U=min(us/.41*log(z/1e-4),uU10*1.6);
        vec3 r=vec3(uWd.x*U,0,uWd.y*U)-v.xyz;
        v.xyz+=(vec3(0,-9.81,0)+.7*length(r)*r)*dt*.5;
        p.xyz+=v.xyz*dt*.5;
        if(p.y<h){
          if(R(8.+float(s))<.62&&length(v.xyz)>.4){p.y=h+.002;v.xyz=vec3(v.x*.55,abs(v.y)*.45+us*R(10.)*1.2,v.z*.55);}
          else p.w=0.;
        }
      }
      p.w-=dt;
      if(length(p.xz-uCam.xz)>60.||H0(p.xz)<-1e3)p.w=0.;
    }
  }else{
    float h=H1(p.xz);vec2 d=p.xz-uCam.xz;
    if(p.w<=0.||dot(d,d)>3600.||p.y<h-.3||p.y>h+25.||h<-1e3){
      float a=R(1.)*6.2832,rr=sqrt(R(2.))*58.;
      vec2 xz=uCam.xz+vec2(cos(a),sin(a))*rr;
      p=vec4(xz.x,H1(xz)+.2+R(3.)*R(3.)*22.,xz.y,1.);
      v=vec4(0,0,0,R(4.));
      if(p.y<-1e3)p.w=0.;
    }
    float z=max(p.y-h,.05),us=uUs*gust(p.xz+uOA),U=us/.41*log(z/1e-4);
    vec3 tb=vec3(gn(p.xz*.08+uTime*.3),.6*gn(p.zx*.07-uTime*.25+5.),gn(p.xz*.09+11.+uTime*.2))*(.35+us*4.);
    v.xyz=mix(v.xyz,vec3(uWd.x*U,-.03,uWd.y*U)+tb,1.-exp(-dt*2.));
    p.xyz+=v.xyz*dt;
  }
  oP=p;oV=v;
}
