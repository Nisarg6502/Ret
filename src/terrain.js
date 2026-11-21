// Geometry clipmaps: LV nested levels, each an N x N toroidal height texture layer that is
// regenerated strip by strip as the camera moves, plus gradient and sun-shadow layers.
import { gl, program, texture, FS_VS, fullscreen } from './gl.js';
import noise from './glsl/noise.glsl';
import height from './glsl/height.glsl';
import atmo from './glsl/atmo.glsl';
import genFS from './glsl/t_gen.glsl';
import gradFS from './glsl/t_grad.glsl';
import shadowFS from './glsl/t_shadow.glsl';
import vertVS from './glsl/t_vert.glsl';
import fragFS from './glsl/t_frag.glsl';
import cloud from './glsl/cloud.glsl';

export const LV = 9;
const mod = (a, n) => ((a % n) + n) % n;

export function createTerrain(G = 128) {
  const N = G + 8;
  const defs = `#define TS ${N}\n#define GR ${G}\n#define NLV ${LV}\n`;
  const pGen = program(FS_VS, noise + height + genFS, defs);
  const pGrad = program(FS_VS, gradFS, defs);
  const pShadow = program(FS_VS, shadowFS, defs);
  const pDraw = program(vertVS, noise + atmo + cloud + fragFS, defs);
  const progs = [pGen, pGrad, pShadow, pDraw];

  const arr = (ifmt, fmt, type, filter) => texture([N, N, LV], ifmt, fmt, type, filter, gl.REPEAT, 'array');
  const hTex = arr(gl.R32F, gl.RED, gl.FLOAT, gl.NEAREST);
  const aTex = arr(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  const gTex = arr(gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.LINEAR);
  const sTex = arr(gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.LINEAR);
  const fbGen = gl.createFramebuffer(), fbOne = gl.createFramebuffer();

  // Meshes: full grid for level 0, ring (hole matching the finer level) for the rest.
  function mesh(hole) {
    const H = G / 2, n = G + 1, v = new Float32Array(n * n * 2), idx = [];
    let k = 0;
    for (let j = -H; j <= H; j++) for (let i = -H; i <= H; i++) (v[k++] = i), (v[k++] = j);
    const id = (i, j) => (j + H) * n + i + H;
    for (let j = -H; j < H; j++)
      for (let i = -H; i < H; i++) {
        if (hole && i >= -hole && i < hole && j >= -hole && j < hole) continue;
        const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
        idx.push(a, b, d, a, d, c);
      }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length };
  }
  const full = mesh(0), ring = mesh(G / 4 - 1);

  const lv = Array.from({ length: LV }, () => ({ o: null, c: [0, 0], sun: null }));
  let anchor = [0, 0], shadowCursor = 0;

  // world range [a, a+w) along one axis -> torus segments
  const seg = (a, w) => {
    const s = mod(a, N);
    return s + w <= N ? [[s, w]] : [[s, N - s], [0, w - (N - s)]];
  };
  function strips(old, nw, pad) {
    if (!old || Math.abs(nw[0] - old[0]) >= N || Math.abs(nw[1] - old[1]) >= N) return [[0, 0, N, N]];
    const r = [];
    const dx = nw[0] - old[0], dz = nw[1] - old[1];
    if (dx) for (const [s, w] of seg((dx > 0 ? old[0] + N : nw[0]) - pad, Math.abs(dx) + 2 * pad)) r.push([s, 0, w, N]);
    if (dz) for (const [s, w] of seg((dz > 0 ? old[1] + N : nw[1]) - pad, Math.abs(dz) + 2 * pad)) r.push([0, s, N, w]);
    return r;
  }
  function pass(fb, attach, prog, l, rects, uniforms) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    attach.forEach((t, i) => gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, t.tex, 0, l));
    gl.drawBuffers(attach.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    gl.viewport(0, 0, N, N);
    prog.use(uniforms);
    gl.enable(gl.SCISSOR_TEST);
    for (const [x, y, w, h] of rects) {
      gl.scissor(x, y, w, h);
      fullscreen();
    }
    gl.disable(gl.SCISSOR_TEST);
  }
  const wo = new Int32Array(LV * 2), om = new Int32Array(LV * 2);

  // Regenerate whatever the camera movement uncovered; refresh shadows as the sun moves.
  function update(cam, sun, seed, windDir, maxShadowLevels = 1) {
    if (Math.abs(cam[0] - anchor[0]) > 6000 || Math.abs(cam[2] - anchor[1]) > 6000)
      anchor = [Math.round(cam[0] / 8192) * 8192, Math.round(cam[2] / 8192) * 8192];
    const work = [];
    for (let l = 0; l < LV; l++) {
      const s = 2 ** l, L = lv[l];
      const c = [2 * Math.round(cam[0] / s / 2), 2 * Math.round(cam[2] / s / 2)];
      const o = [c[0] - N / 2, c[1] - N / 2];
      const gen = strips(L.o, o, 0), pad = strips(L.o, o, 1);
      if (L.o && !gen.length) { L.c = c; continue; }
      work.push([l, o, gen, pad]);
      L.o = o;
      L.c = c;
    }
    for (let l = 0; l < LV; l++) {
      const s = 2 ** l;
      wo[2 * l] = lv[l].o[0] - anchor[0] / s;
      wo[2 * l + 1] = lv[l].o[1] - anchor[1] / s;
      om[2 * l] = mod(lv[l].o[0], N);
      om[2 * l + 1] = mod(lv[l].o[1], N);
    }
    for (const [l, o, gen] of work)
      pass(fbGen, [hTex, aTex], pGen, l, gen, { uOW: o, uOM: [mod(o[0], N), mod(o[1], N)], uS: 2 ** l, uSeed: seed, uWind: windDir });
    for (const [l, , , pad] of work) pass(fbOne, [gTex], pGrad, l, pad, { uH: hTex, uL: l });
    const sh = (l, rects) => {
      pass(fbOne, [sTex], pShadow, l, rects, { uH: hTex, uWO: wo, uOM: om, uL: l, uSun: sun });
      lv[l].sun = sun.slice();
    };
    for (const [l, , , pad] of work) if (pad[0][2] < N || pad[0][3] < N) sh(l, pad);
    // full refresh of levels that were regenerated entirely, then a rolling refresh as the sun moves
    for (const [l, , gen] of work) if (gen[0][2] === N && gen[0][3] === N) sh(l, [[0, 0, N, N]]);
    for (let k = 0, done = 0; k < LV && done < maxShadowLevels; k++) {
      const l = (shadowCursor + k) % LV, p = lv[l].sun;
      if (!p || Math.abs(p[0] - sun[0]) + Math.abs(p[1] - sun[1]) + Math.abs(p[2] - sun[2]) > 0.0015) {
        sh(l, [[0, 0, N, N]]);
        done++;
        shadowCursor = l + 1;
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function draw(VP, cam, uniforms) {
    pDraw.use(uniforms);
    pDraw.set({ uH: hTex, uA: aTex, uGr: gTex, uSh: sTex, uVP: VP, uCam: [cam[0] - anchor[0], cam[1], cam[2] - anchor[1]], uLast: LV - 1 });
    for (let l = 0; l < LV; l++) {
      const s = 2 ** l, c = lv[l].c, l1 = Math.min(l + 1, LV - 1), s1 = 2 ** l1;
      const f = l > 0 ? lv[l - 1].c : null, sf = s / 2;
      pDraw.set({
        uL: l, uS: s,
        uCT: [c[0] - anchor[0] / s, c[1] - anchor[1] / s],
        uOM: [mod(lv[l].o[0], N), mod(lv[l].o[1], N)],
        uWO1: [lv[l1].o[0] - anchor[0] / s1, lv[l1].o[1] - anchor[1] / s1],
        uOM1: [mod(lv[l1].o[0], N), mod(lv[l1].o[1], N)],
        uFine: f
          ? [(f[0] - G / 2) * sf - anchor[0], (f[1] - G / 2) * sf - anchor[1], (f[0] + G / 2) * sf - anchor[0], (f[1] + G / 2) * sf - anchor[1]]
          : [0, 0, 0, 0],
      });
      const m = l ? ring : full;
      gl.bindVertexArray(m.vao);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  // sampling info for a level (used by the particle simulation to find the ground)
  const level = (l) => ({ hTex, gTex, aTex, o: lv[l].o, om: [mod(lv[l].o[0], N), mod(lv[l].o[1], N)] });
  return { update, draw, progs, N, G, level, anchor: () => anchor };
}
