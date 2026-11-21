// Multiple scattering transfer LUT (Hillaire 2020, section 5.5): isotropic, infinite orders.
uniform vec3 uAlb; // ground albedo
out vec4 o;
void main(){
  vec2 uv=(gl_FragCoord.xy-.5)/31.;
  float mus=uv.x*2.-1.,r=RG+max(uv.y,.002)*(RT-RG);
  vec3 O=vec3(0,r,0),S=vec3(sqrt(max(0.,1.-mus*mus)),mus,0);
  vec3 Ls=vec3(0),Fs=vec3(0);
  for(int i=0;i<8;i++)for(int j=0;j<8;j++){
    float c=1.-2.*(float(i)+.5)/8.,s=sqrt(1.-c*c),ph=6.2831853*(float(j)+.5)/8.;
    vec3 D=vec3(s*cos(ph),c,s*sin(ph));
    vec2 g=rs(O,D,RG);
    float tm=g.x>0.?g.x:max(rs(O,D,RT).y,0.),dt=tm/20.;
    vec3 T=vec3(1),L=vec3(0),F=vec3(0);
    for(int k=0;k<20;k++){
      vec3 P=O+D*(float(k)+.5)*dt;float pr=length(P);Md m=med(pr-RG);
      vec3 sc=m.r+m.m+m.d,st=exp(-m.e*dt),ie=(1.-st)/max(m.e,vec3(1e-7));
      float smu=dot(P,S)/pr;
      L+=T*ie*sc*tr(pr,smu)*limb(pr,smu)*.0795775;
      F+=T*ie*sc;
      T*=st;
    }
    if(g.x>0.){vec3 P=O+D*g.x;float pr=length(P),smu=dot(P,S)/pr;L+=T*tr(pr,smu)*limb(pr,smu)*max(smu,0.)*uAlb*.3183099;}
    Ls+=L;Fs+=F;
  }
  Ls/=64.;Fs/=64.;
  o=vec4(Ls/(1.-Fs),1);
}
