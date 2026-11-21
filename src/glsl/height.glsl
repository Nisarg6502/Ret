// Terrain height function. Twin of terrain() in src/world.js: keep both in sync.
// Dunes are asymmetric: gentle stoss side, slip face built at the angle of repose (tan 31 deg
// plus small contributions stays under 34 deg). Crests bend downwind where they break up
// (barchan horns). Two scales: megadunes and smaller superimposed dunes. Where the wind
// regime is multidirectional, star dunes (pyramids with radiating sharp-crested arms) form.
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
float dunes(vec2 p,float lam,float H,float S,float g0,float sd,float tr,float lmin,float gH,out float lw){
  float u=dot(p,uWind)/lam,v=dot(p,vec2(-uWind.y,uWind.x))/lam;
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
      float u=abs(b)*cs/(1.5*hc);
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
    float W=2.4*Hr*gp/max(.53-Hr*gH,.3)*(1.+.9*max(d>0.?s:-s,0.)),x=abs(d)/W;
    if(x<1.)h=max(h,Hr*pow(1.-x,2.4));
  }
  return h;
}
float erg(vec2 p){vec2 l=p-vec2(-10000,5000);return smoothstep(-.15,.25,1.2*gn(p/16000.+7.7)+.5*gn(p/5200.+1.3)+.9*exp(-dot(p,p)/3.6e7)+.9*exp(-dot(l,l)/8.1e7));}
float bl(float lam,float s){return smoothstep(2.5,5.,lam/s);}
// p: world xz in metres; s: sample spacing (band limit); at: rock, salt, redness, sand supply
float terrain(vec2 p,float s,out vec4 at){
  float base=55.*fbm(p/9000.,4)+18.*fbm(p/2600.+50.,3);
  float E=erg(p),gE=length(vec2(erg(p+vec2(8,0))-E,erg(p+vec2(0,8))-E))/8.,gH=gE/max(E,1e-4);
  float S=clamp(.55+.9*gn(p/7000.+3.3),0.,1.);
  float P=smoothstep(.3,.46,gn(p/5500.+21.)+.25*gn(p/1300.-4.));
  // wind regime decides the dune form: multidirectional -> star (V), bimodal -> linear (B), else
  // transverse/barchanoid. The start sits in a star field with linear ridges out to the west-southwest.
  vec2 sc=p-vec2(1500,-500),lc=p-vec2(-10000,5000);
  float V=smoothstep(.05,.45,gn(p/20000.+61.)+.3*gn(p/7000.-17.)+.8*exp(-dot(sc,sc)/6.4e7));
  float B=smoothstep(.05,.45,gn(p/18000.+31.)+.3*gn(p/6000.-9.)+.95*exp(-dot(lc,lc)/8.1e7))*(1.-V);
  float b1=bl(1100.,s),b2=bl(110.,s),b3=bl(60.,s);
  float mega=0.,small=0.,det=0.;
  float mH=150.*E,mS=clamp(S+.35,0.,1.);
  float lw=0.;
  if(b1>0.&&mH>0.){
    if(V+B<1.)mega=dunes(p,1100.,mH,mS,.05,0.,.6009,.15,gH,lw);
    if(B>0.)mega=mix(mega,seif(p,150.*E,gH),B/max(1.-V,1e-4));
    if(V>0.)mega=mix(mega,star(p,230.*E,gH),V);
    mega*=b1;
  }
  float sH=(3.+7.*S)*(.45+.55*E),sk=(1.-lw*b1)*(1.-smoothstep(0.,.3,V))*(1.-smoothstep(0.,.3,B)),l2;
  if(b2>0.&&sH>0.&&sk>0.)small=b2*sk*dunes(p,110.,sH,S,.4*(1.-S),5.3,.5543,.004,0.,l2);
  if(b3>0.)det=b3*fbm(p/70.,3);
  float sand=base+mega+small+.5*det;
  float r=fbm(p/2000.+9.,5)+.25*gn(p/600.);
  float t=r*4.;
  float terr=floor(t)+smoothstep(.8,.95,fract(t));
  float rk=base+24.*terr-34.-180.*E;
  if(b3>0.)rk+=3.*b3*fbm(p/50.,3);
  float red=clamp(.45+.7*gn(p/8000.+40.)+.25*E+.3*B,0.,1.);
  // salt pans form on the flat interdune floors of playa regions
  at=vec4(smoothstep(0.,1.5,rk-sand),P*(1.-smoothstep(.4,2.5,mega+small)),red,S);
  return max(sand,rk);
}
