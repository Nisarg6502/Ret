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
    return t * t * (0.65 + 0.35 * (3 - 2 * t));
  }
  return Math.max(0, 1 - (f - fc) / (1 - fc));
}
const segm = (v, k, S, sd) => sstep(-0.3, 0.3, gn(v * 0.8 + sd, k * 1.37) + (S - 0.5) * 1.6);
let LW = 0; // lee weight output of drow/dunes
function drow(k, f, v, H, lam, S, sd, dw, g0, tr) {
  const m = segm(v, k, S, sd), m2 = segm(v + 0.02, k, S, sd);
  const hb = 0.3 * (1 - S);
  const b = hb * (1 - m);
  const db = (hb * (m - m2)) / 0.02;
  const Hl = H * m * (0.75 + 0.5 * gn(v * 0.23 + sd, k * 0.71));
  const gp = Math.sqrt(1 + (dw - db) * (dw - db));
  const lee = clamp((Hl * gp) / (lam * tr), 0.004, 0.5);
  const x = f - b, fc = 1 - lee;
  LW = m * (x < fc ? sstep(fc - 0.13, fc - 0.01, x) : 1 - sstep(1, 1.12, x));
  return Hl * prof(x, fc, Math.min(g0, 0.9 - lee));
}
function dunes(px, pz, lam, H, S, g0, sd, tr) {
  const u = (px * WX + pz * WZ) / lam, v = (-px * WZ + pz * WX) / lam;
  const w = 0.35 * gn(v * 0.55 + sd, u * 0.08) + 0.12 * gn(v * 1.9 - sd, u * 0.25);
  const w2 = 0.35 * gn((v + 0.02) * 0.55 + sd, u * 0.08) + 0.12 * gn((v + 0.02) * 1.9 - sd, u * 0.25);
  const dw = (w2 - w) / 0.02;
  const ph = u + w, k = Math.floor(ph), f = ph - k;
  const a = drow(k, f, v, H, lam, S, sd, dw, g0, tr), la = LW;
  const c = drow(k - 1, f + 1, v, H, lam, S, sd, dw, g0, tr);
  LW = Math.max(la, LW);
  return Math.max(a, c);
}
const bl = (lam, s) => sstep(2.5, 5, lam / s);

// Height in metres at world (x, z). s = sample spacing (1 = full detail). at = [rock, salt, red, supply]
export function terrain(px, pz, s = 1, at) {
  const base = 55 * fbm(px / 9000, pz / 9000, 4) + 18 * fbm(px / 2600 + 50, pz / 2600 + 50, 3);
  const E = sstep(-0.15, 0.25,
    1.2 * gn(px / 16000 + 7.7, pz / 16000 + 7.7) + 0.5 * gn(px / 5200 + 1.3, pz / 5200 + 1.3) +
      0.9 * Math.exp(-(px * px + pz * pz) / 3.6e7));
  const S = clamp(0.55 + 0.9 * gn(px / 7000 + 3.3, pz / 7000 + 3.3), 0, 1);
  const P = sstep(0.3, 0.46, gn(px / 5500 + 21, pz / 5500 + 21) + 0.25 * gn(px / 1300 - 4, pz / 1300 - 4));
  const b1 = bl(1300, s), b2 = bl(110, s), b3 = bl(60, s);
  let mega = 0, small = 0, det = 0;
  const mH = 78 * E * (1 - P), mS = clamp(S + 0.35, 0, 1);
  let lw = 0;
  if (b1 > 0 && mH > 0) {
    mega = b1 * dunes(px, pz, 1300, mH, mS, 0.05, 0, 0.6009);
    lw = LW;
  }
  const sH = (2.5 + 6 * S) * (0.45 + 0.55 * E) * (1 - lw * b1) * (1 - P);
  if (b2 > 0 && sH > 0) small = b2 * dunes(px, pz, 110, sH, S, 0.4 * (1 - S), 5.3, 0.5543);
  if (b3 > 0) det = b3 * fbm(px / 70, pz / 70, 3);
  const sand = base + mega + small - 2 * P + 0.5 * det * (1 - P);
  const r = fbm(px / 2000 + 9, pz / 2000 + 9, 5) + 0.25 * gn(px / 600, pz / 600);
  const t = r * 4;
  const terr = Math.floor(t) + sstep(0.8, 0.95, t - Math.floor(t));
  let rk = base + 24 * terr - 34 - 180 * E;
  if (b3 > 0) rk += 3 * b3 * fbm(px / 50 + 0, pz / 50 + 0, 3);
  if (at) {
    at[0] = sstep(0, 1.5, rk - sand);
    at[1] = P * (1 - sstep(0.3, 1.5, small));
    at[2] = clamp(0.45 + 0.7 * gn(px / 8000 + 40, pz / 8000 + 40) + 0.25 * E, 0, 1);
    at[3] = S;
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
