// Final sky: atmosphere (sun + moon LUTs), sun and moon discs, stars, Milky Way, the planet's ring
// system (single-scattering thin layer with the planet's shadow) and a drifting cloud deck.
uniform mat4 uIVP;uniform mat3 uCel;uniform vec3 uPole;uniform float uTime,uPix,uStarK,uPE;
in vec2 vUv;out vec4 o;
vec3 stars(vec3 d,float ty){
  vec3 q=d*260.,c=floor(q);
  ivec3 ic=ivec3(c);
  uint h=hsh(ivec2(ic.x*1973+ic.z*9277,ic.y*26699-ic.z*3511));
  float p=float(h>>8)/16777216.;
  if(p>.005)return vec3(0);
  uint h2=hsh(ivec2(int(h),17));
  vec3 j=vec3(float(h2&255u),float((h2>>8)&255u),float((h2>>16)&255u))/255.;
  vec3 sp=normalize((c+.2+.6*j)/260.);
  float a=length(cross(sp,d));
  float m=max(6.5+2.*log(p/.005+1e-9)/2.302585,-1.4);
  float F=pow(10.,-.4*m)*1.8e-11;
  float sg=uPix*.75,I=F/(6.2831853*sg*sg)*exp(-a*a/(2.*sg*sg));
  float t=float(h2>>24)/255.;
  vec3 col=mix(vec3(1.,.72,.48),vec3(.72,.82,1.),smoothstep(.2,.8,t));
  float tw=1.+.6*(1.-ty)*sin(uTime*(9.+14.*t)+t*40.);
  return col*I*tw;
}
// Milky Way in galactic coordinates: bright bulge toward the galactic centre, mottled star clouds,
// dark dust lanes along the plane.
vec3 milky(vec3 e){
  vec3 gp=vec3(-.868,.456,-.198),gc=vec3(-.055,-.484,-.873),gy=cross(gp,gc);
  float b=asin(clamp(dot(e,gp),-1.,1.)),l=atan(dot(e,gy),dot(e,gc));
  float core=exp(-l*l/1.2),w=.15+.13*core;
  float n=fbm(vec2(l*3.2,b*10.),5)*.6+.5;
  float rift=1.-.8*exp(-pow((b-.025-.03*sin(l*2.3))/(.03+.03*core),2.))*(1.-smoothstep(.2,1.7,abs(l)));
  float I=exp(-b*b/(w*w))*(.3+.7*core)*(.25+n*n*1.3)*rift+.08*exp(-b*b/.3);
  return vec3(1.,.92,.82)*I*7e-9;
}
// Rings in the equatorial plane, 1.85 to 2.25 planet radii: dark dusty material, banded, one gap.
float ringTau(float r){
  float x=(r-1.85)/.4;
  if(x<0.||x>1.)return 0.;
  float t=.12+.6*smoothstep(.05,.35,x)-.55*smoothstep(.56,.6,x)*(1.-smoothstep(.65,.7,x))
         +.22*gn(vec2(x*38.,.5))+.1*gn(vec2(x*210.,2.5));
  return max(t,0.)*smoothstep(0.,.04,x)*(1.-smoothstep(.93,1.,x));
}
vec4 rings(vec3 D){
  float dp=dot(D,uPole);
  if(dp>-1e-4)return vec4(0,0,0,1);
  vec3 P=D*(-RG*uPole.y/dp)+vec3(0,RG,0); // relative to the planet centre
  float tau=ringTau(length(P)/RG);
  if(tau<=0.)return vec4(0,0,0,1);
  float mv=-dp,ms=dot(uSun,uPole),a=max(abs(ms),.02);
  float sh=rs(P,uSun,RG).x>0.?0.:1.;
  float L;
  if(ms>0.)L=a/(a+mv)*(1.-exp(-tau*(1./a+1./mv)));
  else{float d=a-mv;L=abs(d)<1e-3?a*tau/(mv*mv)*exp(-tau/mv):a*(exp(-tau/a)-exp(-tau/mv))/d;}
  return vec4(vec3(.62,.56,.48)*.06*L*sh,exp(-tau/mv));
}
void main(){
  vec4 c=uIVP*vec4(vUv*2.-1.,1,1);vec3 D=normalize(c.xyz/c.w);
  vec3 T=tr(uR,D.y)*limb(uR,D.y),bg=vec3(0);
  if(D.y>-.02){
    vec3 e=uCel*D;
    bg=uStarK*stars(e,max(D.y,0.))+milky(e);
    // moon: Lommel-Seeliger shading, maria, faint planetshine on the dark side
    float rm=.0045,cm=dot(D,uMoon);
    if(cm>cos(rm*1.5+uPix*2.)){
      vec3 q=(D-uMoon*cm)/rm;float l2=dot(q,q),z=sqrt(max(0.,1.-l2));
      vec3 n=normalize(q-uMoon*z),b1=normalize(cross(uMoon,vec3(0,1,0))),b2=cross(b1,uMoon);
      float mu0=dot(n,uSun),al=.12*(.72+.45*(fbm(vec2(dot(q,b1),dot(q,b2))*1.8+3.,4)+.2));
      vec3 L=vec3(1.,.97,.92)*al*(.3183*(mu0>0.?2.*mu0/(mu0+z):0.)+1.2e-4);
      bg=mix(bg,L,1.-smoothstep(1.-uPix/rm,1.+uPix/rm,sqrt(l2)));
    }
  }
  float a=acos(clamp(dot(D,uSun),-1.,1.)),rs0=.004653;
  if(a<rs0+uPix){
    float x=min(a/rs0,1.),mu=sqrt(1.-x*x);
    bg+=14702.*(1.-.6*(1.-mu))/.8*smoothstep(rs0+uPix*.5,rs0-uPix*.5,a);
  }
  // rings: physically far brighter than moonlit sand at night; softly capped (an exposure choice)
  // so the sunlit arc keeps its banding instead of flooding the night
  vec4 rg=rings(D);
  bg=bg*rg.a+rg.rgb/(1.+rg.rgb*uPE*.12);
  vec3 col=skyL(D)+T*bg;
  // cloud deck
  if(D.y>.012){
    float t=rs(vec3(0,uR,0),D,RG+7.).y;
    vec3 P=vec3(0,uR,0)+D*t;
    float dn=cloudD(P.xz+uCamKm,5)*smoothstep(.012,.09,D.y);
    if(dn>0.){
      float al=1.-exp(-dn*3.2),r=RG+7.,cs=dot(D,uSun),cm=dot(D,uMoon);
      vec3 E=tr(r,uSun.y)*limb(r,uSun.y)*uSunK*(phH(cs,.6)*.7+phH(cs,-.25)*.3)
            +tr(r,uMoon.y)*limb(r,uMoon.y)*uMoonE*(phH(cm,.6)*.7+phH(cm,-.25)*.3);
      vec3 Lc=(E*(.9+1.6*dn)*4.+skyL(vec3(0,1,0))*1.4)*al;
      vec3 Tc=T/max(tr(r,D.y),vec3(1e-4));
      col=col*(1.-al*.8)+Tc*Lc;
    }
  }
  o=vec4(min(col*uPE,vec3(6e4)),1);
}
