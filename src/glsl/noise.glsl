// Integer hash + gradient noise. Bit-exact twin of src/world.js (hsh, gn, fbm).
#define PI 3.14159265
uniform uint uSeed;
uint hsh(ivec2 p){
  uint h=uint(p.x)*0x8da6b343u+uint(p.y)*0xd8163841u+uSeed*0xcb1ab31fu;
  h^=h>>16;h*=0x7feb352du;h^=h>>15;h*=0x846ca68bu;h^=h>>16;
  return h;
}
float hf(ivec2 p){return float(hsh(p)>>8)*(1./16777216.);}
float gg(uint h,vec2 d){return (float(h&65535u)/32767.5-1.)*d.x+(float(h>>16)/32767.5-1.)*d.y;}
float gn(vec2 x){
  vec2 i=floor(x),f=x-i;ivec2 c=ivec2(i);
  vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  float a=gg(hsh(c),f),b=gg(hsh(c+ivec2(1,0)),f-vec2(1,0)),
        d=gg(hsh(c+ivec2(0,1)),f-vec2(0,1)),e=gg(hsh(c+ivec2(1,1)),f-vec2(1,1));
  float ab=a+(b-a)*u.x,de=d+(e-d)*u.x;
  return ab+(de-ab)*u.y;
}
float fbm(vec2 p,int o){
  float s=0.,a=.5;
  for(int i=0;i<o;i++){s+=a*gn(p);p=vec2(1.6*p.x-1.2*p.y,1.2*p.x+1.6*p.y)+17.3;a*=.5;}
  return s;
}
