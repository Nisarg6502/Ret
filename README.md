# Ret

An endless desert world generated and simulated from physics, in one small HTML file.
No images, models, sounds or libraries: everything is computed at runtime with WebGL2.

See [PLAN.md](PLAN.md) for the full design and the milestone plan.

## What is in it so far

- **Sky** from a physical atmosphere model (Hillaire 2020): Rayleigh, Mie and ozone, plus a
  mineral dust layer whose iron oxides absorb blue light. Sunsets, the blue hour and the hazy
  ochre horizon come out of the scattering maths, not from painted gradients.
- **Sun** placed by a real solar ephemeris for any latitude, day and time; limb-darkened disc.
- **Dunes** shaped like real ones: transverse megadunes 60 to 200 m tall with gentle windward
  slopes steepening into a sharp brink, slip faces at the angle of repose (never steeper than
  34°), crests that wander and break into crescents with horns pointing downwind, smaller dunes
  riding on the megadunes; irregular star dunes (2 to 5 curving arms of different lengths on a broad
  pedestal) where the wind is multidirectional; and long continuous linear (seif) dunes with sharp
  sinuous crests where it is bimodal. The wind regime map decides which form grows where. Rock plateaus with layered sandstone, and white salt pans on
  interdune floors.
- **Sand** with wind ripples across the wind, darker heavy minerals in ripple troughs, grain
  flow on slip faces, the bright "opposition" glow away from the sun, and sparkling quartz grains.
- **Night**: a moon with real phases and orbit that lights the sand silver and scatters moonlight
  into the sky, the planet's ring system (lit by the sun, with the planet's shadow across it and a
  seasonal ring shadow on the ground), the Milky Way, stars, airglow and night-adapted vision.
- **Alive**: one climate model couples sun, heat and wind. Wind follows a daily cycle with gusts
  that travel across the dunes; sand only moves above the real transport threshold, streaming in
  sheets over windward slopes and flung off crests; dust motes drift; dust devils rise on hot calm
  afternoons; clouds drift and cast shadows; heat shimmer near the horizon; ripples creep downwind;
  mirages over hot flat ground (critical angle from the air's refractive index, drawn about 3.5x
  wider than physical so it reads on a screen).
- **Sound**: wind that follows speed and gusts, a whistle whose pitch rises with wind speed, sand
  hiss when grains are moving, footsteps. M mutes.
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
| Time faster / slower / pause (up to ×3600) | ] / [ / \ | TIME cycles speeds | Start |
| Skip to sunrise, noon, golden hour, dusk, night | T | SKIP | B |
| Hide HUD / fullscreen / mute | H / F / M | | |

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
