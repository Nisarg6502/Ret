// Solar ephemeris. Time is local apparent solar time in hours (12 = sun on the meridian).
// World axes: +x east, +y up, -z north.
const D2R = Math.PI / 180;

// Solar declination in radians (Spencer 1971, error < 0.04 degrees). day: 1..365
export function declination(day) {
  const g = (2 * Math.PI * (day - 1)) / 365;
  return (
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  );
}

// Returns { dir:[x,y,z], elev, azim } with elevation/azimuth in radians, azimuth clockwise from north.
export function sunPosition(latDeg, day, hours) {
  const phi = latDeg * D2R, dec = declination(day), H = (hours - 12) * 15 * D2R;
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const elev = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // azimuth from north toward east
  const az = Math.atan2(-Math.sin(H) * Math.cos(dec), Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(H));
  const ce = Math.cos(elev);
  return { dir: [Math.sin(az) * ce, sinEl, -Math.cos(az) * ce], elev, azim: (az + 2 * Math.PI) % (2 * Math.PI) };
}

// Rotation (column-major mat3) from world (east, up, -north) into an equatorial frame that turns
// with local sidereal time, used to place stars. Pole points to celestial north.
export function celestialMatrix(latDeg, day, hours) {
  const phi = latDeg * D2R;
  // local sidereal time: about 12h at local midnight on the March equinox (day ~80)
  const lst = ((hours + 12 + (day - 80) * (24 / 365.2422)) % 24) * 15 * D2R;
  // world -> horizon frame basis: north = -z. Equatorial coordinates:
  // rotate about east axis by (90 - lat) to bring zenith to pole, then about pole by LST.
  const a = Math.PI / 2 - phi;
  const ca = Math.cos(a), sa = Math.sin(a), cl = Math.cos(lst), sl = Math.sin(lst);
  // R1: rotation about x (east) mapping zenith (0,1,0) to pole direction
  const R1 = [1, 0, 0, 0, ca, sa, 0, -sa, ca];
  const R2 = [cl, 0, -sl, 0, 1, 0, sl, 0, cl];
  return mul3(R2, R1);
}

function mul3(a, b) {
  const o = new Array(9);
  for (let c = 0; c < 3; c++)
    for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
  return o;
}

// Moon: on the ecliptic, synodic month 29.53 days. Elongation from the sun sets phase and position.
// MOON0 makes the default evening (day 172) a waxing gibbous moon rising before sunset.
const EPS = 23.44 * D2R, MOON0 = 159.46;
const raDec = (L) => [Math.atan2(Math.cos(EPS) * Math.sin(L), Math.cos(L)), Math.asin(Math.sin(EPS) * Math.sin(L))];
export function moonPosition(latDeg, day, hours) {
  const n = day + hours / 24, phi = latDeg * D2R;
  const Ls = (n - 80.5) * 0.98565 * D2R;
  const age = ((((n - MOON0) / 29.530589) % 1) + 1) % 1, el = age * 2 * Math.PI;
  const Lm = Ls + el;
  const [ras] = raDec(Ls), [ram, dec] = raDec(Lm);
  const H = (hours - 12) * 15 * D2R + ras - ram;
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const elev = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const az = Math.atan2(-Math.sin(H) * Math.cos(dec), Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(H));
  const ce = Math.cos(elev);
  // phase angle (sun-moon-observer) in degrees, illuminance relative to the sun (full moon ~2.1e-6)
  const pa = Math.abs(180 - ((el * 180) / Math.PI + 360) % 360);
  const illum = 2.1e-6 * Math.pow(10, -0.4 * (0.026 * pa + 4e-9 * pa ** 4));
  return { dir: [Math.sin(az) * ce, sinEl, -Math.cos(az) * ce], elev, azim: az, age, illum };
}

// Celestial north pole in world coordinates (x east, y up, -z north).
export const polarAxis = (latDeg) => [0, Math.sin(latDeg * D2R), -Math.cos(latDeg * D2R)];
