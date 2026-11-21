out vec4 o;
void main(){
  vec2 uv=(gl_FragCoord.xy-.5)/vec2(255,63);
  float H=sqrt(RT*RT-RG*RG),rho=H*uv.y,r=sqrt(rho*rho+RG*RG),dmin=RT-r,dmax=rho+H,d=dmin+uv.x*(dmax-dmin);
  float mu=d<=0.?1.:clamp((H*H-rho*rho-d*d)/(2.*r*d),-1.,1.);
  vec3 O=vec3(0,r,0),D=vec3(sqrt(1.-mu*mu),mu,0);
  float t=max(rs(O,D,RT).y,0.),dt=t/40.;
  vec3 od=vec3(0);
  for(int i=0;i<40;i++)od+=med(length(O+D*(float(i)+.5)*dt)-RG).e*dt;
  o=vec4(exp(-od),1);
}
