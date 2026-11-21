// Ground shading: sand (Oren-Nayar + opposition surge + quartz glints, wind ripples, heavy
// minerals in troughs, grain flow on slip faces), sandstone, salt crust. Lit by the sun and the moon
// through the atmosphere (shadows follow the key light), cloud shadows, sky irradiance (SH) with sand
// bounce, blowing-sand sheets in gusts, then aerial perspective.
in vec3 vRel;in vec2 vQ,vT0,vT1;in float vM,vH;
uniform highp sampler2DArray uA,uGr,uSh;
uniform int uL,uLast;uniform vec4 uFine;
uniform sampler2D uSH;uniform highp sampler3D uAP;
uniform vec3 uSun,uMoon;uniform float uR,uSunK,uMoonE,uKeyE,uPE,uU10,uUs,uTime,uRip;uniform int uKey;
uniform vec2 uRes,uWind,uWd;
out vec4 o;
vec3 irr(vec3 n){
  vec3 c0=texelFetch(uSH,ivec2(0,0),0).rgb,c1=texelFetch(uSH,ivec2(1,0),0).rgb,
       c2=texelFetch(uSH,ivec2(2,0),0).rgb,c3=texelFetch(uSH,ivec2(3,0),0).rgb;
  return max(vec3(0),.886227*c0+1.023327*(c1*n.y+c2*n.z+c3*n.x));
}
float vor(vec2 x){
  vec2 c=floor(x),f=x-c;float d1=8.,d2=8.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    ivec2 k=ivec2(c)+ivec2(i,j);uint h=hsh(k+ivec2(911,0));
    vec2 p=vec2(i,j)+.15+.7*vec2(float(h&255u),float((h>>8)&255u))/255.-f;
    float d=dot(p,p);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;
  }
  return sqrt(d2)-sqrt(d1);
}
void main(){
  if(uL>0&&vQ.x>uFine.x&&vQ.y>uFine.y&&vQ.x<uFine.z&&vQ.y<uFine.w)discard;
  float l0=float(uL),l1=float(min(uL+1,uLast));
  vec2 gr=texture(uGr,vec3(vT0,l0)).xy;vec4 at=texture(uA,vec3(vT0,l0));float sh=texture(uSh,vec3(vT0,l0)).r;
  if(vM>0.){gr=mix(gr,texture(uGr,vec3(vT1,l1)).xy,vM);at=mix(at,texture(uA,vec3(vT1,l1)),vM);sh=mix(sh,texture(uSh,vec3(vT1,l1)).r,vM);}
  float dist=length(vRel);vec3 V=-vRel/dist;
  vec3 N0=normalize(vec3(-gr.x,1,-gr.y)),N=N0;
  float slope=length(gr),rock=at.x,salt=at.y,red=at.z;
  vec2 q=vQ;
  // --- sand
  vec3 alb=mix(vec3(.60,.47,.33),vec3(.55,.31,.16),red);
  alb*=1.+.06*gn(q*.013)+.04*gn(q*.11);
  float sand=(1.-rock)*(1.-salt);
  // wind ripples: crests across the wind, gentle stoss, steep lee, absent on slip faces and in the lee
  vec2 W=uWind,Wp=vec2(-W.y,W.x);
  float u=dot(q,W),v=dot(q,Wp);
  float ph=6.2831853*(u/.11-uRip+2.2*gn(vec2(u,v)*.37)+.7*gn(vec2(u,v)*1.9));
  float fw=fwidth(ph);
  float lee=dot(gr,W);
  float rm=sand*(1.-smoothstep(.2,.36,slope))*smoothstep(-.32,-.12,lee)*(1.-smoothstep(.8,2.,fw));
  if(rm>0.){
    float A=.0045*rm*(.6+.6*gn(q*.08));
    float dh=cos(ph)-.5*cos(2.*ph);
    vec2 g=A*dh*57.12*W;
    N=normalize(N+vec3(-g.x,0,-g.y));
    alb*=1.-.13*rm*max(.3-(sin(ph)-.25*sin(2.*ph)),0.);
  }
  // coarse megaripples in flat interdunes
  float mr=sand*(1.-smoothstep(.04,.12,slope))*(1.-at.w)*(1.-smoothstep(.12,.35,fwidth(u/1.6)));
  if(mr>0.){
    float p2=6.2831853*(u/1.6+.6*gn(vec2(u,v)*.05));
    vec2 g=.06*mr*(cos(p2)-.5*cos(2.*p2))*3.927*W;
    N=normalize(N+vec3(-g.x,0,-g.y));alb*=1.-.1*mr*(.5+.5*sin(p2));
  }
  // grain flow on slip faces
  float sf=smoothstep(.42,.56,slope)*sand;
  if(sf>0.){
    vec2 dn=gr/slope,dp=vec2(-dn.y,dn.x);
    float g=gn(vec2(dot(q,dp)*1.3,dot(q,dn)*.09))+.5*gn(vec2(dot(q,dp)*4.,dot(q,dn)*.3));
    alb*=1.+.09*g*sf;N=normalize(N+vec3(dp.x,0,dp.y)*g*.06*sf);
  }
  // --- sandstone: strata, cross-bedding, desert varnish
  if(rock>0.){
    float st=sin(vH*2.4+3.*gn(q*.004)+.8*gn(vec2(q.x+q.y,vH*4.)*.05));
    vec3 ra=vec3(.44,.28,.18)*(.82+.13*st+.08*gn(q*.3));
    ra=mix(ra,vec3(.16,.10,.07),.55*smoothstep(.1,.5,gn(q*.011))*smoothstep(.25,.6,slope));
    vec3 rn=vec3(gn(q*.7),0,gn(q*.7+9.))*.35+vec3(gn(q*3.1),0,gn(q*3.1+4.))*.12;
    N=normalize(mix(N,normalize(N0+rn),rock));
    float cover=smoothstep(.35,.1,slope)*smoothstep(.0,.3,gn(q*.05)+.15);
    alb=mix(alb,ra,rock*(1.-.8*cover));
  }
  // --- salt crust: polygon cracks with raised rims
  if(salt>0.){
    float e=1.-smoothstep(.0,.06,vor(q/1.3))*(1.-smoothstep(.5,3.,dist*.02));
    vec3 sa=vec3(.80,.78,.73)*(1.-.35*e)*(.93+.07*gn(q*.5));
    alb=mix(alb,sa,salt);
  }
  // --- lighting
  float r=RG+max(vH,0.)*.001,NV=max(dot(N,V),1e-3);
  float s2=mix(.3,.1,rock),A=1.-.5*s2/(s2+.33),B=.45*s2/(s2+.09);
  vec3 col=alb*.3183099*irr(N),Eg=vec3(0);
  float csh=1.;
  if(uSun.y>.03){vec2 pk=(vRel.xz+uSun.xz/uSun.y*(7000.-vH))*.001+uCamKm;csh=1.-.72*(1.-exp(-cloudD(pk,3)*3.2));}
  for(int i=0;i<2;i++){
    vec3 L=i==0?uSun:uMoon;
    float e=i==0?uSunK*csh:uMoonE;
    if(L.y<-.03||(i==1&&uSun.y>.05))continue;
    vec3 Ts=tr(r,L.y)*limb(r,L.y)*e*(((i==0)==(uKey==0))?sh:1.);
    float NL=dot(N,L),LV=dot(L,V);
    float ss=LV-max(NL,0.)*NV,on=max(NL,0.)*(A+B*max(ss,0.)/max(max(NL,NV),1e-3)+B*min(ss,0.));
    float tg=sqrt(max(0.,(1.-LV)/(1.+LV)));
    col+=alb*.3183099*Ts*max(on,0.)*(1.+.38*sand/(1.+tg/.055));
    Eg+=Ts*(.6+2.4*pow(max(-LV,0.),6.))*max(L.y,.2);
    // quartz glints
    if(dist<25.&&NL>0.){
      float fp=min(length(dFdx(q)),length(dFdy(q))),k=ceil(log2(max(fp,.0005)/.0025)),c=.0025*exp2(k);
      uint h=hsh(ivec2(floor(q/c))+ivec2(int(k)*7919,31337));
      vec3 rn=vec3(float(h&255u),0,float((h>>8)&255u))/255.-.5;
      vec3 n=normalize(N+rn*1.2);
      float g=pow(max(dot(n,normalize(L+V)),0.),4000.)*step(float(h>>24),32.);
      col+=Ts*g*9.*sand*(1.-smoothstep(10.,25.,dist));
    }
  }
  // --- blowing sand: saltation sheets stream downwind where gusts lift u* over the threshold;
  // windward slopes speed the wind up, slip faces sit in the sheltered lee
  if(sand>0.&&uUs>.11){
    vec2 Wq=vec2(-uWd.y,uWd.x);
    float al=dot(q,uWd),ac=dot(q,Wq),t=uTime,U=uU10;
    float gst=1.+.5*gn((q-uWd*U*t*.9)/70.)+.25*gn((q-uWd*U*t*1.1)/23.+7.);
    float us=uUs*gst*clamp(1.+1.6*dot(gr,uWd),.2,1.7);
    float f=smoothstep(.21,.4,us)*sand;
    if(f>0.){
      float s1=gn(vec2(al/9.-t*U*.07,ac/1.3)),s2=gn(vec2(al/2.5-t*U*.2,ac/.32))*(1.-smoothstep(.4,1.2,fwidth(ac/.32)));
      float st=f*smoothstep(0.,.42,s1*.75+s2*.45);
      // grains in the air add their own scattered light above the bed and veil the ripples
      col=mix(col,alb*.3183*(Eg+irr(vec3(0,1,0))),st*.35)+alb*.3183*Eg*st*.55;
    }
  }
  vec4 ap=texture(uAP,vec3(gl_FragCoord.xy/uRes,sqrt(dist/32000.)));
  o=vec4(min((col*ap.a+ap.rgb*uKeyE)*uPE,vec3(6e4)),1);
}
