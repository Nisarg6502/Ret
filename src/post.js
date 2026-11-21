// Auto exposure (log-average luminance with eye-like adaptation), dual-filter bloom, AgX.
import { gl, program, target, bindTarget, FS_VS, fullscreen, F } from './gl.js';
import postFS from './glsl/post.glsl';

export function createPost() {
  const mk = (d) => program(FS_VS, postFS, `#define ${d}\n`);
  const pLum = mk('LUM'), pRed = mk('RED'), pAdapt = mk('ADAPT'), pDown = mk('DOWN'), pUp = mk('UP'), pFinal = mk('FINAL');
  const rg = [gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.NEAREST];
  const lum = target(64, 64, [[gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.LINEAR]]);
  const red = target(8, 8, [rg]);
  const adapt = [target(1, 1, [rg]), target(1, 1, [rg])];
  let cur = 0, bloom = [], bw = 0, bh = 0, first = true;

  function run(hdr, dt, time, key, bloomK, pe, shim, ivp, mir = 0, mirC = 0) {
    if (hdr.w !== bw || hdr.h !== bh) {
      bloom.forEach((t) => t.free());
      bw = hdr.w;
      bh = hdr.h;
      bloom = [];
      for (let i = 1, w = bw, h = bh; i <= 5; i++) bloom.push(target((w = Math.max(1, w >> 1)), (h = Math.max(1, h >> 1)), [F.rgba16f()]));
    }
    bindTarget(lum);
    pLum.use({ uSrc: hdr.tex[0] });
    fullscreen();
    bindTarget(red);
    pRed.use({ uSrc: lum.tex[0] });
    fullscreen();
    bindTarget(adapt[cur ^ 1]);
    pAdapt.use({ uSrc: red.tex[0], uPrev: adapt[cur].tex[0], uDt: first ? 1e3 : dt });
    fullscreen();
    cur ^= 1;
    first = false;
    const ex = adapt[cur].tex[0];
    let src = hdr;
    pDown.use({ uExp: ex, uKey: key, uPE: pe });
    bloom.forEach((b, i) => {
      bindTarget(b);
      pDown.set({ uSrc: src.tex[0], uTx: [1 / src.w, 1 / src.h], uFirst: i ? 0 : 1 });
      fullscreen();
      src = b;
    });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    pUp.use();
    for (let i = bloom.length - 1; i > 0; i--) {
      bindTarget(bloom[i - 1]);
      pUp.set({ uSrc: bloom[i].tex[0], uTx: [1 / bloom[i].w, 1 / bloom[i].h] });
      fullscreen();
    }
    gl.disable(gl.BLEND);
    bindTarget(null);
    pFinal.use({ uSrc: hdr.tex[0], uBloom: bloom[0].tex[0], uExp: ex, uTime: time, uKey: key, uBloomK: bloomK, uPE: pe, uShim: shim, uIVP: ivp, uDepth: hdr.depth, uMir: mir, uMirC: mirC });
    fullscreen();
  }
  return { run, progs: [pLum, pRed, pAdapt, pDown, pUp, pFinal] };
}
