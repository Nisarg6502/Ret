# Ret

An endless desert world generated and simulated from physics, in one small HTML file.
No images, models, sounds or libraries: everything is computed at runtime with WebGL2.

See [PLAN.md](PLAN.md) for the full design and the milestone plan.

## What is in it so far

- **Sky** from a physical atmosphere model (Hillaire 2020): Rayleigh, Mie and ozone, plus a
  mineral dust layer whose iron oxides absorb blue light. Sunsets, the blue hour and the hazy
  ochre horizon come out of the scattering maths, not from painted gradients.
- **Sun** placed by a real solar ephemeris for any latitude, day and time; limb-darkened disc.
- **Dunes** shaped like real ones: gentle windward slopes, slip faces at the angle of repose
  (never steeper than 34°), crests that break into crescents with horns pointing downwind, and
  smaller dunes riding on megadunes. Rock plateaus with layered sandstone and salt flats with
  cracked crusts.
- **Sand** with wind ripples across the wind, darker heavy minerals in ripple troughs, grain
  flow on slip faces, the bright "opposition" glow away from the sun, and sparkling quartz grains.
- **Endless terrain** streamed with geometry clipmaps out to about 16 km, with soft sun shadows
  and Earth curvature.
- **Controls** for keyboard and mouse, touch (floating joystick, drag to look, optional gyro)
  and gamepads.

## Controls

| | PC | Phone / tablet | Gamepad |
|---|---|---|---|
| Move | WASD / arrows | left thumb | left stick |
| Look | mouse | right thumb, or TILT for gyro | right stick |
| Run | Shift | push the joystick far | trigger |
| Jump | Space | JUMP | A |
| Free flight | V | FLY | X |
| Time faster / slower / pause | ] / [ / \ | TIME cycles speeds | Start |
| Hide HUD / fullscreen | H / F | | |

URL options (after `#`, joined with `&`): `s=` world seed, `t=` solar time in hours,
`d=` day of year, `lat=` latitude, `dust=` dust optical depth, `speed=` time multiplier,
`debug` shows FPS.

## Develop

```sh
npm install
npm run build   # writes dist/index.html and prints a per-module size report (300 KB cap)
npm run dev     # rebuild on change, serves dist/ at http://localhost:8080
npm test        # physics and terrain checks (sun position, angle of repose, slip faces)
npm run shots   # headless screenshots of fixed views into shots/
```

## Deploy

`.github/workflows/pages.yml` builds and deploys `dist/` to GitHub Pages on every push to `main`.
One-time setup in the repository: Settings, Pages, Source: **GitHub Actions**.
