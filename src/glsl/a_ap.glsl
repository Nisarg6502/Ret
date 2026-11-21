// Aerial perspective volume, 32x32x32 over the view frustum, depth = sqrt(d/32km).
uniform mat4 uIVP;uniform vec3 uSun;uniform float uR,uSlice;
out vec4 o;
void main(){
  vec2 uv=gl_FragCoord.xy/32.;
  vec4 c=uIVP*vec4(uv*2.-1.,1,1);vec3 D=normalize(c.xyz/c.w);
  float z=(uSlice+.5)/32.,d=z*z*32.;
  vec3 O=vec3(0,uR,0),T;
  d=min(d,rayLen(O,D));
  vec3 L=integ(O,D,uSun,d,4+int(uSlice)/2,T);
  o=vec4(L,dot(T,vec3(1./3.)));
}
