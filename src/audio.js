// Procedural soundscape (Web Audio, no files). Wind: band-passed noise layers following speed and
// gusts, plus an aeolian whistle whose pitch rises with wind speed (Strouhal f = 0.2 U / D).
// Sand hiss follows the saltation flux. Footsteps: short filtered noise grains.
let ctx = null, master, nodes, muted = false;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b = 0.985 * b + 0.015 * w; // a little brown noise mixed in for body
    d[i] = w * 0.6 + b * 4;
  }
  const src = () => {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(0, Math.random() * 3);
    return s;
  };
  const chain = (type, f, q) => {
    const s = src(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    g.gain.value = 0;
    s.connect(fl).connect(g).connect(master);
    return { fl, g };
  };
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  nodes = {
    body: chain('bandpass', 380, 0.5),
    low: chain('lowpass', 140, 0.7),
    whistle: chain('bandpass', 900, 9),
    hiss: chain('highpass', 4200, 0.6),
    step: chain('bandpass', 1100, 1.4),
  };
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.1);
  return muted;
}

export function resumeAudio() {
  if (ctx && ctx.state !== 'running') ctx.resume();
}

// u: wind at the listener (m/s, gusts included), flux: 0..1 blowing sand, shelter: 0..1
export function updateAudio(u, flux) {
  if (!ctx || !nodes) return;
  const t = ctx.currentTime, k = 0.25;
  const set = (p, v) => p.setTargetAtTime(v, t, k);
  const s = Math.min(u / 14, 1.3);
  set(nodes.body.g.gain, 0.03 + 0.32 * s * s);
  set(nodes.body.fl.frequency, 260 + 520 * s);
  set(nodes.low.g.gain, 0.05 + 0.4 * s * s);
  set(nodes.whistle.g.gain, 0.045 * Math.max(0, s - 0.35) ** 1.5);
  set(nodes.whistle.fl.frequency, (0.2 * u) / 0.004); // edge ~4 mm (grass, ripples, cloth)
  set(nodes.hiss.g.gain, 0.12 * flux);
}

export function footstep(strength = 1) {
  if (!ctx || !nodes) return;
  const t = ctx.currentTime, g = nodes.step.g.gain;
  nodes.step.fl.frequency.setValueAtTime(700 + Math.random() * 700, t);
  g.cancelScheduledValues(t);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(0.22 * strength, t + 0.012);
  g.exponentialRampToValueAtTime(0.0005, t + 0.16);
}
