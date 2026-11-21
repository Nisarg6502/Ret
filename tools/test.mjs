// Physics and generator checks that run in Node (no GPU). `npm test`
import { sunPosition, declination } from '../src/sun.js';
import { setWorld, terrain, wind } from '../src/world.js';

let fails = 0;
const R2D = 180 / Math.PI;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) fails++;
}

// 1. Sun: declination at solstices/equinoxes, noon elevation, sunrise azimuth.
{
  const d = (n) => declination(n) * R2D;
  check('declination June solstice ~ +23.44', Math.abs(d(172) - 23.44) < 0.3, d(172).toFixed(2));
  check('declination December solstice ~ -23.44', Math.abs(d(355) + 23.44) < 0.3, d(355).toFixed(2));
  check('declination March equinox ~ 0', Math.abs(d(80)) < 0.5, d(80).toFixed(2));
  check('declination September equinox ~ 0', Math.abs(d(266)) < 0.6, d(266).toFixed(2));
  const s = sunPosition(40, 172, 12);
  check('noon elevation at 40N on Jun 21 ~ 73.4', Math.abs(s.elev * R2D - 73.4) < 0.5, (s.elev * R2D).toFixed(2));
  check('noon sun due south at 40N', Math.abs(s.azim * R2D - 180) < 0.01, (s.azim * R2D).toFixed(2));
  const e = sunPosition(0, 80, 6);
  check('equator equinox 06:00 sun on horizon in the east', Math.abs(e.elev * R2D) < 0.6 && Math.abs(e.azim * R2D - 90) < 0.6,
    `elev ${(e.elev * R2D).toFixed(2)} az ${(e.azim * R2D).toFixed(2)}`);
  const w = sunPosition(23.5, 300, 16);
  check('afternoon sun is in the west (x < 0)', w.dir[0] < 0, w.dir.map((v) => v.toFixed(2)).join(','));
}

// 2. Terrain: angle of repose and slip-face orientation, sampled on sand only.
{
  setWorld(7, 1.1);
  const [WX, WZ] = wind();
  const at = [0, 0, 0, 0];
  let maxSlope = 0, steep = 0, steepDownwind = 0, n = 0;
  const hist = new Array(10).fill(0);
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const e = 0.5;
  for (let i = 0; i < 60000; i++) {
    const x = (rnd() - 0.5) * 30000, z = (rnd() - 0.5) * 30000;
    const h = terrain(x, z, 1, at);
    if (at[0] > 0.01) continue; // skip exposed rock
    const gx = (terrain(x + e, z) - terrain(x - e, z)) / (2 * e);
    const gz = (terrain(x, z + e) - terrain(x, z - e)) / (2 * e);
    const sl = Math.atan(Math.hypot(gx, gz)) * R2D;
    n++;
    hist[Math.min(9, Math.floor(sl / 4))]++;
    if (sl > maxSlope) maxSlope = sl;
    if (sl > 25) {
      steep++;
      // slip faces descend downwind: gradient points upwind
      if ((gx * WX + gz * WZ) / Math.hypot(gx, gz) < -0.3) steepDownwind++;
    }
  }
  console.log('      slope histogram (4 deg bins, sand):', hist.map((c) => ((100 * c) / n).toFixed(1) + '%').join(' '));
  check('no sand slope steeper than angle of repose (34.5 deg)', maxSlope <= 34.5, `max ${maxSlope.toFixed(2)} deg over ${n} samples`);
  check('slip faces exist (steep sand > 0.5%)', steep / n > 0.005, `${((100 * steep) / n).toFixed(2)}%`);
  check('slip faces face downwind (> 90%)', steepDownwind / Math.max(1, steep) > 0.9, `${((100 * steepDownwind) / Math.max(1, steep)).toFixed(1)}%`);
}

if (fails) {
  console.error(`\n${fails} check(s) failed`);
  process.exit(1);
} else console.log('\nall checks passed');
