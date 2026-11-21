uniform highp sampler2DArray uH;uniform int uL;
out vec4 o;
float h(ivec2 t){return texelFetch(uH,ivec3(t%TS,uL),0).r;}
void main(){
  ivec2 t=ivec2(gl_FragCoord.xy);float s=exp2(float(uL));
  o=vec4((h(t+ivec2(1,0))-h(t+ivec2(TS-1,0)))/(2.*s),(h(t+ivec2(0,1))-h(t+ivec2(0,TS-1)))/(2.*s),0,1);
}
