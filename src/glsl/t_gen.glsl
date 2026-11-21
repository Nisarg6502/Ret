// Clipmap height generation for one level (toroidal texture). MRT: height, attributes.
uniform ivec2 uOW,uOM;uniform float uS;
layout(location=0) out float oH;layout(location=1) out vec4 oA;
void main(){
  ivec2 j=(ivec2(gl_FragCoord.xy)-uOM+TS)%TS;
  vec2 p=vec2(uOW+j)*uS;
  vec4 at;oH=terrain(p,uS,at);oA=at;
}
