// Unified input: keyboard + mouse (pointer lock), touch (floating joystick + look drag +
// buttons), gamepad (standard mapping) and optional gyro look. Produces one action state.
const $ = (id) => document.getElementById(id);
const keys = {};
const look = { x: 0, y: 0 };
const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
const drag = { id: null, x: 0, y: 0 };
let gyro = false, touchMode = false, enabled = false, actions = {};
const once = new Set(); // edge-triggered actions this frame
const prev = {}; // previous gamepad button states

export const state = { mx: 0, mz: 0, run: false, jump: false, touch: false };

export function initInput(canvas, handlers) {
  actions = handlers;
  addEventListener('keydown', (e) => {
    if (!enabled) return;
    keys[e.code] = true;
    if (e.repeat) return;
    const k = e.code;
    if (k === 'Space') once.add('jump');
    const map = { KeyV: 'fly', KeyC: 'camera', KeyH: 'hud', KeyF: 'fullscreen', KeyM: 'mute', BracketRight: 'faster', BracketLeft: 'slower', Backslash: 'pause', KeyP: 'photo' };
    if (map[k]) actions.action?.(map[k]);
    if (k.startsWith('Arrow') || k === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => (keys[e.code] = false));
  addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

  // mouse: pointer lock when available, drag-to-look as fallback
  canvas.addEventListener('mousedown', (e) => {
    if (!enabled || touchMode) return;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      try {
        const r = canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      } catch (_) {}
    }
  });
  addEventListener('mousemove', (e) => {
    if (!enabled || touchMode) return;
    if (document.pointerLockElement === canvas || e.buttons & 1) {
      look.x += e.movementX * 0.0022;
      look.y += e.movementY * 0.0022;
    }
  });

  // touch
  const pad = $('touch'), knob = $('stick');
  const toTouch = () => {
    if (touchMode) return;
    touchMode = state.touch = true;
    pad.classList.remove('hide');
    actions.action?.('touchmode');
  };
  addEventListener('touchstart', () => enabled && toTouch(), { passive: true });
  pad.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    if (e.clientX < innerWidth * 0.45 && stick.id === null) {
      Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY });
      knob.style.left = e.clientX + 'px';
      knob.style.top = e.clientY + 'px';
      knob.style.opacity = 1;
      knob.firstChild.style.transform = '';
    } else if (drag.id === null) Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY });
    try { pad.setPointerCapture(e.pointerId); } catch (_) {}
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) {
      stick.x = e.clientX;
      stick.y = e.clientY;
      let dx = stick.x - stick.x0, dy = stick.y - stick.y0;
      const l = Math.hypot(dx, dy), m = 52;
      if (l > m) (dx *= m / l), (dy *= m / l);
      knob.firstChild.style.transform = `translate(${dx}px,${dy}px)`;
    } else if (e.pointerId === drag.id) {
      look.x += (e.clientX - drag.x) * 0.0055;
      look.y += (e.clientY - drag.y) * 0.0055;
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
  });
  const up = (e) => {
    if (e.pointerId === stick.id) {
      stick.id = null;
      knob.style.opacity = 0;
    }
    if (e.pointerId === drag.id) drag.id = null;
  };
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  const btn = (id, f) => $(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    f();
  });
  btn('bJump', () => once.add('jump'));
  btn('bFly', () => actions.action?.('fly'));
  btn('bTime', () => actions.action?.('cycletime'));
  btn('bTilt', () => toggleGyro());
}

// Gyro look from rotation rate (works in portrait and landscape).
function onMotion(e) {
  const r = e.rotationRate;
  if (!gyro || !r) return;
  const a = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  const iv = e.interval > 1 ? e.interval / 1000 : e.interval || 1 / 60;
  const k = (Math.PI / 180) * iv;
  const bx = r.beta || 0, gy = r.gamma || 0;
  let yaw, pitch;
  if (a === 90) (yaw = bx), (pitch = -gy);
  else if (a === -90 || a === 270) (yaw = -bx), (pitch = gy);
  else (yaw = -gy), (pitch = -bx);
  look.x += yaw * k;
  look.y += pitch * k;
}
async function toggleGyro() {
  if (!gyro && typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
    try {
      if ((await DeviceMotionEvent.requestPermission()) !== 'granted') return;
    } catch (_) {
      return;
    }
  }
  gyro = !gyro;
  if (gyro) addEventListener('devicemotion', onMotion);
  else removeEventListener('devicemotion', onMotion);
  $('bTilt').classList.toggle('on', gyro);
}

export function enableInput(on) {
  enabled = on;
}

// Called once per frame. Returns look deltas (radians) and fills `state`.
export function poll(dt) {
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let mz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let run = !!(keys.ShiftLeft || keys.ShiftRight);
  let jump = once.has('jump');
  if (stick.id !== null) {
    const dx = (stick.x - stick.x0) / 52, dy = (stick.y - stick.y0) / 52, l = Math.hypot(dx, dy);
    if (l > 0.12) {
      const s = Math.min(l, 1) / l;
      mx = dx * s;
      mz = -dy * s;
      run = l > 1.15;
    }
  }
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || p.mapping !== 'standard') continue;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const ax = dz(p.axes[0]), ay = dz(p.axes[1]), lx = dz(p.axes[2]), ly = dz(p.axes[3]);
    if (ax || ay) (mx = ax), (mz = -ay);
    look.x += lx * Math.abs(lx) * 2.6 * dt;
    look.y += ly * Math.abs(ly) * 2.0 * dt;
    if (p.buttons[6]?.pressed || p.buttons[7]?.pressed || p.buttons[10]?.pressed) run = true;
    const b = (i) => !!p.buttons[i]?.pressed, q = (prev[p.index] ||= {});
    const edge = (i) => b(i) && !q[i];
    if (edge(0)) jump = true;
    if (edge(3)) actions.action?.('camera');
    if (edge(2)) actions.action?.('fly');
    if (edge(9)) actions.action?.('cycletime');
    for (const i of [0, 2, 3, 9]) q[i] = b(i);
  }
  Object.assign(state, { mx, mz, run, jump });
  once.clear();
  const d = [look.x, look.y];
  look.x = look.y = 0;
  return d;
}
