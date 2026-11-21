// High cloud deck (~7 km): patchy altocumulus/cirrus drifting with the upper wind. Coordinates in
// km, world-absolute (uCamKm = camera xz in km), so sky and ground shadows agree.
uniform vec2 uCOff,uCamKm;uniform float uCCov;
float cloudD(vec2 pk,int o){
  vec2 q=(pk+uCOff)*.07;
  float big=fbm(q*.45+3.,3),n=fbm(q,o)+.35*fbm(q*vec2(3.,.8)+5.,max(o-2,1));
  return smoothstep(.9-uCCov,1.2-uCCov*.7,n*.55+.5+big*.6);
}
