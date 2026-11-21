// Blowing sand + dust particles (GPU ping-pong simulation) and dust devils (analytic sprites).
import { gl, program, texture, FS_VS, fullscreen } from './gl.js';
import { ground } from './world.js';
import noise from './glsl/noise.glsl';
import simFS from './glsl/p_sim.glsl';
import drawSrc from './glsl/p_draw.glsl';

export function createParticles(TS, W = 128, Hh = 128) {
  const N = W * Hh, nSalt = Math.floor(N * 0.82);
  const pSim = program(FS_VS, noise + simFS, `#define TS ${TS}\n`);
  const pDraw = program('#define VERT\n' + drawSrc, drawSrc);
  const tex = () => texture([W, Hh], gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
  const P = [tex(), tex()], V = [tex(), tex()];
  const fb = [0, 1].map((i) => {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, P[i].tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, V[i].tex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    return f;
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const vao = gl.createVertexArray();
  let cur = 0, frame = 0;
  const O = [0, 0, 0]; // particle origin (world metres)
  const devils = []; // {x, z, life, age, H, r, spin, seed}

  function update(dt, cam, L0, L1, anchor, clim, time, seed) {
    const shift = [0, 0, 0];
    if (frame === 0 || Math.hypot(cam[0] - O[0], cam[2] - O[2]) > 400) {
      const n = [Math.round(cam[0] / 64) * 64, 0, Math.round(cam[2] / 64) * 64];
      if (frame) for (const i of [0, 2]) shift[i] = n[i] - O[i];
      O[0] = n[0];
      O[2] = n[2];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb[cur ^ 1]);
    gl.viewport(0, 0, W, Hh);
    pSim.use({
      uP: P[cur], uV: V[cur], uH: L0.hTex, uGr: L0.gTex, uAt: L0.aTex,
      uWin0: [L0.o[0] - O[0], L0.o[1] - O[2]], uOM0: L0.om,
      uWin1: [L1.o[0] * 2 - O[0], L1.o[1] * 2 - O[2]], uOM1: L1.om,
      uOA: [O[0] - anchor[0], O[2] - anchor[1]], uWd: clim.dir, uCam: [cam[0] - O[0], cam[1], cam[2] - O[2]], uShift: shift,
      uU10: clim.u10, uUs: clim.ustar, uTime: time, uDt: Math.min(dt, 0.033), uFrame: frame & 0xffff, uSalt: nSalt,
      uSeed: seed,
    });
    fullscreen();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    cur ^= 1;
    frame++;
    // dust devils: hot ground, light wind, afternoon convection
    const want = clim.heat > 0.3 && clim.u10 < 7.5;
    if (want && devils.length < 3 && Math.random() < dt * 0.05 * clim.heat) {
      const a = Math.random() * Math.PI * 2, d = 250 + Math.random() * 1400;
      devils.push({ x: cam[0] + Math.cos(a) * d, z: cam[2] + Math.sin(a) * d, age: 0, life: 45 + Math.random() * 60,
        H: 120 + Math.random() * 260, r: 3 + Math.random() * 9, spin: 2 + Math.random() * 3, seed: Math.random() * 10 });
    }
    for (let i = devils.length - 1; i >= 0; i--) {
      const d = devils[i];
      d.age += dt;
      d.x += clim.dir[0] * clim.u10 * 0.5 * dt;
      d.z += clim.dir[1] * clim.u10 * 0.5 * dt;
      if (d.age > d.life || Math.hypot(d.x - cam[0], d.z - cam[2]) > 3500) devils.splice(i, 1);
    }
  }

  function draw(VP, cam, basis, light, pe, pxK, res, time, dustK) {
    const camO = [cam[0] - O[0], cam[1], cam[2] - O[2]];
    pDraw.use({
      uP: P[cur], uV: V[cur], uVP: VP, uCamO: camO, uRt: basis.r, uUpv: basis.u, uRes: res, uSalt: nSalt, uPE: pe,
      uPxK: pxK, uDustK: dustK, uTime: time, uMode: 0, ...light,
    });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, N * 6);
    if (devils.length) {
      const dv = new Float32Array(12), dp = new Float32Array(12);
      devils.forEach((d, i) => {
        const env = Math.min(1, d.age / 8, (d.life - d.age) / 8);
        dv.set([d.x - O[0], d.z - O[2], ground(d.x, d.z), env], i * 4);
        dp.set([d.H, d.r, d.spin, d.seed], i * 4);
      });
      pDraw.set({ uMode: 1, uDv: dv, uDp: dp });
      gl.drawArrays(gl.TRIANGLES, 0, 900 * 3 * 6);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
  return { update, draw, progs: [pSim, pDraw], devils };
}
