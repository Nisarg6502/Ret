// JS twin of glsl/noise.glsl + glsl/height.glsl. Used for physics (walking, spawning) and tests.
// Keep the arithmetic identical so CPU and GPU agree.
let SEED = 0;
let WX = 1, WZ = 0; // dune-forming wind direction
export function setWorld(seed, windAngle) {
  SEED = seed >>> 0;
  WX = Math.cos(windAngle);
  WZ = Math.sin(windAngle);
}
export const wind = () => [WX, WZ];

function hsh(x, y) {
  let h = (Math.imul(x, 0x8da6b343) + Math.imul(y, 0xd8163841) + Math.imul(SEED, 0xcb1ab31f)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}
const gg = (h, dx, dy) => ((h & 65535) / 32767.5 - 1) * dx + ((h >>> 16) / 32767.5 - 1) * dy;
export function gn(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = gg(hsh(ix, iy), fx, fy), b = gg(hsh(ix + 1, iy), fx - 1, fy);
  const d = gg(hsh(ix, iy + 1), fx, fy - 1), e = gg(hsh(ix + 1, iy + 1), fx - 1, fy - 1);
  const ab = a + (b - a) * ux, de = d + (e - d) * ux;
  return ab + (de - ab) * uy;
}
export function fbm(x, y, o) {
  let s = 0, a = 0.5;
  for (let i = 0; i < o; i++) {
    s += a * gn(x, y);
    const nx = 1.6 * x - 1.2 * y + 17.3;
    y = 1.2 * x + 1.6 * y + 17.3;
    x = nx;
    a *= 0.5;
  }
  return s;
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function prof(f, fc, g0) {
  if (f < fc) {
    const t = clamp((f - g0) / (fc - g0), 0, 1);
    return t * t * (2 - t);
  }
  return Math.max(0, 1 - (f - fc) / (1 - fc));
}
const segm = (v, k, S, sd) => sstep(-0.3, 0.3, gn(v * 0.8 + sd, k * 1.37) + (S - 0.5) * 1.6);
let LW = 0; // lee weight output of drow/dunes
function drow(k, f, v, H, lam, S, sd, du, dw, g0, tr, lmin, gH) {
  const m = segm(v, k, S, sd), m2 = segm(v + 0.02, k, S, sd);
  const hb = 0.3 * (1 - S);
  const b = hb * (1 - m);
  const db = (hb * (m - m2)) / 0.02;
  const Hl = H * m * (0.75 + 0.5 * gn(v * 0.23 + sd, k * 0.71));
  const gp = Math.sqrt(du * du + (dw - db) * (dw - db));
  const te = Math.max(tr - Hl * gH, 0.3);
  const lee = clamp((Hl * gp) / (lam * te), lmin, 0.5), r = Math.min(1, (Hl * gp) / (lee * lam * te));
  const x = f - b, fc = 1 - lee;
  LW = r * (x < fc ? sstep(fc - 0.13, fc - 0.01, x) : 1 - sstep(1, 1.12, x));
  return Hl * prof(x, fc, Math.min(g0, 0.9 - lee));
}
function dunes(px, pz, lam, H, S, g0, sd, tr, lmin, gH) {
  const u = (px * WX + pz * WZ) / lam, v = (-px * WZ + pz * WX) / lam;
  const w = 0.5 * gn(v * 0.55 + sd, u * 0.08) + 0.18 * gn(v * 1.9 - sd, u * 0.25);
  const w2 = 0.5 * gn((v + 0.02) * 0.55 + sd, u * 0.08) + 0.18 * gn((v + 0.02) * 1.9 - sd, u * 0.25);
  const w3 = 0.5 * gn(v * 0.55 + sd, (u + 0.02) * 0.08) + 0.18 * gn(v * 1.9 - sd, (u + 0.02) * 0.25);
  const dw = (w2 - w) / 0.02, du = 1 + (w3 - w) / 0.02;
  const ph = u + w, k = Math.floor(ph), f = ph - k;
  const a = drow(k, f, v, H, lam, S, sd, du, dw, g0, tr, lmin, gH), la = LW;
  const c = drow(k - 1, f + 1, v, H, lam, S, sd, du, dw, g0, tr, lmin, gH);
  LW = Math.max(la, LW);
  return Math.max(a, c);
}
const hf = (x, y) => (hsh(x, y) >>> 8) / 16777216;
// Star dunes (twin of star() in height.glsl).
function star(px, pz, Hm, gH) {
  const cx = Math.floor(px / 1500), cz = Math.floor(pz / 1500);
  let h = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const kx = cx + i, kz = cz + j, q = hsh(kx + 7001, kz + 9113);
      const dx = px - (kx + 0.25 + (0.5 * (q & 255)) / 255) * 1500;
      const dz = pz - (kz + 0.25 + (0.5 * ((q >>> 8) & 255)) / 255) * 1500;
      const H = Hm * (0.55 + (0.6 * ((q >>> 16) & 255)) / 255), L = H / 0.24;
      const R = 8.2 * H + 40;
      if (dx * dx + dz * dz > R * R) continue;
      const a0 = ((q >>> 24) / 255) * 6.2831853;
      for (let m = 0; m < 4; m++) {
        const an = a0 + m * 1.5707963 + 0.6 * (hf(kx + m * 31, kz + 77) - 0.5);
        const ax = Math.cos(an), az = Math.sin(an);
        const a = Math.abs(dx * ax + dz * az), t = 1 - a / L;
        if (t <= 0) continue;
        const b = -dx * az + dz * ax + 28 * gn(dx * 0.0025 + m * 7, dz * 0.0025) + ((a * a) / L) * 0.25 * (hf(kx + m * 31, kz + 78) - 0.5);
        const u = (Math.abs(b) * Math.max(0.5 - H * gH, 0.2)) / (1.5 * H * t);
        if (u < 1) h = Math.max(h, H * t * Math.pow(1 - u, 1.5));
      }
    }
  return h;
}
const erg = (px, pz) =>
  sstep(-0.15, 0.25, 1.2 * gn(px / 16000 + 7.7, pz / 16000 + 7.7) + 0.5 * gn(px / 5200 + 1.3, pz / 5200 + 1.3) +
    0.9 * Math.exp(-(px * px + pz * pz) / 3.6e7));
const bl = (lam, s) => sstep(2.5, 5, lam / s);

// Height in metres at world (x, z). s = sample spacing (1 = full detail). at = [rock, salt, red, supply]
export function terrain(px, pz, s = 1, at) {
  const base = 55 * fbm(px / 9000, pz / 9000, 4) + 18 * fbm(px / 2600 + 50, pz / 2600 + 50, 3);
  const E = erg(px, pz), gE = Math.hypot(erg(px + 8, pz) - E, erg(px, pz + 8) - E) / 8, gH = gE / Math.max(E, 1e-4);
  const S = clamp(0.55 + 0.9 * gn(px / 7000 + 3.3, pz / 7000 + 3.3), 0, 1);
  const P = sstep(0.3, 0.46, gn(px / 5500 + 21, pz / 5500 + 21) + 0.25 * gn(px / 1300 - 4, pz / 1300 - 4));
  // wind regime: multidirectional (star dunes) where V -> 1; a star field surrounds the start
  const V = sstep(0.05, 0.45, gn(px / 20000 + 61, pz / 20000 + 61) + 0.3 * gn(px / 7000 - 17, pz / 7000 - 17) + 0.8 * Math.exp(-(px * px + pz * pz) / 6.4e7));
  const b1 = bl(1100, s), b2 = bl(110, s), b3 = bl(60, s);
  let mega = 0, small = 0, det = 0;
  const mH = 150 * E, mS = clamp(S + 0.35, 0, 1);
  let lw = 0;
  if (b1 > 0 && mH > 0) {
    if (V < 1) (mega = dunes(px, pz, 1100, mH, mS, 0.05, 0, 0.6009, 0.15, gH)), (lw = LW);
    if (V > 0) mega = mega + (star(px, pz, 230 * E, gH) - mega) * V;
    mega *= b1;
  }
  const sH = (3 + 7 * S) * (0.45 + 0.55 * E), sk = (1 - lw * b1) * (1 - sstep(0, 0.3, V));
  if (b2 > 0 && sH > 0 && sk > 0) small = b2 * sk * dunes(px, pz, 110, sH, S, 0.4 * (1 - S), 5.3, 0.5543, 0.004, 0);
  if (b3 > 0) det = b3 * fbm(px / 70, pz / 70, 3);
  const sand = base + mega + small + 0.5 * det;
  const r = fbm(px / 2000 + 9, pz / 2000 + 9, 5) + 0.25 * gn(px / 600, pz / 600);
  const t = r * 4;
  const terr = Math.floor(t) + sstep(0.8, 0.95, t - Math.floor(t));
  let rk = base + 24 * terr - 34 - 180 * E;
  if (b3 > 0) rk += 3 * b3 * fbm(px / 50 + 0, pz / 50 + 0, 3);
  if (at) {
    at[0] = sstep(0, 1.5, rk - sand);
    at[1] = P * (1 - sstep(0.4, 2.5, mega + small));
    at[2] = clamp(0.45 + 0.7 * gn(px / 8000 + 40, pz / 8000 + 40) + 0.25 * E, 0, 1);
    at[3] = S;
    at[4] = V;
  }
  return Math.max(sand, rk);
}

// Ground height matching the rendered mesh exactly: 1 m lattice, triangles split along the
// (i,j)-(i+1,j+1) diagonal, same as the clipmap index buffer.
let cx = NaN, cz = NaN, h00, h10, h01, h11;
export function ground(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  if (ix !== cx || iz !== cz) {
    cx = ix; cz = iz;
    h00 = terrain(ix, iz); h10 = terrain(ix + 1, iz); h01 = terrain(ix, iz + 1); h11 = terrain(ix + 1, iz + 1);
  }
  const fx = x - ix, fz = z - iz;
  return fx > fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
}
export function resetGroundCache() { cx = cz = NaN; }

// Ring optical depth at radius r (planet radii). Twin of ringTau() in glsl/sky.glsl.
export function ringTau(r) {
  const x = (r - 1.85) / 0.4;
  if (x < 0 || x > 1) return 0;
  const t = 0.12 + 0.6 * sstep(0.05, 0.35, x) - 0.55 * sstep(0.56, 0.6, x) * (1 - sstep(0.65, 0.7, x)) +
    0.22 * gn(x * 38, 0.5) + 0.1 * gn(x * 210, 2.5);
  return Math.max(t, 0) * sstep(0, 0.04, x) * (1 - sstep(0.93, 1, x));
}
