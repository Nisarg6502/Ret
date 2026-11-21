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
function dunes(px, pz, wx, wz, lam, H, S, g0, sd, tr, lmin, gH) {
  const u = (px * wx + pz * wz) / lam, v = (-px * wz + pz * wx) / lam;
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
  const cx = Math.floor(px / 1800), cz = Math.floor(pz / 1800);
  let h = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const kx = cx + i, kz = cz + j, q = hsh(kx + 7001, kz + 9113);
      if ((q & 3) === 0) continue;
      const dx = px - (kx + 0.2 + (0.6 * ((q >>> 3) & 255)) / 255) * 1800;
      const dz = pz - (kz + 0.2 + (0.6 * ((q >>> 11) & 255)) / 255) * 1800;
      const H = Hm * (0.5 + (0.6 * ((q >>> 19) & 255)) / 255), L = H / 0.24;
      const R = 8.2 * H + 120;
      if (dx * dx + dz * dz > R * R) continue;
      const rb = Math.min(2 * L, 1400), db = Math.hypot(dx, dz) / rb, hb = db < 1 ? 0.2 * H * (1 - db) * (1 - db) : 0;
      const na = 2 + ((q >>> 27) & 1) + ((q >>> 28) & 1) + ((q >>> 2) & 1), a0 = (q >>> 29) * 0.785398 + hf(kx + 5, kz + 5);
      let ha = 0;
      for (let m = 0; m < na; m++) {
        const r1 = hf(kx + m * 31, kz + 77), r2 = hf(kx + m * 31, kz + 78), r3 = hf(kx + m * 31, kz + 79);
        const an = a0 + (m * 6.2831853) / na + 0.9 * (r1 - 0.5);
        const ax = Math.cos(an), az = Math.sin(an);
        const La = L * 1.35 * (0.95 + 0.45 * r2), Hc = H * (0.7 + 0.3 * r3), a = dx * ax + dz * az;
        const ae = a < 0 ? -a * 1.3 : a, t = 1 - ae / La;
        if (t <= 0) continue;
        const hc = Hc * Math.pow(t, 1.35) * (1 + 0.08 * gn(ae / 450, m * 3.7 + r3 * 9));
        const b = -dx * az + dz * ax + 70 * gn(dx * 0.0017 + m * 7, dz * 0.0017) + 22 * gn(dx * 0.006, dz * 0.006 + m * 5) +
          ((ae * ae) / La) * 0.4 * (r1 - 0.5);
        const cs = Math.max((b > 0 === r2 > 0.5 ? 0.38 : 0.38 * (0.5 + 0.5 * r3)) - H * gH, 0.19);
        const u = Math.abs(b) / Math.max((1.5 * hc) / cs, 60);
        if (u < 1) ha = Math.max(ha, hc * Math.pow(1 - u, 1.5));
      }
      h = Math.max(h, ha + hb);
    }
  return h;
}
// Linear (seif) dunes (twin of seif() in height.glsl).
function seif(px, pz, H0, gH) {
  const u = px * WX + pz * WZ, v = -px * WZ + pz * WX;
  const w = 170 * gn(u / 2600, 3.1) + 55 * gn(u / 800, 8.7);
  const dw = (170 * gn((u + 20) / 2600, 3.1) + 55 * gn((u + 20) / 800, 8.7) - w) / 20;
  const gp = Math.sqrt(1 + dw * dw), vv = (v + w) / 1600, k0 = Math.floor(vv + 0.5);
  let h = 0;
  for (let i = -1; i <= 1; i++) {
    const k = k0 + i, d = (vv - k) * 1600;
    const Hr = H0 * (0.5 + 0.5 * gn(u / 2600, k * 7.31)) * sstep(-0.5, 0.15, gn(u / 7000, k * 3.17 + 1));
    if (Hr <= 0) continue;
    const s = gn(u / 1500, k * 5.71 + 2);
    const W = Math.max((2.4 * Hr * gp) / Math.max(0.53 - Hr * gH, 0.3), 90) * (1 + 0.9 * Math.max(d > 0 ? s : -s, 0)), x = Math.abs(d) / W;
    if (x < 1) h = Math.max(h, Hr * Math.pow(1 - x, 2.4));
  }
  return h;
}
// Megabarchans (twin of mbar() in height.glsl).
function mbar(px, pz, Hm, gH) {
  const cx = Math.floor(px / 3200), cz = Math.floor(pz / 3200);
  let h = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const kx = cx + i, kz = cz + j, q = hsh(kx + 331, kz + 1999);
      if ((q & 7) === 0) continue;
      const dx = px - (kx + 0.3 + (0.4 * ((q >>> 3) & 255)) / 255) * 3200;
      const dz = pz - (kz + 0.3 + (0.4 * ((q >>> 11) & 255)) / 255) * 3200;
      const s = 0.7 + (0.6 * ((q >>> 19) & 255)) / 255, H = Hm * s, A = 1100 * s;
      const y = (-dx * WZ + dz * WX) / A, y2 = y * y;
      if (y2 >= 1) continue;
      const Hl = H * (1 - y2), dm = (2 * H * Math.abs(y)) / A;
      const x = dx * WX + dz * WZ - 0.55 * A * y2, gp = Math.sqrt(1 + 1.21 * y2);
      const te = Math.max(Math.sqrt(Math.max(0.3 - dm * dm, 0.01)) - Hl * gH, 0.12), Ll = Math.max((Hl * gp) / te, 60), Ls = 6 * Hl * gp;
      let hh = 0;
      if (x < 0) {
        const tt = 1 + x / Ls;
        if (tt > 0) hh = Hl * tt * tt * (2 - tt);
      } else if (x < Ll) hh = Hl * (1 - x / Ll);
      h = Math.max(h, hh);
    }
  return h;
}
// Network (akle) dunes (twin of net()).
function net(px, pz, H, S, gH) {
  const w1x = 0.8134 * WX - 0.5817 * WZ, w1z = 0.5817 * WX + 0.8134 * WZ;
  const w2x = 0.8134 * WX + 0.5817 * WZ, w2z = -0.5817 * WX + 0.8134 * WZ;
  return Math.max(dunes(px, pz, w1x, w1z, 850, H, S, 0.06, 1.7, 0.6009, 0.15, gH), dunes(px, pz, w2x, w2z, 720, H * 0.85, S, 0.06, 8.3, 0.6009, 0.15, gH));
}
const erg = (px, pz) =>
  sstep(-0.5, 0, 1.2 * gn(px / 16000 + 7.7, pz / 16000 + 7.7) + 0.5 * gn(px / 5200 + 1.3, pz / 5200 + 1.3) +
    0.9 * Math.exp(-(px * px + pz * pz) / 3.6e7));
const rw = (n) => sstep(0, 0.4, n);
const ex = (x, z, cx, cz, s2) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / s2);
// Regime weights (twin of regimes()): returns [star, linear, network, megabarchan, transverse].
function regimes(px, pz) {
  const g = (f, o, f2, o2) => gn(px / f + o, pz / f + o) + 0.3 * gn(px / f2 + o2, pz / f2 + o2);
  const st = ex(px, pz, 1500, -500, 2.5e7); // keep the star field around the start pure
  let sS = rw(g(20000, 61, 7000, -17) + 0.8 * ex(px, pz, 1500, -500, 6.4e7) + 0.1);
  let sL = rw(g(18000, 31, 6000, -9) + 0.95 * ex(px, pz, -10000, 5000, 8.1e7) - 0.6 * st);
  let sN = rw(g(19000, -44, 6500, 3) + 0.95 * ex(px, pz, 11000, 2000, 8.1e7) - 0.1 - 0.6 * st);
  let sM = rw(g(21000, 13, 7500, 29) + 0.95 * ex(px, pz, 0, -12000, 8.1e7) - 0.1 - 0.6 * st);
  let sT = 1 - Math.max(sS, sL, sN, sM);
  sS *= sS; sL *= sL; sN *= sN; sM *= sM; sT *= sT;
  const sum = sS + sL + sN + sM + sT;
  return [sS / sum, sL / sum, sN / sum, sM / sum, sT / sum];
}
const WR = [0, 0, 0, 0];
let MLW = 0;
// Large dune layer (twin of mega()): regime weights in WR, transverse lee weight in MLW.
function mega(px, pz, E, gH, S) {
  const w = regimes(px, pz), wx = regimes(px + 16, pz), wz = regimes(px, pz + 16);
  const gw = w.map((v, i) => Math.hypot(wx[i] - v, wz[i] - v) / 16 / Math.max(v, 0.02));
  WR[0] = w[0]; WR[1] = w[1]; WR[2] = w[2]; WR[3] = w[3];
  const wT = w[4];
  let h = 0;
  MLW = 0;
  if (wT > 0.001) (h += wT * dunes(px, pz, WX, WZ, 1100, 150 * E, clamp(S + 0.35, 0, 1), 0.05, 0, 0.6009, 0.15, gH + gw[4])), (MLW = LW * wT);
  if (w[0] > 0.001) h += w[0] * star(px, pz, 230 * E, gH + gw[0]);
  if (w[1] > 0.001) h += w[1] * seif(px, pz, 150 * E, gH + gw[1]);
  if (w[2] > 0.001) h += w[2] * net(px, pz, 110 * E, 0.9, gH + gw[2]);
  if (w[3] > 0.001) h += w[3] * mbar(px, pz, 160 * E, gH + gw[3]);
  return h;
}
const bl = (lam, s) => sstep(2.5, 5, lam / s);

// Height in metres at world (x, z). s = sample spacing (1 = full detail).
// at = [rock, unused, sand colour, supply, star w, linear w, network w, megabarchan w]
export function terrain(px, pz, s = 1, at) {
  const base = 55 * fbm(px / 9000, pz / 9000, 4) + 18 * fbm(px / 2600 + 50, pz / 2600 + 50, 3);
  const E = erg(px, pz), gE = Math.hypot(erg(px + 8, pz) - E, erg(px, pz + 8) - E) / 8, gH = gE / Math.max(E, 1e-4);
  const S = clamp(0.55 + 0.9 * gn(px / 7000 + 3.3, pz / 7000 + 3.3), 0, 1);
  const b1 = bl(1100, s), b2 = bl(110, s), b3 = bl(60, s);
  let big = 0, small = 0, det = 0, lw = 0;
  const wr = [0, 0, 0, 0];
  if (b1 > 0) (big = b1 * mega(px, pz, E, gH, S)), (lw = MLW), wr.splice(0, 4, ...WR);
  const sH = (3 + 7 * S) * (0.5 + 0.5 * E);
  if (b2 > 0) {
    const m0 = big / Math.max(b1, 1e-4);
    let dd = 0;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.0471976;
      dd = Math.max(dd, Math.abs(mega(px + Math.cos(a) * 120, pz + Math.sin(a) * 120, E, gH, S) - m0));
    }
    const sk = (1 - lw * b1) * (1 - sstep(0.025, 0.1, (b1 * dd) / 120));
    if (sk > 0) small = b2 * sk * dunes(px, pz, WX, WZ, 110, sH, S, 0.2 * (1 - S), 5.3, 0.5543, 0.004, 0);
  }
  if (b3 > 0) det = b3 * (0.5 * fbm(px / 70, pz / 70, 3) + 2.2 * fbm(px / 190 + 3, pz / 190 + 3, 3));
  const sand = base + big + small + det;
  const rr = fbm(px / 2600 + 9, pz / 2600 + 9, 5) + 0.3 * gn(px / 700, pz / 700), o = sstep(0.3, 0.62, rr), tt = rr * 7;
  let rk = base - 40 + o * (130 + 20 * (Math.floor(tt) + sstep(0.75, 0.95, tt - Math.floor(tt))));
  if (b3 > 0) rk += 3 * b3 * fbm(px / 50, pz / 50, 3);
  if (at) {
    const gy = sstep(0.3, 0.45, gn(px / 15000 + 77, pz / 15000 + 77) + 0.6 * ex(px, pz, 7000, 7500, 1.6e7));
    const red = clamp(0.5 + 0.6 * gn(px / 9000 + 40, pz / 9000 + 40) + 0.2 * E + 0.3 * wr[1] - 0.15 * wr[2], 0.12, 1);
    at[0] = sstep(0, 1.5, rk - sand);
    at[1] = 0;
    at[2] = red + (0.02 - red) * gy;
    at[3] = S;
    at[4] = wr[0]; at[5] = wr[1]; at[6] = wr[2]; at[7] = wr[3];
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
