// Ret: boot, frame loop, camera modes, clock, HUD.
import { initGL, gl, target, bindTarget, F } from './gl.js';
import { createTerrain } from './terrain.js';
import { createAtmosphere } from './atmosphere.js';
import { createPost } from './post.js';
import { initInput, enableInput, poll, state } from './input.js';
import { sunPosition, celestialMatrix, moonPosition, polarAxis } from './sun.js';
import { setWorld, terrain, ground, wind, gn, ringTau } from './world.js';
import { viewProj, inv4, clamp, rng, basis, smooth } from './math.js';
import { createClimate } from './climate.js';
import { createParticles } from './particles.js';
import { initAudio, updateAudio, footstep, toggleMute, resumeAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const Q = Object.fromEntries(
  location.hash.slice(1).split('&').filter(Boolean).map((s) => {
    const [k, v = ''] = s.split('=');
    return [k, decodeURIComponent(v)];
  })
);
const num = (k, d) => (Q[k] !== undefined && Q[k] !== '' && !isNaN(+Q[k]) ? +Q[k] : d);
const SHOT = 'shot' in Q;
const DEBUG = 'debug' in Q || SHOT;
const TOUCH = matchMedia('(pointer: coarse)').matches;

// ---- world parameters
const seed = num('s', 7) >>> 0;
const R = rng(seed * 7919 + 13);
const windAngle = R() * Math.PI * 2;
setWorld(seed, windAngle);
const WIND = wind();
const clock = { day: num('d', 172), hours: num('t', 17.9), lat: num('lat', 23.5), speed: num('speed', SHOT ? 0 : 30) };
const SPEEDS = [0, 1, 10, 30, 120, 600];
const DUST = Q.dust !== undefined ? num('dust', 0.09) : null; // fixed dust if given, else from the climate
const EYE = 1.65;

// ---- camera / player
const cam = { pos: [0, 0, 0], yaw: 0, pitch: 0, vel: [0, 0], vy: 0, onGround: true, mode: 'attract' };

// Spawn on a prominent megadune crest near the origin (highest point relative to its surroundings).
function findSpawn() {
  const at = [0, 0, 0, 0];
  let best = -1e9, bx = 0, bz = 0;
  for (let i = -12; i <= 12; i++)
    for (let j = -12; j <= 12; j++) {
      const x = i * 90, z = j * 90, h = terrain(x, z, 1, at);
      if (at[0] > 0.05 || at[1] > 0.1) continue;
      let ring = 0;
      for (let k = 0; k < 8; k++) ring += terrain(x + Math.cos(k * 0.785) * 350, z + Math.sin(k * 0.785) * 350, 8);
      const prom = h - ring / 8;
      if (prom > best) (best = prom), (bx = x), (bz = z);
    }
  best = terrain(bx, bz);
  for (let k = 0; k < 80; k++) {
    let moved = false;
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      const h = terrain(bx + dx, bz + dz);
      if (h > best) (best = h), (bx += dx), (bz += dz), (moved = true);
    }
    if (!moved) break;
  }
  return [bx, bz];
}

let canvas, terr, atm, post, parts, clim, hdr = null, stepDist = 0, dyn = 1, ready = false, started = false;
let last = 0, time = 0, frames = 0, ftAcc = 0, ftN = 0, hudOn = true;
let spawn = [0, 0];

function hhmm(h) {
  h = ((h % 24) + 24) % 24;
  const m = Math.floor((h % 1) * 60);
  return String(Math.floor(h)).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function toast(msg, ms = 1800) {
  const el = $('hint');
  el.textContent = msg;
  el.classList.remove('hide');
  el.style.opacity = 1;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.style.opacity = 0), ms);
}

function action(a) {
  if (a === 'fly') {
    cam.mode = cam.mode === 'fly' ? 'walk' : 'fly';
    cam.vy = 0;
    toast(cam.mode === 'fly' ? 'Free flight' : 'On foot');
  } else if (a === 'hud') {
    hudOn = !hudOn;
    for (const id of ['hud', 'compass']) $(id).style.opacity = hudOn ? 1 : 0;
  } else if (a === 'fullscreen') {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (a === 'faster' || a === 'slower' || a === 'cycletime') {
    let i = SPEEDS.indexOf(clock.speed);
    if (i < 0) i = 3;
    i = a === 'faster' ? Math.min(i + 1, SPEEDS.length - 1) : a === 'slower' ? Math.max(i - 1, 0) : (i + 1) % SPEEDS.length;
    clock.speed = SPEEDS[i];
    toast(clock.speed ? `Time ×${clock.speed}` : 'Time paused');
  } else if (a === 'pause') {
    clock.speed = clock.speed ? 0 : 30;
    toast(clock.speed ? 'Time ×30' : 'Time paused');
  } else if (a === 'mute') toast(toggleMute() ? 'Sound off' : 'Sound on');
  else if (a === 'touchmode' && started) showHint();
  else if (a === 'camera') toast('Third person arrives with the character milestone');
}

function showHint() {
  toast(
    state.touch
      ? 'Left thumb moves · right thumb looks · TILT for gyro look'
      : 'WASD move · mouse look · Shift run · Space jump · V fly · [ ] time · H hide HUD',
    7000
  );
}

function buildCompass() {
  const labels = ['N', '', '', 'NE', '', '', 'E', '', '', 'SE', '', '', 'S', '', '', 'SW', '', '', 'W', '', '', 'NW', '', ''];
  let html = '';
  for (let k = 0; k < 72; k++) {
    const l = labels[k % 24];
    html += `<span style="display:inline-block;width:24px;text-align:center;opacity:${l ? 1 : 0.5}">${l || '·'}</span>`;
  }
  $('cstrip').innerHTML = html;
}

function enter() {
  if (started) return;
  started = true;
  $('intro').classList.add('out');
  setTimeout(() => $('intro').classList.add('hide'), 1300);
  for (const id of ['hud', 'compass']) $(id).classList.remove('hide');
  cam.mode = 'walk';
  cam.pos = [spawn[0], ground(spawn[0], spawn[1]) + EYE, spawn[1]];
  cam.vel = [0, 0];
  enableInput(true);
  initAudio();
  resumeAudio();
  if (TOUCH) document.documentElement.requestFullscreen?.().catch(() => {});
  else canvas.requestPointerLock?.();
  showHint();
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(innerWidth * dpr)), h = Math.max(1, Math.round(innerHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) (canvas.width = w), (canvas.height = h);
  const budget = TOUCH ? 1.0e6 : 2.4e6;
  const s = Math.min(1, Math.sqrt(budget / (w * h))) * dyn;
  const rw = Math.max(64, Math.round(w * s)), rh = Math.max(64, Math.round(h * s));
  if (!hdr || hdr.w !== rw || hdr.h !== rh) {
    hdr?.free();
    hdr = target(rw, rh, [F.rgba16f()], true);
  }
}

function updateCamera(dt) {
  const [lx, ly] = poll(dt);
  if (cam.mode !== 'attract') {
    cam.yaw += lx;
    cam.pitch = clamp(cam.pitch - ly, -1.45, 1.45);
  }
  const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
  const p = cam.pos;
  if (cam.mode === 'attract') {
    // slow cinematic drift over the dunes
    const sp = 7;
    cam.yaw += Math.sin(time * 0.05) * 0.012 * dt;
    p[0] += fx * sp * dt;
    p[2] += fz * sp * dt;
    let g = ground(p[0], p[2]);
    for (let d = 40; d <= 200; d += 40) g = Math.max(g, terrain(p[0] + fx * d, p[2] + fz * d, 4));
    const ty = g + 34;
    p[1] += (ty - p[1]) * Math.min(1, dt * 0.6);
    cam.pitch = -0.075;
    return;
  }
  const { mx, mz, run, jump } = state;
  if (cam.mode === 'fly') {
    const sp = run ? 140 : 28;
    const cp = Math.cos(cam.pitch), sp2 = Math.sin(cam.pitch);
    p[0] += (fx * cp * mz + rx * mx) * sp * dt;
    p[2] += (fz * cp * mz + rz * mx) * sp * dt;
    p[1] += sp2 * mz * sp * dt + (jump ? 5 : 0);
    p[1] = Math.max(p[1], ground(p[0], p[2]) + 1.2);
    return;
  }
  // walking
  const speed = run ? 4.6 : 1.9;
  let tx = (fx * mz + rx * mx) * speed, tz = (fz * mz + rz * mx) * speed;
  const k = Math.min(1, dt * (cam.onGround ? 9 : 1.5));
  cam.vel[0] += (tx - cam.vel[0]) * k;
  cam.vel[1] += (tz - cam.vel[1]) * k;
  p[0] += cam.vel[0] * dt;
  p[2] += cam.vel[1] * dt;
  if (cam.onGround) {
    stepDist += Math.hypot(cam.vel[0], cam.vel[1]) * dt;
    if (stepDist > (run ? 1.3 : 0.75)) (stepDist = 0), footstep(run ? 1 : 0.7);
  }
  const g = ground(p[0], p[2]) + EYE;
  if (cam.onGround) {
    if (jump) (cam.vy = 3.6), (cam.onGround = false);
    else p[1] = g;
  }
  if (!cam.onGround) {
    cam.vy -= 9.81 * dt;
    p[1] += cam.vy * dt;
    if (p[1] <= g) (p[1] = g), (cam.vy = 0), (cam.onGround = true);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
  last = now;
  if (!ready) {
    if (![...terr.progs, ...atm.progs, ...post.progs, ...parts.progs].every((p) => p.ready())) return;
    ready = true;
  }
  time += dt;
  clock.hours += (clock.speed * dt) / 3600;
  if (clock.hours >= 24) (clock.hours -= 24), (clock.day = (clock.day % 365) + 1);
  if (started || SHOT) updateCamera(dt);
  else if (frames > 0) updateCamera(dt);

  // dynamic resolution: aim for 60 fps
  ftAcc += dt;
  if (++ftN >= 40 && !SHOT) {
    const avg = ftAcc / ftN;
    if (avg > 0.0205 && dyn > 0.5) dyn = Math.max(0.5, dyn - 0.08);
    else if (avg < 0.0172 && dyn < 1) dyn = Math.min(1, dyn + 0.04);
    if (DEBUG) $('fps').textContent = `${(1 / avg).toFixed(0)} fps  ${hdr ? hdr.w + '×' + hdr.h : ''}`;
    ftAcc = ftN = 0;
  }
  resize();

  const sp = sunPosition(clock.lat, clock.day, clock.hours), sun = sp.dir;
  const mp = moonPosition(clock.lat, clock.day, clock.hours), moon = mp.dir;
  clim.update(dt, clock.speed * dt, clock.day, clock.hours, sun);
  const dust = DUST ?? clim.dust;
  // sunlight reaching the ground through the rings (their shadow band, seasonal)
  const pole = polarAxis(clock.lat), mus = sun[0] * pole[0] + sun[1] * pole[1] + sun[2] * pole[2];
  let sunK = 1;
  const rt = (-6360 * pole[1]) / mus;
  if (rt > 0 && isFinite(rt)) {
    const P = [sun[0] * rt, sun[1] * rt + 6360, sun[2] * rt];
    sunK = Math.exp(-ringTau(Math.hypot(P[0], P[1], P[2]) / 6360) / Math.max(Math.abs(mus), 0.02));
  }
  // key light: sun by day, moon by night (terrain shadows and aerial perspective follow it)
  const keyMoon = sun[1] < -0.04 && moon[1] > 0;
  const keyDir = keyMoon ? moon : sun;
  // pre-exposure: keep the half-float HDR buffer in range from noon to a moonless night
  const lumEst = Math.max(sun[1], 0) * 0.3 * sunK + 0.02 * Math.exp(40 * Math.min(sun[1], 0)) + mp.illum * Math.max(moon[1], 0.05) * 0.3 + 3e-9;
  const pe = 0.25 / lumEst;
  const aspect = hdr.w / hdr.h;
  const fovY = aspect >= 1 ? 1.05 : Math.min(1.9, 2 * Math.atan(Math.tan(0.62) / aspect));
  const VP = viewProj(cam.yaw, cam.pitch, fovY, aspect, 0.15, 150000);
  const IVP = inv4(VP);

  terr.update(cam.pos, keyDir, seed, WIND, frames === 0 ? 9 : 1);
  const u = atm.update(sun, moon, sunK, mp.illum, cam.pos[1], dust, IVP, keyMoon);
  const anchor = terr.anchor();
  parts.update(dt, cam.pos, terr.level(0), terr.level(1), anchor, clim, time, seed);
  const cloudU = { uCOff: clim.cloudOff, uCamKm: [cam.pos[0] / 1000, cam.pos[2] / 1000], uCCov: clim.cloudCov };

  bindTarget(hdr);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearDepth(1);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  terr.draw(VP, cam.pos, {
    ...u, ...cloudU, uRes: [hdr.w, hdr.h], uWind: WIND, uSeed: seed, uKey: keyMoon ? 1 : 0, uPE: pe,
    uWd: clim.dir, uU10: clim.u10, uUs: clim.ustar, uTime: time, uRip: clim.ripple,
  });
  gl.depthMask(false);
  atm.drawSky(IVP, {
    ...cloudU, uCel: celestialMatrix(clock.lat, clock.day, clock.hours), uPole: pole, uTime: time,
    uPix: fovY / hdr.h, uStarK: 120, uPE: pe, uSeed: seed,
  });
  // particles: light from the sun and moon at the camera (Kasten-Young air mass for transmittance)
  const trans = (y) => {
    if (y < -0.02) return [0, 0, 0];
    const el = Math.asin(Math.max(y, 0)) * 57.3, m = 1 / (Math.max(y, 0) + 0.15 * Math.pow(el + 3.885, -1.253));
    return [0.046, 0.108, 0.265].map((r) => Math.exp(-(r + 0.01 + dust) * m));
  };
  const ts = trans(sun[1]), tm = trans(moon[1]), sk = Math.max(sun[1] + 0.05, 0) * sunK;
  const bs = basis(cam.yaw, cam.pitch);
  parts.draw(VP, cam.pos, bs, {
    uSunD: sun, uMoonD: moon, uLs: ts.map((v) => v * sunK), uLm: tm.map((v) => v * mp.illum),
    uAmb: [0.05 * sk + 2e-9 + 0.1 * mp.illum, 0.07 * sk + 3e-9 + 0.12 * mp.illum, 0.1 * sk + 4e-9 + 0.15 * mp.illum],
  }, pe, hdr.h / 2 / Math.tan(fovY / 2), [hdr.w, hdr.h], time, 0.5 + clim.transport * 1.5 + clim.heat * 0.3);
  gl.depthMask(true);
  gl.disable(gl.DEPTH_TEST);
  const shim = clim.heat * smooth(0.15, 0.5, sun[1]) * (1 - smooth(5, 11, clim.u10)); // mixing breaks up shimmer
  post.run(hdr, dt, time, 0.17, 0.045, pe, shim, IVP);

  // wind at the listener: daily wind times the local gust field
  const q = [cam.pos[0] - anchor[0], cam.pos[2] - anchor[1]], W = clim.dir;
  const gst = 1 + 0.5 * gn((q[0] - W[0] * clim.u10 * time * 0.9) / 70, (q[1] - W[1] * clim.u10 * time * 0.9) / 70);
  updateAudio(clim.u10 * gst * (cam.mode === 'fly' ? 1.4 : 1), Math.max(0, Math.min(1, (clim.ustar * gst - 0.21) / 0.15)));

  if (frames++ === 2 && !started) {
    $('go').disabled = false;
    $('status').textContent = TOUCH ? 'Best in landscape' : 'Mouse and keyboard, or a gamepad';
  }
  if (started) {
    $('clock').innerHTML = `<b>${hhmm(clock.hours)}</b>  ${clock.speed ? '×' + clock.speed : 'paused'}`;
    if (frames % 15 === 0) {
      const from = (Math.atan2(-clim.dir[0], clim.dir[1]) * 180) / Math.PI;
      const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      $('wind').innerHTML = `wind <b>${clim.u10.toFixed(1)} m/s</b> from ${pts[Math.round(((from + 360) % 360) / 45) % 8]}  ·  sand <b>${Math.round(clim.tSurf)}°C</b>`;
    }
    const deg = ((cam.yaw * 180) / Math.PI + 360) % 360;
    $('cstrip').style.transform = `translateX(${-((deg / 15) * 24 + 24 * 24) + $('compass').clientWidth / 2 - 12}px)`;
  }
  window.__ret = { frames, cam, clock, sun: sp, moon: mp, clim };
}

function boot() {
  canvas = $('c');
  try {
    initGL(canvas);
    terr = createTerrain(TOUCH ? 96 : 128);
    atm = createAtmosphere();
    post = createPost();
    parts = createParticles(terr.N, 128, TOUCH ? 64 : 128);
    clim = createClimate(windAngle);
  } catch (e) {
    $('err').textContent = e.message;
    $('err').classList.remove('hide');
    $('status').textContent = '';
    throw e;
  }
  buildCompass();
  spawn = findSpawn();
  const sp = sunPosition(clock.lat, clock.day, clock.hours);
  // start facing roughly 50 degrees right of the low sun: rim-lit arms, long shadows across the field
  cam.yaw = num('yaw', sp.azim - 0.85);
  cam.pitch = num('pitch', -0.13);
  if (SHOT) {
    const x = num('x', spawn[0]), z = num('z', spawn[1]);
    cam.mode = Q.mode || 'walk';
    cam.pos = [x, ground(x, z) + num('h', EYE), z];
    if (cam.mode === 'walk' && num('h', EYE) !== EYE) cam.mode = 'fly';
    $('intro').classList.add('hide');
    started = true;
  } else {
    const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    cam.pos = [spawn[0] - fx * 320, ground(spawn[0], spawn[1]) + 40, spawn[1] - fz * 320];
  }
  if (DEBUG) $('fps').classList.remove('hide');
  initInput(canvas, { action });
  if (SHOT) enableInput(true);
  $('go').addEventListener('click', enter);
  addEventListener('keydown', (e) => {
    if (!started && ready && (e.code === 'Enter' || e.code === 'Space')) enter();
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    $('err').textContent = 'The graphics context was lost. Reload the page to continue.';
    $('err').classList.remove('hide');
  });
  requestAnimationFrame(frame);
}

boot();
