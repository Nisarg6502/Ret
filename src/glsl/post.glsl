// Post-processing passes, selected by #define.
#ifdef LUM
uniform sampler2D uSrc;out vec4 o;
void main(){
  vec2 uv=(gl_FragCoord.xy)/64.;
  vec3 c=texture(uSrc,uv).rgb;
  float l=dot(c,vec3(.2126,.7152,.0722)),w=1.2-length(uv-.5);
  o=vec4(clamp(log2(max(l,1e-12)),-40.,6.)*w,w,0,1);
}
#endif
#ifdef RED
uniform sampler2D uSrc;out vec4 o;
void main(){
  ivec2 b=ivec2(gl_FragCoord.xy)*8;vec2 s=vec2(0);
  for(int y=0;y<8;y++)for(int x=0;x<8;x++)s+=texelFetch(uSrc,b+ivec2(x,y),0).xy;
  o=vec4(s,0,1);
}
#endif
#ifdef ADAPT
uniform sampler2D uSrc,uPrev;uniform float uDt;out vec4 o;
void main(){
  vec2 s=vec2(0);
  for(int y=0;y<8;y++)for(int x=0;x<8;x++)s+=texelFetch(uSrc,ivec2(x,y),0).xy;
  float a=s.x/max(s.y,1e-6),p=texelFetch(uPrev,ivec2(0),0).x;
  o=vec4(mix(p,a,1.-exp(-uDt*(a>p?2.2:1.1))),0,0,1);
}
#endif
#ifdef DOWN
uniform sampler2D uSrc,uExp;uniform vec2 uTx;uniform float uFirst,uKey,uPE;in vec2 vUv;out vec4 o;
vec3 t(vec2 d){vec3 c=texture(uSrc,vUv+d*uTx).rgb;
  if(uFirst>0.){c*=clamp(uKey/exp2(texelFetch(uExp,ivec2(0),0).x-log2(uPE)),.05,3e7)/uPE;float l=dot(c,vec3(.3333));c*=min(1.,60./max(l,1e-6));}
  return c;}
void main(){o=vec4((t(vec2(0))*4.+t(vec2(-1,-1))+t(vec2(1,-1))+t(vec2(-1,1))+t(vec2(1,1)))/8.,1);}
#endif
#ifdef UP
uniform sampler2D uSrc;uniform vec2 uTx;in vec2 vUv;out vec4 o;
vec3 t(vec2 d){return texture(uSrc,vUv+d*uTx).rgb;}
void main(){o=vec4((t(vec2(-2,0))+t(vec2(2,0))+t(vec2(0,-2))+t(vec2(0,2))+2.*(t(vec2(-1,-1))+t(vec2(1,-1))+t(vec2(-1,1))+t(vec2(1,1))))/12.,1);}
#endif
#ifdef FINAL
uniform sampler2D uSrc,uBloom,uExp;uniform float uTime,uKey,uBloomK;in vec2 vUv;out vec4 o;
// AgX tone mapping (Troy Sobotka's AgX, polynomial fit by Benjamin Wrensch), "punchy" look.
vec3 agx(vec3 v){
  v=mat3(.842479062253094,.0423282422610123,.0423756549057051,.0784335999999992,.878468636469772,.0784336,
         .0792237451477643,.0791661274605434,.879142973793104)*v;
  v=clamp(log2(max(v,vec3(1e-10))),-12.47393,4.026069);v=(v+12.47393)/16.500299;
  vec3 x2=v*v,x4=x2*x2;
  v=15.5*x4*x2-40.14*x4*v+31.96*x4-6.868*x2*v+.4298*x2+.1191*v-.00232;
  float l=dot(v,vec3(.2126,.7152,.0722));
  v=pow(max(v,vec3(0)),vec3(1.3));v=l+1.25*(v-l);
  return mat3(1.19687900512017,-.0528968517574562,-.0529716355144438,-.0980208811401368,1.15190312990417,
              -.0980434501171241,-.0990297440797205,-.0989611768448433,1.15107367264116)*v;
}
uniform highp sampler2D uDepth;uniform mat4 uIVP;uniform float uPE,uShim,uMir,uMirC;
void main(){
  // heat shimmer: hot air over the ground bends low grazing rays; strongest near the horizon,
  // over distant ground, on hot afternoons
  vec2 uv=vUv;
  if(uShim>0.){
    vec4 w=uIVP*vec4(vUv*2.-1.,1,1);float dy=normalize(w.xyz/w.w).y;
    float z=texture(uDepth,vUv).x*2.-1.,d=.3/max(1.-z,1e-7);
    float k=uShim*smoothstep(60.,500.,d)*(1.-smoothstep(0.,.09,abs(dy+.01)))*step(z,.99999);
    uv.y+=k*.0016*sin(vUv.y*780.+uTime*9.+3.*sin(vUv.x*140.+uTime*2.3));
    uv.x+=k*.0007*sin(vUv.y*510.-uTime*6.);
  }
  // inferior mirage: air touching hot ground is less dense, so rays grazing flat ground at less than
  // the critical angle theta_c = sqrt(2 dn) curve back up. That thin band shows the sky (and distant
  // dunes, inverted), shimmering like water.
  vec3 mir=vec3(0);float mk=0.;
  if(uMir>0.){
    vec4 w=uIVP*vec4(vUv*2.-1.,1,1);float dy=normalize(w.xyz/w.w).y,dep=-dy;
    float g=dFdy(dy)/max(dFdy(vUv.y),1e-6);
    float th=uMirC*(.75+.25*sin(vUv.x*37.+uTime*1.7)*sin(vUv.x*91.-uTime*2.9));
    mk=uMir*(1.-texture(uSrc,vUv).a)*(1.-smoothstep(th*.7,th,dep));
    if(mk>0.){
      vec2 um=vec2(uv.x+.0015*sin(vUv.y*900.+uTime*11.),vUv.y+(2.*dep+uMirC*.9)/max(g,1e-4)+.0012*sin(vUv.x*300.+uTime*8.));
      mir=texture(uSrc,um).rgb*.95;
    }
  }
  // a is log2 of the scene's average luminance in physical units (the HDR buffer is pre-exposed)
  float a=texelFetch(uExp,ivec2(0),0).x-log2(uPE),e=clamp(uKey/exp2(a),.05,3e7)/uPE;
  vec3 c=mix(texture(uSrc,uv).rgb,mir,mk)*e+texture(uBloom,vUv).rgb*uBloomK;
  // night vision: toward rod (scotopic) adaptation colour fades into a dim silvery blue
  float n=.78*(1.-smoothstep(-26.,-15.,a));
  float ls=dot(c,vec3(.06,.6,.34));
  c=mix(c,ls*vec3(.58,.72,1.)*.62,n);
  c=agx(c);
  vec2 d=vUv-.5;c*=1.-.28*dot(d,d)*dot(d,d)*4.;
  uint h=uint(gl_FragCoord.x)*1973u+uint(gl_FragCoord.y)*9277u+uint(uTime*60.)*26699u;h=(h^(h>>13))*1274126177u;
  c+=(float(h>>8)/16777216.-.5)*.012;
  o=vec4(clamp(c,0.,1.),1);
}
#endif
