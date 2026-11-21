// Atmosphere model after Hillaire 2020 ("A Scalable and Production Ready Sky and Atmosphere
#ifndef PI
#define PI 3.14159265
#endif
// Rendering Technique"). Units: km. Plus a mineral dust layer (Saharan-type optics).
#define RG 6360.
#define RT 6460.
uniform float uDust;      // vertical optical depth of dust at 550 nm
uniform sampler2D uTrans; // transmittance LUT 256x64
uniform sampler2D uMS;    // multiple scattering LUT 32x32
const vec3 RAY=vec3(5.802,13.558,33.1)*1e-3;
const vec3 OZO=vec3(.65,1.881,.085)*1e-3;
const vec3 DW=vec3(.97,.95,.9); // dust single scattering albedo: iron oxides absorb blue
struct Md{vec3 r;vec3 m;vec3 d;vec3 e;};
Md med(float h){
  h=max(h,0.);
  float dr=exp(-h/8.),dm=exp(-h/1.2),dd=exp(-h/1.6),oz=max(0.,1.-abs(h-25.)/15.);
  Md o;o.r=RAY*dr;o.m=vec3(3.996e-3*dm);
  float de=uDust/1.6*dd;o.d=DW*de;
  o.e=o.r+vec3(8.396e-3*dm+de)+OZO*oz;
  return o;
}
float phR(float c){return .0596831*(1.+c*c);}
float phM(float c,float g){float g2=g*g;return .1193662*(1.-g2)*(1.+c*c)/((2.+g2)*pow(max(1.+g2-2.*g*c,1e-4),1.5));}
float phH(float c,float g){float g2=g*g;return .0795775*(1.-g2)/pow(max(1.+g2-2.*g*c,1e-4),1.5);}
vec2 rs(vec3 o,vec3 d,float r){float b=dot(o,d),c=dot(o,o)-r*r,D=b*b-c;if(D<0.)return vec2(-1);D=sqrt(D);return vec2(-b-D,-b+D);}
vec2 sub(vec2 u,vec2 n){return (u*(n-1.)+.5)/n;}
vec2 tUV(float r,float mu){
  float H=sqrt(RT*RT-RG*RG),rho=sqrt(max(0.,r*r-RG*RG));
  float d=max(0.,-r*mu+sqrt(max(0.,r*r*(mu*mu-1.)+RT*RT)));
  float dmin=RT-r,dmax=rho+H;
  return sub(vec2((d-dmin)/(dmax-dmin),rho/H),vec2(256,64));
}
vec3 tr(float r,float mu){return texture(uTrans,tUV(r,mu)).rgb;}
vec3 msl(float r,float mu){return texture(uMS,sub(vec2(mu*.5+.5,clamp((r-RG)/(RT-RG),0.,1.)),vec2(32))).rgb;}
// sun visibility over the planet's limb, softened over the solar disc
float limb(float r,float mu){float h=-sqrt(max(0.,1.-RG*RG/(r*r)));return smoothstep(h-.0047,h+.0047,mu);}
// Scattered light along a ray of length tmax from O. Quadratic step distribution.
vec3 integ(vec3 O,vec3 D,vec3 S,float tmax,int N,out vec3 T){
  float cs=dot(D,S),pr=phR(cs),pm=phM(cs,.8),pd=phH(cs,.72);
  vec3 L=vec3(0);T=vec3(1);float t0=0.;
  for(int i=0;i<N;i++){
    float x=(float(i)+1.)/float(N),t1=tmax*x*x,dt=t1-t0;
    vec3 P=O+D*mix(t0,t1,.3);t0=t1;
    float r=length(P);Md m=med(r-RG);
    float smu=dot(P,S)/r;
    vec3 sc=m.r+m.m+m.d;
    vec3 Sg=tr(r,smu)*limb(r,smu)*(m.r*pr+m.m*pm+m.d*pd)+msl(r,smu)*sc;
    vec3 st=exp(-m.e*dt);
    L+=T*(Sg-Sg*st)/max(m.e,vec3(1e-7));
    T*=st;
  }
  return L;
}
// Distance to the atmosphere boundary or the ground.
float rayLen(vec3 O,vec3 D){vec2 g=rs(O,D,RG);if(g.x>0.)return g.x;return max(rs(O,D,RT).y,0.);}
