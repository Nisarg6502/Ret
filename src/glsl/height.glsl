// Terrain height function. Twin of terrain() in src/world.js: keep both in sync.
// A sea of sand with no flat floors. A wind-regime map picks the large dune form, blended over
// kilometres: transverse ridges, star dunes, linear (seif) dunes, network (akle) dunes and isolated
// megabarchans. Smaller dunes and low zibar undulations cover everything the big dunes leave gentle.
// Every form is built so no sand slope exceeds the angle of repose (slip faces ~31 deg).
uniform vec2 uWind; // dune-forming wind direction (unit, xz)
float prof(float f,float fc,float g0){
  // stoss: concave toe, steepening into a sharp brink
  if(f<fc){float t=clamp((f-g0)/(fc-g0),0.,1.);return t*t*(2.-t);}
  return max(0.,1.-(f-fc)/(1.-fc));
}
float segm(float v,float k,float S,float sd){return smoothstep(-.3,.3,gn(vec2(v*.8+sd,k*1.37))+(S-.5)*1.6);}
// returns (height, lee weight). The lee weight measures how steep this dune's lee is relative to
// the angle of repose, spread over ~0.12 of a wavelength either side of the slip face; it is used
// to scale smaller dunes off megadune slip faces. lmin: minimum lee width (fraction of lam), so
// low dunes get gentle lees instead of tiny slip faces.
vec2 drow(float k,float f,float v,float H,float lam,float S,float sd,float du,float dw,float g0,float tr,float lmin,float gH){
  float m=segm(v,k,S,sd),m2=segm(v+.02,k,S,sd);
  float hb=.3*(1.-S);
  float b=hb*(1.-m);
  float db=hb*(m-m2)/.02;
  float Hl=H*m*(.75+.5*gn(vec2(v*.23+sd,k*.71)));
  float gp=sqrt(du*du+(dw-db)*(dw-db)); // |grad phase| * lam
  float te=max(tr-Hl*gH,.3); // slope budget left after the amplitude field's own gradient
  float lee=clamp(Hl*gp/(lam*te),lmin,.5),r=min(1.,Hl*gp/(lee*lam*te));
  float x=f-b,fc=1.-lee;
  float lw=r*(x<fc?smoothstep(fc-.13,fc-.01,x):1.-smoothstep(1.,1.12,x));
  return vec2(Hl*prof(x,fc,min(g0,.9-lee)),lw);
}
float dunes(vec2 p,vec2 W,float lam,float H,float S,float g0,float sd,float tr,float lmin,float gH,out float lw){
  float u=dot(p,W)/lam,v=dot(p,vec2(-W.y,W.x))/lam;
  float w=.5*gn(vec2(v*.55+sd,u*.08))+.18*gn(vec2(v*1.9-sd,u*.25));
  float w2=.5*gn(vec2((v+.02)*.55+sd,u*.08))+.18*gn(vec2((v+.02)*1.9-sd,u*.25));
  float w3=.5*gn(vec2(v*.55+sd,(u+.02)*.08))+.18*gn(vec2(v*1.9-sd,(u+.02)*.25));
  float dw=(w2-w)/.02,du=1.+(w3-w)/.02;
  float ph=u+w,k=floor(ph),f=ph-k;
  vec2 a=drow(k,f,v,H,lam,S,sd,du,dw,g0,tr,lmin,gH),c=drow(k-1.,f+1.,v,H,lam,S,sd,du,dw,g0,tr,lmin,gH);
  lw=max(a.y,c.y);
  return max(a.x,c.x);
}
// Star dunes (multidirectional winds): irregular, not a grid. A quarter of cells are empty; each has
// 2 to 5 arms of different length and crest height that curve and wander, one steep and one gentler
// flank, short spurs behind the peak, and a broad low pedestal. Cross slope <= 0.38 times the crest
// wander factor, along-arm <= 0.25, pedestal ~0.05: every face stays under the angle of repose.
float star(vec2 p,float Hm,float gH){
  vec2 c=floor(p/1800.);float h=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    ivec2 k=ivec2(c)+ivec2(i,j);uint q=hsh(k+ivec2(7001,9113));
    if((q&3u)==0u)continue;
    vec2 d=p-(vec2(k)+.2+.6*vec2(float((q>>3)&255u),float((q>>11)&255u))/255.)*1800.;
    float H=Hm*(.5+.6*float((q>>19)&255u)/255.),L=H/.24;
    float R=8.2*H+120.;
    if(dot(d,d)>R*R)continue;
    float rb=min(2.*L,1400.),db=length(d)/rb,hb=db<1.?.2*H*(1.-db)*(1.-db):0.;
    float na=2.+float((q>>27)&1u)+float((q>>28)&1u)+float((q>>2)&1u),a0=float(q>>29)*.785398+hf(k+ivec2(5,5)),ha=0.;
    for(int m=0;m<5;m++){
      if(float(m)>=na)break;
      float r1=hf(k+ivec2(m*31,77)),r2=hf(k+ivec2(m*31,78)),r3=hf(k+ivec2(m*31,79));
      float an=a0+float(m)*6.2831853/na+.9*(r1-.5);
      vec2 ax=vec2(cos(an),sin(an));
      float La=L*1.35*(.95+.45*r2),Hc=H*(.7+.3*r3),a=dot(d,ax),ae=a<0.?-a*1.3:a,t=1.-ae/La;
      if(t<=0.)continue;
      // concave ridgeline steepening toward the summit, wandering crest, secondary peaks
      float hc=Hc*pow(t,1.35)*(1.+.08*gn(vec2(ae/450.,float(m)*3.7+r3*9.)));
      float b=dot(d,vec2(-ax.y,ax.x))+70.*gn(d*.0017+vec2(float(m)*7.,0))+22.*gn(d*.006+vec2(0,float(m)*5.))+ae*ae/La*.4*(r1-.5);
      float cs=max((b>0.==r2>.5?.38:.38*(.5+.5*r3))-H*gH,.19);
      float u=abs(b)/max(1.5*hc/cs,60.); // half-width at least 60 m: arm tips fade gently
      if(u<1.)ha=max(ha,hc*pow(1.-u,1.5));
    }
    h=max(h,ha+hb);
  }
  return h;
}
// Linear (seif) dunes (bimodal winds): long ridges parallel to the net wind, 1.6 km apart. Sharp
// sinuous crests whose steep side switches along the ridge, heights rising and falling, ridges that
// die out and restart offset from their neighbours. Broad plinths (about 8x as wide as high) rising
// to a sharp crest; cross-crest slope <= 0.53 by construction.
float seif(vec2 p,float H0,float gH){
  float u=dot(p,uWind),v=dot(p,vec2(-uWind.y,uWind.x));
  float w=170.*gn(vec2(u/2600.,3.1))+55.*gn(vec2(u/800.,8.7));
  float dw=(170.*gn(vec2((u+20.)/2600.,3.1))+55.*gn(vec2((u+20.)/800.,8.7))-w)/20.;
  float gp=sqrt(1.+dw*dw),vv=(v+w)/1600.,k0=floor(vv+.5),h=0.;
  for(int i=-1;i<=1;i++){
    float k=k0+float(i),d=(vv-k)*1600.;
    float Hr=H0*(.5+.5*gn(vec2(u/2600.,k*7.31)))*smoothstep(-.5,.15,gn(vec2(u/7000.,k*3.17+1.)));
    if(Hr<=0.)continue;
    float s=gn(vec2(u/1500.,k*5.71+2.));
    float W=max(2.4*Hr*gp/max(.53-Hr*gH,.3),90.)*(1.+.9*max(d>0.?s:-s,0.)),x=abs(d)/W;
    if(x<1.)h=max(h,Hr*pow(1.-x,2.4));
  }
  return h;
}
// Megabarchans: isolated giant crescents (one per jittered 3.2 km cell, some cells empty), horns
// curving downwind, windward slope steepening into a slip face. The lee budget subtracts the
// slope of the crescent's own height falloff toward the horns.
float mbar(vec2 p,float Hm,float gH){
  vec2 W=uWind,Wp=vec2(-W.y,W.x),c=floor(p/3200.);float h=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    ivec2 k=ivec2(c)+ivec2(i,j);uint q=hsh(k+ivec2(331,1999));
    if((q&7u)==0u)continue;
    vec2 d=p-(vec2(k)+.3+.4*vec2(float((q>>3)&255u),float((q>>11)&255u))/255.)*3200.;
    float s=.7+.6*float((q>>19)&255u)/255.,H=Hm*s,A=1100.*s,y=dot(d,Wp)/A,y2=y*y;
    if(y2>=1.)continue;
    float Hl=H*(1.-y2),dm=2.*H*abs(y)/A;
    float x=dot(d,W)-.55*A*y2,gp=sqrt(1.+1.21*y2);
    float te=max(sqrt(max(.3-dm*dm,.01))-Hl*gH,.12),Ll=max(Hl*gp/te,60.),Ls=6.*Hl*gp;
    float hh=0.;
    if(x<0.){float tt=1.+x/Ls;if(tt>0.)hh=Hl*tt*tt*(2.-tt);}
    else if(x<Ll)hh=Hl*(1.-x/Ll);
    h=max(h,hh);
  }
  return h;
}
// Network (akle) dunes: two families of crescentic ridges from winds about 70 degrees apart cross
// into a lattice of closed hollows.
float net(vec2 p,float H,float S,float gH){
  vec2 W1=vec2(.8134*uWind.x-.5817*uWind.y,.5817*uWind.x+.8134*uWind.y),W2=vec2(.8134*uWind.x+.5817*uWind.y,-.5817*uWind.x+.8134*uWind.y);
  float l1,l2;
  return max(dunes(p,W1,850.,H,S,.06,1.7,.6009,.15,gH,l1),dunes(p,W2,720.,H*.85,S,.06,8.3,.6009,.15,gH,l2));
}
float erg(vec2 p){return smoothstep(-.5,0.,1.2*gn(p/16000.+7.7)+.5*gn(p/5200.+1.3)+.9*exp(-dot(p,p)/3.6e7));}
// Large dune layer. Regime scores -> weights (squared and normalised, so each landscape reads as
// its own place; transverse fills what the others leave). Each form gets the gradient of its own
// weight added to its slope budget, so blending never pushes a slope past the angle of repose.
float rw(float n){return smoothstep(0.,.4,n);}
vec4 regimes(vec2 p,out float wT){
  vec2 a=p-vec2(1500,-500),b=p-vec2(-10000,5000),c=p-vec2(11000,2000),d=p-vec2(0,-12000);
  float st=exp(-dot(a,a)/2.5e7); // keep the star field around the start pure
  vec4 s=vec4(rw(gn(p/20000.+61.)+.3*gn(p/7000.-17.)+.8*exp(-dot(a,a)/6.4e7)+.1),
              rw(gn(p/18000.+31.)+.3*gn(p/6000.-9.)+.95*exp(-dot(b,b)/8.1e7)-.6*st),
              rw(gn(p/19000.-44.)+.3*gn(p/6500.+3.)+.95*exp(-dot(c,c)/8.1e7)-.1-.6*st),
              rw(gn(p/21000.+13.)+.3*gn(p/7500.+29.)+.95*exp(-dot(d,d)/8.1e7)-.1-.6*st));
  float sT=1.-max(max(s.x,s.y),max(s.z,s.w));
  s*=s;sT*=sT;
  float sum=s.x+s.y+s.z+s.w+sT;
  wT=sT/sum;return s/sum;
}
float mega(vec2 p,float E,float gH,float S,out float lw,out vec4 wr){
  float wT,tx,tz;
  wr=regimes(p,wT);vec4 rx=regimes(p+vec2(16,0),tx),rz=regimes(p+vec2(0,16),tz);
  vec4 gw=sqrt((rx-wr)*(rx-wr)+(rz-wr)*(rz-wr))/16./max(wr,vec4(.02));
  float gT=length(vec2(tx-wT,tz-wT))/16./max(wT,.02),h=0.;lw=0.;
  if(wT>.001)h+=wT*dunes(p,uWind,1100.,150.*E,clamp(S+.35,0.,1.),.05,0.,.6009,.15,gH+gT,lw);
  lw*=wT;
  if(wr.x>.001)h+=wr.x*star(p,230.*E,gH+gw.x);
  if(wr.y>.001)h+=wr.y*seif(p,150.*E,gH+gw.y);
  if(wr.z>.001)h+=wr.z*net(p,110.*E,.9,gH+gw.z);
  if(wr.w>.001)h+=wr.w*mbar(p,160.*E,gH+gw.w);
  return h;
}
float bl(float lam,float s){return smoothstep(2.5,5.,lam/s);}
// p: world xz in metres; s: sample spacing (band limit); at: rock, (unused), sand colour, supply
float terrain(vec2 p,float s,out vec4 at){
  float base=55.*fbm(p/9000.,4)+18.*fbm(p/2600.+50.,3);
  float E=erg(p),gE=length(vec2(erg(p+vec2(8,0))-E,erg(p+vec2(0,8))-E))/8.,gH=gE/max(E,1e-4);
  float S=clamp(.55+.9*gn(p/7000.+3.3),0.,1.);
  float b1=bl(1100.,s),b2=bl(110.,s),b3=bl(60.,s);
  float big=0.,small=0.,det=0.,lw=0.;vec4 wr=vec4(0);
  if(b1>0.)big=b1*mega(p,E,gH,S,lw,wr);
  // smaller dunes everywhere the big dunes are gentle, scaled (not reshaped) by the big dunes'
  // regional steepness (largest drop within 120 m, so they taper out over 100 m or more and stay
  // off ridge crests)
  float sH=(3.+7.*S)*(.5+.5*E);
  if(b2>0.){
    float l3;vec4 w3;
    float m0=big/max(b1,1e-4);
    float dd=0.;
    for(int i=0;i<6;i++){float a=float(i)*1.0471976;dd=max(dd,abs(mega(p+vec2(cos(a),sin(a))*120.,E,gH,S,l3,w3)-m0));}
    float sk=(1.-lw*b1)*(1.-smoothstep(.025,.1,b1*dd/120.)),l2;
    if(sk>0.)small=b2*sk*dunes(p,uWind,110.,sH,S,.2*(1.-S),5.3,.5543,.004,0.,l2);
  }
  // zibar: low rolling undulations of coarse sand, so no ground is ever flat
  if(b3>0.)det=b3*(.5*fbm(p/70.,3)+2.2*fbm(p/190.+3.,3));
  float sand=base+big+small+det;
  // sandstone outcrops rising out of the sand like islands, layered
  float rr=fbm(p/2600.+9.,5)+.3*gn(p/700.),o=smoothstep(.3,.62,rr),tt=rr*7.;
  float rk=base-40.+o*(130.+20.*(floor(tt)+smoothstep(.75,.95,fract(tt))));
  if(b3>0.)rk+=3.*b3*fbm(p/50.,3);
  // sand colour zones: white gypsum, pale gold, orange, deep red (linear dunes run redder)
  vec2 wg=p-vec2(7000,7500);
  float gy=smoothstep(.3,.45,gn(p/15000.+77.)+.6*exp(-dot(wg,wg)/1.6e7));
  float red=mix(clamp(.5+.6*gn(p/9000.+40.)+.2*E+.3*wr.y-.15*wr.z,.12,1.),.02,gy);
  at=vec4(smoothstep(0.,1.5,rk-sand),0.,red,S);
  return max(sand,rk);
}
