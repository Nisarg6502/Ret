// Terrain height function. Twin of terrain() in src/world.js: keep both in sync.
// Dunes are asymmetric: gentle stoss side, slip face built at the angle of repose (tan 31 deg
// plus small contributions stays under 34 deg). Crests bend downwind where they break up
// (barchan horns). Two scales: megadunes and smaller superimposed dunes.
uniform vec2 uWind; // dune-forming wind direction (unit, xz)
float prof(float f,float fc,float g0){
  // stoss: concave toe, steepening into a sharp brink
  if(f<fc){float t=clamp((f-g0)/(fc-g0),0.,1.);return t*t*(.65+.35*(3.-2.*t));}
  return max(0.,1.-(f-fc)/(1.-fc));
}
float segm(float v,float k,float S,float sd){return smoothstep(-.3,.3,gn(vec2(v*.8+sd,k*1.37))+(S-.5)*1.6);}
// returns (height, lee weight). Lee weight is 1 on the slip face and fades over ~0.12 of a
// wavelength on either side; used to keep smaller dunes off megadune slip faces.
vec2 drow(float k,float f,float v,float H,float lam,float S,float sd,float dw,float g0,float tr){
  float m=segm(v,k,S,sd),m2=segm(v+.02,k,S,sd);
  float hb=.3*(1.-S);
  float b=hb*(1.-m);
  float db=hb*(m-m2)/.02;
  float Hl=H*m*(.75+.5*gn(vec2(v*.23+sd,k*.71)));
  float gp=sqrt(1.+(dw-db)*(dw-db));
  float lee=clamp(Hl*gp/(lam*tr),.004,.5);
  float x=f-b,fc=1.-lee;
  float lw=m*(x<fc?smoothstep(fc-.13,fc-.01,x):1.-smoothstep(1.,1.12,x));
  return vec2(Hl*prof(x,fc,min(g0,.9-lee)),lw);
}
float dunes(vec2 p,float lam,float H,float S,float g0,float sd,float tr,out float lw){
  float u=dot(p,uWind)/lam,v=dot(p,vec2(-uWind.y,uWind.x))/lam;
  float w=.35*gn(vec2(v*.55+sd,u*.08))+.12*gn(vec2(v*1.9-sd,u*.25));
  float w2=.35*gn(vec2((v+.02)*.55+sd,u*.08))+.12*gn(vec2((v+.02)*1.9-sd,u*.25));
  float dw=(w2-w)/.02;
  float ph=u+w,k=floor(ph),f=ph-k;
  vec2 a=drow(k,f,v,H,lam,S,sd,dw,g0,tr),c=drow(k-1.,f+1.,v,H,lam,S,sd,dw,g0,tr);
  lw=max(a.y,c.y);
  return max(a.x,c.x);
}
float bl(float lam,float s){return smoothstep(2.5,5.,lam/s);}
// p: world xz in metres; s: sample spacing (band limit); at: rock, salt, redness, sand supply
float terrain(vec2 p,float s,out vec4 at){
  float base=55.*fbm(p/9000.,4)+18.*fbm(p/2600.+50.,3);
  float E=smoothstep(-.15,.25,1.2*gn(p/16000.+7.7)+.5*gn(p/5200.+1.3)+.9*exp(-dot(p,p)/3.6e7));
  float S=clamp(.55+.9*gn(p/7000.+3.3),0.,1.);
  float P=smoothstep(.3,.46,gn(p/5500.+21.)+.25*gn(p/1300.-4.));
  float b1=bl(1300.,s),b2=bl(110.,s),b3=bl(60.,s);
  float mega=0.,small=0.,det=0.;
  float mH=78.*E*(1.-P),mS=clamp(S+.35,0.,1.);
  float lw=0.;
  if(b1>0.&&mH>0.)mega=b1*dunes(p,1300.,mH,mS,.05,0.,.6009,lw);
  float sH=(2.5+6.*S)*(.45+.55*E)*(1.-lw*b1)*(1.-P);
  if(b2>0.&&sH>0.)small=b2*dunes(p,110.,sH,S,.4*(1.-S),5.3,.5543,lw);
  if(b3>0.)det=b3*fbm(p/70.,3);
  float sand=base+mega+small-2.*P+.5*det*(1.-P);
  float r=fbm(p/2000.+9.,5)+.25*gn(p/600.);
  float t=r*4.;
  float terr=floor(t)+smoothstep(.8,.95,fract(t));
  float rk=base+24.*terr-34.-180.*E;
  if(b3>0.)rk+=3.*b3*fbm(p/50.,3);
  float red=clamp(.45+.7*gn(p/8000.+40.)+.25*E,0.,1.);
  at=vec4(smoothstep(0.,1.5,rk-sand),P*(1.-smoothstep(.3,1.5,small)),red,S);
  return max(sand,rk);
}
