// L1 spherical harmonics of the light arriving at the ground: sky from the sky-view LUT, plus
// sunlight bounced off the sand for the lower hemisphere. Pixel k = coefficient k.
uniform vec3 uAlb;
out vec4 o;
void main(){
  int k=int(gl_FragCoord.x);
  vec3 c=vec3(0),E=vec3(0);
  for(int i=0;i<8;i++)for(int j=0;j<16;j++){
    float y=(float(i)+.5)/8.,s=sqrt(1.-y*y),ph=6.2831853*(float(j)+.5)/16.;
    vec3 D=vec3(s*cos(ph),y,s*sin(ph)),L=skyL(D);
    E+=L*y;
    c+=L*(k==0?.282095:k==1?.488603*D.y:k==2?.488603*D.z:.488603*D.x);
  }
  float w=6.2831853/128.;E*=w;c*=w;
  vec3 Es=tr(uR,uSun.y)*limb(uR,uSun.y)*max(uSun.y,0.);
  vec3 Lg=uAlb*.3183099*(Es+E);
  if(k==0)c+=Lg*.282095*6.2831853;
  if(k==1)c-=Lg*.488603*PI;
  o=vec4(c,1);
}
