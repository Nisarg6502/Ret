// Atmosphere LUTs (transmittance, multiple scattering, sky view, aerial perspective volume,
// ground irradiance SH) and the sky pass.
import { gl, program, texture, target, bindTarget, FS_VS, SKY_VS, fullscreen, F } from './gl.js';
import noise from './glsl/noise.glsl';
import atmo from './glsl/atmo.glsl';
import skyl from './glsl/skyl.glsl';
import transFS from './glsl/a_trans.glsl';
import msFS from './glsl/a_ms.glsl';
import svFS from './glsl/a_sky.glsl';
import apFS from './glsl/a_ap.glsl';
import shFS from './glsl/a_sh.glsl';
import skyFS from './glsl/sky.glsl';

export const RG = 6360;

export function createAtmosphere() {
  const pT = program(FS_VS, atmo + transFS);
  const pMS = program(FS_VS, atmo + msFS);
  const pSV = program(FS_VS, atmo + svFS);
  const pAP = program(FS_VS, atmo + apFS);
  const pSH = program(FS_VS, atmo + skyl + shFS);
  const pSky = program(SKY_VS, noise + atmo + skyl + skyFS);
  const T = target(256, 64, [F.rgba16f()]);
  const MS = target(32, 32, [F.rgba16f()]);
  const SV = target(192, 108, [F.rgba16f()]);
  const SH = target(4, 1, [[...F.rgba16f(), gl.NEAREST]]);
  const AP = texture([32, 32, 32], gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR, gl.CLAMP_TO_EDGE, '3d');
  const apFB = gl.createFramebuffer();
  const ALB = [0.5, 0.38, 0.26];
  let lastDust = -1;
  const u = {};

  function update(sun, camY, dust, ivp) {
    const R = RG + Math.max(camY, 0.5) / 1000;
    Object.assign(u, { uTrans: T.tex[0], uMS: MS.tex[0], uSV: SV.tex[0], uSH: SH.tex[0], uAP: AP, uDust: dust, uSun: sun, uR: R });
    if (Math.abs(dust - lastDust) > 0.003) {
      lastDust = dust;
      bindTarget(T);
      pT.use(u);
      fullscreen();
      bindTarget(MS);
      pMS.use(u).set({ uAlb: ALB });
      fullscreen();
    }
    bindTarget(SV);
    pSV.use(u);
    fullscreen();
    bindTarget(SH);
    pSH.use(u).set({ uAlb: ALB });
    fullscreen();
    gl.bindFramebuffer(gl.FRAMEBUFFER, apFB);
    gl.viewport(0, 0, 32, 32);
    pAP.use(u).set({ uIVP: ivp });
    for (let s = 0; s < 32; s++) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, AP.tex, 0, s);
      pAP.set({ uSlice: s });
      fullscreen();
    }
    return u;
  }

  function drawSky(ivp, cel, time, pix, starK) {
    pSky.use(u).set({ uIVP: ivp, uCel: cel, uTime: time, uPix: pix, uStarK: starK });
    fullscreen();
  }

  return { update, drawSky, progs: [pT, pMS, pSV, pAP, pSH, pSky], uniforms: u };
}
