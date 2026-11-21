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
// Star dunes: one per jittered 1.5 km cell, four arms with sharp crests that curve and wander.
// Cross-crest slope 0.5 and along-arm slope 0.24 keep every face under the angle of repose.
float star(vec2 p,float Hm,float gH){
  vec2 c=floor(p/1500.);float h=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    ivec2 k=ivec2(c)+ivec2(i,j);uint q=hsh(k+ivec2(7001,9113));
    vec2 d=p-(vec2(k)+.25+.5*vec2(float(q&255u),float((q>>8)&255u))/255.)*1500.;
    float H=Hm*(.55+.6*float((q>>16)&255u)/255.),L=H/.24;
    float R=8.2*H+40.;
    if(dot(d,d)>R*R)continue; // arm reach: length L=4.17H, half-width up to 7.5H + wander
    float a0=float(q>>24)/255.*6.2831853;
    for(int m=0;m<4;m++){
      float an=a0+float(m)*1.5707963+.6*(hf(k+ivec2(m*31,77))-.5);
      vec2 ax=vec2(cos(an),sin(an));
      float a=abs(dot(d,ax)),t=1.-a/L;
      if(t<=0.)continue;
      float b=dot(d,vec2(-ax.y,ax.x))+28.*gn(d*.0025+vec2(float(m)*7.,0))+a*a/L*.25*(hf(k+ivec2(m*31,78))-.5);
      float u=abs(b)*max(.5-H*gH,.2)/(1.5*H*t);
      if(u<1.)h=max(h,H*t*pow(1.-u,1.5));
    }
  }
  return h;
}
float erg(vec2 p){return smoothstep(-.15,.25,1.2*gn(p/16000.+7.7)+.5*gn(p/5200.+1.3)+.9*exp(-dot(p,p)/3.6e7));}
float bl(float lam,float s){return smoothstep(2.5,5.,lam/s);}
// p: world xz in metres; s: sample spacing (band limit); at: rock, salt, redness, sand supply
float terrain(vec2 p,float s,out vec4 at){
  float base=55.*fbm(p/9000.,4)+18.*fbm(p/2600.+50.,3);
  float E=erg(p),gE=length(vec2(erg(p+vec2(8,0))-E,erg(p+vec2(0,8))-E))/8.,gH=gE/max(E,1e-4);
  float S=clamp(.55+.9*gn(p/7000.+3.3),0.,1.);
  float P=smoothstep(.3,.46,gn(p/5500.+21.)+.25*gn(p/1300.-4.));
  // wind regime: multidirectional (star dunes) where V -> 1; a star field surrounds the start
  float V=smoothstep(.05,.45,gn(p/20000.+61.)+.3*gn(p/7000.-17.)+.8*exp(-dot(p,p)/6.4e7));
  float b1=bl(1100.,s),b2=bl(110.,s),b3=bl(60.,s);
  float mega=0.,small=0.,det=0.;
  float mH=150.*E,mS=clamp(S+.35,0.,1.);
  float lw=0.;
  if(b1>0.&&mH>0.){
    if(V<1.)mega=dunes(p,1100.,mH,mS,.05,0.,.6009,.15,gH,lw);
    if(V>0.)mega=mix(mega,star(p,230.*E,gH),V);
    mega*=b1;
  }
  float sH=(3.+7.*S)*(.45+.55*E),sk=(1.-lw*b1)*(1.-smoothstep(0.,.3,V)),l2;
  if(b2>0.&&sH>0.&&sk>0.)small=b2*sk*dunes(p,110.,sH,S,.4*(1.-S),5.3,.5543,.004,0.,l2);
  if(b3>0.)det=b3*fbm(p/70.,3);
  float sand=base+mega+small+.5*det;
  float r=fbm(p/2000.+9.,5)+.25*gn(p/600.);
  float t=r*4.;
  float terr=floor(t)+smoothstep(.8,.95,fract(t));
  float rk=base+24.*terr-34.-180.*E;
  if(b3>0.)rk+=3.*b3*fbm(p/50.,3);
  float red=clamp(.45+.7*gn(p/8000.+40.)+.25*E,0.,1.);
  // salt pans form on the flat interdune floors of playa regions
  at=vec4(smoothstep(0.,1.5,rk-sand),P*(1.-smoothstep(.4,2.5,mega+small)),red,S);
  return max(sand,rk);
}
