// Soft sun shadows by ray-marching the clipmap heights toward the sun. Penumbra from the
// solar disc (0.53 degrees). Earth curvature included.
uniform highp sampler2DArray uH;uniform ivec2 uWO[NLV],uOM[NLV];uniform int uL;uniform vec3 uSun;
out vec4 o;
float hAt(vec2 q,int l0){
  for(int l=l0;l<NLV;l++){
    vec2 t=q/exp2(float(l))-vec2(uWO[l]);
    if(t.x>1.&&t.y>1.&&t.x<float(TS-2)&&t.y<float(TS-2)){
      vec2 f=floor(t),w=t-f;ivec2 i=ivec2(f)+uOM[l];
      float a=texelFetch(uH,ivec3(i%TS,l),0).r,b=texelFetch(uH,ivec3((i+ivec2(1,0))%TS,l),0).r,
            c=texelFetch(uH,ivec3((i+ivec2(0,1))%TS,l),0).r,d=texelFetch(uH,ivec3((i+ivec2(1,1))%TS,l),0).r;
      return mix(mix(a,b,w.x),mix(c,d,w.x),w.y);
    }
  }
  return -1e9;
}
void main(){
  if(uSun.y<-.02){o=vec4(0);return;}
  ivec2 t=ivec2(gl_FragCoord.xy),j=(t-uOM[uL]+TS)%TS;
  float s=exp2(float(uL));
  vec2 q=vec2(uWO[uL]+j)*s;
  float h0=texelFetch(uH,ivec3(t,uL),0).r+.05+.06*s;
  vec2 sd=normalize(uSun.xz+vec2(1e-6,0));
  float mx=-1.,d=s;
  for(int i=0;i<44;i++){
    float h=hAt(q+sd*d,clamp(int(log2(max(d*.12,1.))),uL,NLV-1));
    if(h<-1e8)break;
    mx=max(mx,(h-d*d/1.272e7-h0)/d);
    d=d*1.14+s*.3;
  }
  float a=atan(mx)-asin(clamp(uSun.y,-1.,1.));
  o=vec4(clamp(.5-a/.0093,0.,1.));
}
