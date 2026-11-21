# ERG: a procedural desert world in under 90 KB

Working title. "Erg" is the geographers' word for a sand sea. Rename anytime.

This is the design and implementation plan. Nothing is built yet. Read it, mark what to change, then we implement milestone by milestone.

---

## 0. One-paragraph summary

A single HTML file, at most **90 KB raw**, with **zero assets and zero network requests**, that renders an endless, explorable desert planet in the browser on **phones and PCs**. Everything (terrain, sky, sand, weather, plants, ruins, creatures, sound, music) is generated from math at runtime. The twist that makes it ours: the world is driven by **one coupled physical simulation**. The sun heats the ground, the heat drives thermals, dust devils, mirages and the daily wind cycle, the wind moves sand only above the real transport threshold, and dust thrown into the air changes the colour of the sky. Nothing is hand-animated where physics can cause it. You can **walk, sandboard down slip faces, and soar on a glider using real thermals**.

---

## 1. The reference, and how we go further

**Abyssal Garden** (built with Fable 5.2, shared on r/ClaudeAI, Nov 2026):

- WebGPU, a single HTML file of about 96 to 97 KB (press reports differ).
- No images, models or sound files: scenery and audio are procedural (Web Audio).
- Kelp forest, sunken ship, stone whale fluke, manta rays, fish schools.
- Claimed 180 FPS on an RTX 5070 Ti.
- Sources: [TweakTown](https://www.tweaktown.com/news/114695/claude-fable-5-2-builds-a-swimmable-underwater-world-in-a-single-97kb-html-file/index.html), [Instalki](https://www.instalki.pl/news/software/claude-stworzyl-podwodny-swiat-szokuje-detalami-a-zajmuje-96-kb/), [ProfesionalReview](https://www.profesionalreview.com/2026/11/16/fable-5-2-mundo-submarino-96-kb/amp/). (I could only read search summaries; the article pages are blocked from this environment.)

**Where ERG aims higher**

| Axis | Abyssal Garden | ERG target |
|---|---|---|
| Size | ~97 KB | **≤ 90 KB raw**, size gate in the build |
| Reach | WebGPU only | **WebGL2**: virtually every phone and PC browser |
| Motion | scripted/animated life | **simulated**: causes produce effects |
| Traversal | swim | **walk, sandboard, glide** (3 physics models) |
| Time | static scene | full **day/night**, seasons, **weather events** |
| Variety | one world | **shareable seeds** that also change planet parameters |

---

## 2. World concept (original, Dune-inspired in mood only)

**Setting.** A ringed desert planet. Earth-like physical constants by default (gravity, air, sun), with a vast **ring system arcing across the sky** and casting a seasonal shadow band on the ground. A long-vanished civilisation left half-buried monuments. No text, no story: environmental storytelling only.

**Originality rules (deliberate).** No Dune names, no sandworm, no spice, no stillsuits, no ornithopters, no two-moon sky. The sandworm is the single most recognisable Dune element, so we skip it. Our signature images are instead: the ring arc, a buried colossus, fossil ribcages, glass fields, singing dunes, and dust storms you can watch roll in.

### Biomes (blended by low-frequency noise fields)

| Biome | Real-world analogue | Features |
|---|---|---|
| Great Erg | Rub' al Khali, Namib | Megadunes with superimposed smaller dunes, ripples, singing slip faces |
| Hamada | Tassili, Tibesti | Rock plateau, mesas, wind-streamlined yardangs, mushroom rocks, layered sandstone |
| Playa | Salar flats, Deadvlei | White salt/clay pan, hexagonal crust, dead trees, mirages at midday |
| Wadi | Saharan wadis | Dry riverbed, acacias, dry grass, tumbleweeds |
| Oasis (stretch) | Ubari lakes | Rare pond with sky reflections, palms |

### Landmarks (rare, placed deterministically per 1 km cell)

- **Buried colossus**: a giant stone head and shoulders half swallowed by a dune.
- **Colonnades and arches**: eroded columns, stairs descending into sand.
- **Fossil ribcage** of a colossal animal, ribs arching over the sand.
- **Obelisk sundial** on an old plaza: its shadow reads the true local solar time.
- **Glass field**: scattered desert glass shards that sparkle in low sun.
- **Dead-tree pan**: black skeletal trees on a white playa against orange dunes.

---

## 3. Constraints and success criteria

**Hard constraints**

- One file: `dist/index.html`, **≤ 90 KB raw bytes** (the headline number; gzip/brotli reported too).
- No external requests at all: no CDN, no fonts, no images, no audio files. Works offline, even opened from disk.
- Runs in current Chrome, Edge, Safari (macOS and iOS), Firefox, Samsung Internet.

**Performance targets**

| Device class | Target |
|---|---|
| Desktop with discrete GPU | 120+ FPS at native res, High |
| Laptop iGPU / Apple M-series | 60 FPS at 1080p, Medium to High |
| Mid-range phone (iPhone 13, Pixel 7 class) | 60 FPS, Low/Medium with dynamic resolution |
| Older phones | 30 FPS, Low |
| First frame | < 1 s on desktop, < 2.5 s on phones |

**Measurable "accurate physics" checks** (each becomes a test or debug view)

1. Sun position matches the NOAA solar calculator within 0.5° for any date, time and latitude.
2. No terrain slope exceeds the angle of repose (34°); slip faces sit at 32 to 34°.
3. Barchan horns point downwind; ripple crests are perpendicular to the local wind.
4. Below the threshold wind (about 5 to 6 m/s at 2 m height) no sand moves.
5. Sunset reds, blue hour and dust-storm orange all **emerge** from scattering math, never from hand-tuned gradients.
6. Mirages appear only on hot flat ground near midday, in a band about 0.3 to 0.4° below the horizon.
7. A paraglider loses about 1 m of height per 8 to 10 m flown in still air.

---

## 4. Technology choice

| | WebGL2 (recommended) | WebGPU |
|---|---|---|
| Device reach | ~all phones and PCs | Chrome/Edge, Safari 26+, Firefox (partial). Older iPhones and many Android GPUs still miss it |
| Code size | small (GLSL ES 3.0, little boilerplate) | larger (WGSL + pipeline/bind group setup) |
| Compute shaders | no; we use ping-pong render targets | yes |
| Fits our needs | yes: particles, LUTs, volumetrics all work via fragment passes | yes |

**Recommendation: WebGL2.** It reaches more phones, costs fewer bytes, and every technique below works with fragment-shader passes. If you prefer to match the reference, we can switch to WebGPU (it changes the code, not the plan).

**Extensions and fallbacks**

- `EXT_color_buffer_float` for float render targets; fall back to `RGBA16F` via `EXT_color_buffer_half_float`.
- Float textures are read with `texelFetch` (no linear filtering needed), because iOS lacks `OES_texture_float_linear`.
- `KHR_parallel_shader_compile` so shaders compile while the intro plays.
- No dependencies of any kind (three.js alone would be ~600 KB).

---

## 5. Architecture

### 5.1 The causal graph (the heart of the design)

```
 date, time, latitude
        |
        v
 SUN EPHEMERIS --> insolation per slope --> SURFACE TEMPERATURE (with thermal lag)
        |                                         |
        |              +--------------------------+------------------+----------------+
        |              v                          v                  v                v
        |          THERMALS                  DUST DEVILS       MIRAGE + SHIMMER   DAILY WIND CYCLE
        |       (glider lift, birds)                                                  |
        v                                                                             v
 ATMOSPHERE <---- dust load <---- SALTATION / DUST FLUX <---- friction velocity u* <-- WIND FIELD
 (sky colour,                         |                                            (gusts, terrain
  sun colour,                         +--> sand streamers, ripple migration,        speed-up, lee
  visibility)                         |    tracks filling in, glints                eddies, storms)
                                      +--> audio: hiss, whistles, booming dunes
```

One small CPU "climate" module owns the global state (sun vector, air and ground temperature, wind vector and gust phase, dust load, weather event). Shaders receive it as a uniform block and evaluate the local variation per pixel or per particle.

### 5.2 Modules

- `gl`: context, shaders, render targets, fullscreen pass, instancing helpers.
- `input`: keyboard/mouse, touch joystick, gyro, gamepad, unified into one action state.
- `climate`: ephemeris, temperatures, wind, weather scheduler.
- `world`: height function (GLSL + identical JS port), clipmap streaming, prop placement.
- `sim`: player, sandboard, glider, tumbleweeds, birds, particles.
- `render`: the frame graph below.
- `audio`: synthesis graph driven by `climate` and `sim`.
- `ui`: intro, HUD, menu, photo mode, share link.

### 5.3 Frame graph (per frame)

1. **Clipmap update** (only when the player crosses a texel row): regenerate the new strips of each height level.
2. **Atmosphere LUTs**: transmittance and multi-scattering (only when planet or dust changes), sky-view LUT (every frame, tiny), aerial-perspective volume (every frame or every other).
3. **Terrain sun shadows**: heightfield ray-march into a low-res shadow texture, amortised over frames as the sun moves.
4. **Prop shadow map**: one stabilised cascade around the player.
5. **Particle simulation**: ping-pong state textures.
6. **Opaque pass** into an HDR target: terrain, instanced props, SDF landmarks, vegetation.
7. **Sky pass**: atmosphere, sun, moon, rings, stars, cirrus.
8. **Particles**: sand streaks and dust sprites (soft, depth-aware).
9. **Volumetric dust** at half or quarter resolution, upsampled with depth awareness.
10. **Post**: mirage and heat shimmer, bloom, auto-exposure, tone mapping, night vision shift, grain, light TAA.
11. **HUD** in plain DOM.

---

## 6. Physics and models

All units are SI. Default constants: g = 9.81 m/s², air density ρa = 1.15 kg/m³ (hot air), quartz ρs = 2650 kg/m³, median grain d = 0.25 mm, angle of repose 34°.

### 6.1 Sun, moon, stars, rings

- **Sun position**: day of year → declination δ (with equation of time), hour angle H, latitude φ (default 23.5° N) → elevation and azimuth: `sin(alt) = sin φ sin δ + cos φ cos δ cos H`.
- **Sun disk**: 0.53° wide, limb darkening `I(μ) = 1 − 0.6 (1 − μ)`, colour from a 5778 K blackbody filtered by atmospheric transmittance (so it reddens at sunset by itself).
- **Moon**: one moon, phase from the sun-moon geometry, Lommel-Seeliger shading, ~400 000× dimmer than the sun (auto-exposure handles it).
- **Stars**: procedural on the sphere (hash per cube-map cell, no star data stored), magnitude distribution, colours from blackbody temperatures, rotation about the celestial pole for the chosen latitude, stronger twinkle near the horizon (more air mass), Milky Way band from noise.
- **Rings** (our signature): annulus in the planet's equatorial plane (inner 1.6 R, outer 2.4 R, banded optical depth from 1D noise). Computed by intersecting the view ray with the ring plane in planet coordinates. Lit by the sun with forward scattering; dim when the sun is edge-on to the ring (equinox); the **planet's shadow falls across the rings at night**; the **rings cast a shadow band on the ground** in winter at our latitude. All of it falls out of the geometry.

### 6.2 Atmosphere (Hillaire 2020, the current production standard)

- Rayleigh scattering βR = (5.80, 13.56, 33.1)·10⁻⁶ m⁻¹, scale height 8 km.
- Mie background aerosol: scattering 4.0·10⁻⁶, absorption 4.4·10⁻⁶ m⁻¹, scale height 1.2 km.
- Ozone absorption (0.65, 1.88, 0.085)·10⁻⁶ m⁻¹, tent layer at 25 km: this is what makes the **blue hour** blue.
- **Desert dust layer** (added): scale height 2 to 4 km, Henyey-Greenstein g ≈ 0.72, single-scattering albedo lower in blue than red (iron oxides absorb blue). This is why desert haze looks ochre and the sun turns copper in a dust storm, and it comes from the numbers, not a tint.
- LUTs: transmittance 256×64, multi-scattering 32×32, sky-view 192×108, aerial perspective 32×32×32.

### 6.3 Surface temperature

- Incoming flux per surface element: `S · max(0, n·sun) · transmittance`, so sun-facing slopes heat more.
- First-order thermal lag: `dT/dt = (T_eq − T) / τ`, τ ≈ 1.5 h, so the ground peaks around 13:30 and the air around 15:00.
- Typical range: sand surface 60 to 70 °C at midday, 10 °C before dawn; air at 2 m peaks around 40 to 45 °C.
- Global values on the CPU; per-slope variation in shaders.

### 6.4 Wind field

- **Log-law profile**: `u(z) = (u*/κ) ln(z/z0)`, κ = 0.41, z0 ≈ 10⁻⁴ m on sand.
- **Daily cycle**: calm at dawn, strongest mid-afternoon when convective mixing brings fast air down, easing at night.
- **Gusts**: 2D noise advected with the mean wind, so gust patches visibly travel across the dunes.
- **Turbulence**: 3D curl noise (divergence-free, like real incompressible flow) for particles.
- **Terrain response**: speed-up over crests (Jackson-Hunt, Δu/u ≈ 2h/L), weak reversed flow in the lee eddy behind slip faces (particles swirl there), funnelling between yardangs.
- **Direction regime**: slowly veering mean direction; its variability also selects the dune type (section 6.6).

### 6.5 Sand transport

- **Threshold** (Bagnold): `u*t = A √((ρs − ρa)/ρa · g · d)`, A ≈ 0.1 → u*t ≈ 0.23 m/s, about 5 to 6 m/s at 2 m height.
- **Hysteresis**: once moving, sand keeps moving down to ≈ 0.8 u*t (impact threshold). Real and visible: streamers linger after a gust.
- **Flux** (Kawamura): `q = C (ρa/g) u* (u*² − u*t²)`, zero below threshold, cubic above. Drives particle emission, ripple migration, track erasure and sand-hiss loudness.
- **Saltating grains** (GPU particles): launched at 30 to 50°, integrated with gravity and quadratic drag toward the local log-law wind; terminal velocity about 2 m/s; rebound on impact with restitution about 0.5. Result: hops of a few cm to about 1 m, impact angles around 10 to 15°, exactly the low hissing sheets seen in real deserts.
- **Dust** (< 60 µm): settles at mm/s, so it rides turbulence and accumulates as haze; global dust load feeds the atmosphere's dust layer.
- **Footprints and board trails** are written into a small deformation texture around the player and are filled in at a rate proportional to q: in a strong wind your tracks vanish.

### 6.6 Dune morphology (geomorphologically correct)

- **Dune type from science** (Wasson and Hyde classification), blended by two low-frequency fields, sand supply S and wind variability V:
  - low S, one wind direction → **barchans** (crescents, horns pointing downwind)
  - high S, one direction → **transverse / barchanoid ridges**
  - two directions → **linear (seif) dunes**
  - many directions → **star dunes**
- **Two superimposed scales** (compound dunes, as in the Namib): megadunes (spacing 1 to 2 km, height 50 to 150 m) carrying smaller dunes (spacing 50 to 150 m, height 3 to 10 m).
- **Asymmetric profile by construction**: gentle convex stoss side (5 to 15°), lee slip face built with slope exactly ≤ tan 34°, so the angle of repose holds at every LOD. Crests are made sinuous by domain warping. Optional GPU avalanche relaxation pass on the finest level if shapes look too regular.
- **Ripples** (shader detail): wavelength 8 to 12 cm, amplitude ~5 mm, asymmetric, crests perpendicular to local wind, absent on slip faces (replaced by grain-flow tongues running down the fall line) and in the lee eddy, **slowly migrating downwind** when q > 0. Coarse megaripples (1 to 3 m) in interdune corridors.
- **Mineral colour**: darker heavy minerals collect in ripple troughs; older inland dunes are redder (iron oxide coating); interdunes are coarser and greyer.
- **Earth curvature** in the vertex shader (drop = d²/2R), giving a true horizon when you glide high.

### 6.7 Dust devils

- Rankine vortex: solid-body core, `vθ = Γ / (2πr)` outside; inflow at the ground, updraft in the core.
- Spawn only on hot afternoons, low mean wind, flat sun-baked ground; drift with the mean wind; diameters 2 to 30 m, heights up to several hundred metres, life of a few minutes.
- They lift saltation and dust particles and add density to the volumetric pass. Gliders can use them: they mark strong thermals.

### 6.8 Haboob (dust storm)

- Modelled as a gravity current: a wall 1 to 2 km high advancing at 10 to 20 m/s with a turbulent, billowing front.
- Visibility drops below 100 m inside; sun dims to a copper disc via the dust-layer optics; wind gusts and particle counts spike; dry lightning flickers inside (flash, then thunder delayed by distance / speed of sound at the current air temperature, ~355 m/s at 40 °C).
- Scheduled by the weather system (rare, more likely in the afternoon); can be triggered from the menu.

### 6.9 Mirage and heat shimmer

- Refractivity of air scales with density: `n − 1 ≈ 2.93·10⁻⁴ · (273 K / T)`. A 20 to 25 K difference between the air touching the ground and the air above gives Δn ≈ 2·10⁻⁵ and a critical angle `θc = √(2Δn) ≈ 0.3 to 0.4°`.
- Rays hitting flat hot ground below θc are bent back up: we show the sky (and distant objects, inverted) in that thin band. This is what a real desert mirage looks like; it is thin, and photo-mode zoom shows it well.
- Heat shimmer: screen-space distortion whose strength follows ground-air temperature difference, path length near the ground and grazing angle. Gone at night, as in reality.

### 6.10 Movement physics

- **Walking**: speed reduced on soft sand and uphill; on slopes above ~30° the sand gives way and you slide back while climbing (as on real slip faces); descending a slip face triggers a grain-flow avalanche and the booming-dune sound.
- **Sandboarding**: `a = g (sin θ − μk cos θ) − drag`, μk ≈ 0.35 for a waxed board. Rideable only above ~19°, which means slip faces, exactly like real sandboarding. Carving by edge angle, spray particles, jumps off crests.
- **Glider (paraglider)**: polar curve (trim ~11 m/s, min sink ~1.1 m/s, glide ratio 8 to 10), banking turns with load factor, stall at low speed.
  - **Thermals**: positioned over sun-heated slopes and flats, strength from the surface temperature, rising 1 to 5 m/s, spacing about 2.5× the boundary-layer depth.
  - **Ridge lift**: `w ≈ U sin θ` on windward faces of large dunes and mesas.
  - **Vario**: a beeping variometer whose pitch rises with climb rate, as real pilots use.
- **Tumbleweeds**: rigid bodies with drag `F = ½ ρa Cd A |u − v|(u − v)` (Cd ≈ 0.8, mass ~0.3 kg), gravity, bouncing and rolling on the heightfield.

### 6.11 Vegetation response

- Grass and branches bend with dynamic pressure `½ ρa U²` as damped springs driven by the gust field; trees sway far less than grass.
- Plants only grow in interdune corridors, wadis and rock cracks, never on active dune crests (as in real ergs).

### 6.12 Acoustics

- **Aeolian tones**: wind passing edges of the obelisk, columns and rocks whistles at `f = St · U / D` (St ≈ 0.2): pitch rises with wind speed.
- **Booming dunes**: avalanches drone at `f ≈ 0.4 √(g/d)` ≈ 80 Hz for our grain size (published range 70 to 105 Hz).
- **Open desert is acoustically dead**: dry, close sound in the open; echoes only near cliffs and ruins.

---

## 7. Rendering details

### 7.1 Terrain

- **Geometry clipmaps**: nested square rings around the camera, each level twice the spacing of the previous one (0.5 m up to 128 m spacing, about 32 km coverage). Heights live in an `R32F` texture array (one layer per level) updated toroidally, so only new strips are computed as you move.
- **Geomorphing** between levels to prevent popping.
- **Height function written twice**, GLSL and JS, using integer hashes (`Math.imul` in JS) so CPU physics and GPU rendering agree bit for bit. A debug test compares them.
- **Precision**: integer texel coordinates per level and camera-relative rendering, so the world stays crisp even thousands of km from the start.

### 7.2 Sand material

- Diffuse: Oren-Nayar (rough, σ ≈ 0.5).
- **Opposition surge** (Hapke shadow-hiding): sand brightens when you look away from the sun. Real and very visible on dunes.
- **Quartz glints**: stochastic microfacet sparkles per grain cell, filtered by pixel footprint so they never alias.
- Normal detail from ripples, grain-flow streaks, footprint texture.
- **Sky and ground bounce lighting**: sky irradiance from the sky-view LUT plus warm bounce from sunlit sand (albedo ~0.4) into shadows; horizon-based occlusion from the coarse heightfield.
- **Shadows**: soft sun shadows from heightfield ray-marching, with penumbra width from the sun's 0.53° disc.

### 7.3 Other materials

- **Sandstone rock**: horizontal strata and cross-bedding (fossil dunes frozen in stone), desert varnish darkening on old faces.
- **Salt playa**: hexagonal crack network (Voronoi), raised crust edges, high albedo.
- **Ruins**: weathered sandstone with sand-blasted lower parts.

### 7.4 Props and landmarks

- **Rocks**: ~8 variants generated at load (displaced subdivided icosahedra), instanced with random scale and rotation.
- **Yardangs** and **mushroom rocks**: part of the hamada height function and SDF props. Mushroom rocks are undercut below about 1 m, where saltating sand does almost all its abrasion.
- **Landmarks** (colossus, colonnades, ribcage, obelisk): signed distance functions ray-marched inside bounding boxes, writing depth so they mix correctly with terrain. Cheap in bytes, rich in detail.
- **Vegetation**: grass tufts generated in the vertex shader from the instance ID (no stored geometry); acacias and dead trees from a small recursive branch generator at load.
- **Placement**: jittered grids per cell (64 m for small props, 1 km for landmarks), filtered by biome and slope, all seeded.

### 7.5 Particles

- State in ping-pong float textures (position + age, velocity + type), drawn as instanced quads.
- Sand grains drawn as **motion-blurred streaks** (length = velocity × shutter time), sub-pixel wide with coverage alpha: they read as flowing sheets, with sun glints when backlit.
- Dust drawn as soft sprites lit with the forward-scattering phase function: glowing when you look toward the sun.

### 7.6 Volumetrics

- Half or quarter resolution ray-march with blue-noise jitter and temporal accumulation.
- Density = haboob front + dust devil columns + low ground haze (height-exponential with noise).
- Sun light via a short secondary march, two-octave multiple-scattering approximation, HG phase g ≈ 0.7.
- Depth-aware upsample into the full-resolution image.

### 7.7 Post-processing

- **Auto-exposure** from average log luminance with eye-like adaptation speed (dark to light faster than light to dark).
- **Tone mapping**: AgX (keeps desert oranges natural, avoids the hue shifts of ACES).
- **Night vision shift** (Purkinje): below ~1 cd/m² colours desaturate and shift blue, as human vision does under moonlight.
- Bloom (dual-filter chain), subtle grain and vignette.
- **AA**: light TAA (camera reprojection, static world) on Medium/High; analytic filtering everywhere so Low looks clean without it.

### 7.8 Art direction

- Start at golden hour, the most flattering light.
- Landmarks prefer ridgelines and long sightlines, so they are discovered as silhouettes.
- Colour comes from physics; art direction lives in choices (latitude, dust, time, composition), not paint.
- System serif typography (Iowan Old Style, Palatino, Georgia), wide letter-spacing, nothing else on screen unless needed.

---

## 8. Audio (all synthesised with Web Audio)

| Layer | How | Driven by |
|---|---|---|
| Wind bed | two band-passed noise layers + low rumble | wind speed, gusts |
| Gust whistles | oscillators near edges, `f = 0.2 U / D` | wind speed, proximity |
| Sand hiss | high-passed noise | local saltation flux |
| Footsteps | short filtered noise grains, different for sand, rock, salt crust | step cycle |
| Booming dune | ~80 Hz drone with harmonics and slow beating | sliding on slip faces |
| Board and glider rush | filtered noise ∝ speed² | speed |
| Vario | beeps, pitch ∝ climb rate | glider |
| Thunder | low-passed noise bursts, delayed by distance / c(T) | lightning |
| Birds | occasional FM-synth cries | vultures |
| Music (toggleable) | sparse Karplus-Strong plucks in a Hijaz mode over a drone, density follows time of day | clock |

3D placement with `PannerNode` (HRTF). Reverb only near cliffs and ruins (procedural impulse response). Audio starts on the first tap or click (required by browsers).

---

## 9. Controls

| Action | PC | Phone / tablet | Gamepad |
|---|---|---|---|
| Move | WASD / arrows | floating joystick: touch anywhere on the left half | left stick |
| Look | mouse (pointer lock) | drag on the right half; optional gyro | right stick |
| Run | Shift | push the joystick to the edge | left trigger |
| Jump | Space | Jump button | A |
| Sandboard on/off | B | Board button | B |
| Glider (when airborne) | Space again | Glide button appears | A again |
| Steer board / bank glider | A/D or mouse | joystick | left stick |
| Time faster / slower / pause | ] / [ / \ | menu slider | D-pad |
| Photo mode (free cam, zoom, exposure) | P | camera icon | View |
| Hide HUD / fullscreen / mute | H / F / M | buttons in menu | |

**Mobile specifics**: pointer events with multi-touch tracking, `touch-action: none`, no pinch zoom, safe-area insets, screen wake lock while playing, vibration on landing (Android), gyro permission prompt on iOS, home-screen web-app meta tags for true fullscreen on iPhone, pause on tab switch, works in portrait and landscape.

**Comfort**: head bob tied to the step cycle, disabled under `prefers-reduced-motion`; adjustable sensitivity and invert-Y; lightning flashes can be turned off.

---

## 10. Website experience

1. **Landing = attract mode**: the world is already rendering behind the title, a slow cinematic flight over the dunes at golden hour. Title "ERG", one line of subtitle, an **Enter** button (also unlocks audio and pointer lock).
2. **Short control hint** that fades after a few seconds (different for touch and mouse).
3. **Minimal HUD**: compass strip with wind arrow, local solar time, wind in m/s and Beaufort, sand temperature. Altitude and vario only while gliding.
4. **Menu drawer**: quality, time speed, sound and music, sensitivity, gyro, trigger a dust storm, planet parameters (advanced).
5. **Share**: the URL holds seed, position, time and heading (`#s=…&p=…&t=…`). Every seed is a different planet: dune regime, sand colour, dust optics, ring tilt, latitude. Advanced mode can change gravity, air density and star temperature, and the physics follows (lower gravity = higher saltation hops and bigger dunes).
6. **Idle**: after 60 s without input the camera drifts into cinematic mode.

---

## 11. Quality tiers

| Setting | Low (phones) | Medium | High (desktop) |
|---|---|---|---|
| Render scale | 0.6 to 0.75, dynamic | 0.85, dynamic | 1.0, dynamic |
| Clipmap | 7 levels × 128² | 8 × 192² | 9 × 256² |
| Particles | 8 k | 32 k | 128 k |
| Volumetrics | ¼ res, 12 steps, storms only | ½ res, 24 steps | ½ res, 48 steps |
| Prop shadow map | 512² | 1024² | 2048² |
| TAA / glints | off / simple | on / on | on / on |
| Bloom levels | 3 | 4 | 5 |

Start on Medium, measure for 3 s, settle on a tier; dynamic resolution then holds the frame-time target. User override in the menu.

---

## 12. Size budget (minified, raw bytes)

| Module | Budget |
|---|---|
| Shell: HTML, CSS, HUD, menu, intro | 4 KB |
| Engine core: GL helpers, targets, loop, quality scaler | 6 KB |
| Input: keyboard, mouse, touch, gyro, gamepad | 4 KB |
| Shared GLSL: hashes, noises, fbm, Voronoi, curl, BRDF helpers | 3 KB |
| World: height function (GLSL + JS), dune types, biomes, clipmaps | 9 KB |
| Sand and ground shading: BRDF, ripples, glints, minerals, salt, rock | 8 KB |
| Atmosphere and sky: LUTs, aerial perspective, sun, moon, rings, stars, cirrus | 10 KB |
| Climate: ephemeris, temperatures, wind, weather scheduler | 4 KB |
| Particles: saltation, dust, devils, kicked sand | 6 KB |
| Volumetric storms | 4 KB |
| Props and landmarks | 9 KB |
| Fauna: vultures, tracks | 2 KB |
| Movement physics: walk, board, glider, tumbleweeds | 6 KB |
| Post: exposure, bloom, AgX, mirage, shimmer, TAA, grain | 4 KB |
| Audio and music | 5 KB |
| **Subtotal** | **84 KB** |
| Reserve | 6 KB |
| **Hard cap** | **90 KB** |

**How we stay small**

- esbuild minification and identifier mangling for JS.
- A small GLSL minifier in the build: strip comments and whitespace, shorten numbers (`1.0` → `1.`), shorten uniform and function names with a shared dictionary.
- Shared GLSL chunks assembled at runtime, never duplicated in the file.
- All geometry generated at runtime: no vertex data in the file.
- One noise toolbox reused by terrain, wind, particles, clouds and audio.
- The build prints a per-module size table and **fails above 90 KB**.
- The headline number is the honest raw file. A compressed self-extracting build (via `DecompressionStream`) is possible as an extra, not as the main claim.

---

## 13. Repository layout and build

```
PLAN.md
README.md
package.json          dev dependency: esbuild only
tools/
  build.mjs           bundle, minify JS + GLSL, inline into one HTML, size report, 90 KB gate
  glsl-min.mjs
  shots.mjs           Playwright screenshots at fixed seeds/times for visual regression
src/
  index.html          shell template + CSS
  main.js             boot, loop, quality control
  gl/                 context, shaders, targets, meshes
  input/              keyboard-mouse, touch, gyro, gamepad
  climate/            sun, temperature, wind, weather
  world/              height (JS port), clipmap, props, landmarks
  sim/                player, board, glider, tumbleweeds, birds, particles
  render/             passes (terrain, sky, particles, volume, post)
  audio/
  ui/
  glsl/               lib, terrain, sand, sky, rings, particles, volume, post
dist/
  index.html          THE deliverable
```

Optional: GitHub Pages deployment of `dist/` from this repo.

---

## 14. Milestones

Each milestone ends with a playable build, screenshots, a size report, and your review before the next.

| # | Milestone | Contents | Acceptance | Cumulative size |
|---|---|---|---|---|
| M0 | Foundations | build pipeline, size gate, GL core, input on all devices, debug fly camera | single file builds; flying works with mouse, touch and gamepad | ~8 KB |
| M1 | Sky | ephemeris, atmosphere LUTs, sun disc, exposure, AgX, stars | sun within 0.5° of NOAA; sunset and blue hour emerge with no colour tuning | ~18 KB |
| M2 | Terrain | height function (GLSL + JS), clipmaps, dune types, biomes, curvature, sand material, shadows, aerial perspective | slopes ≤ 34°; horns downwind; ripples ⟂ wind; no popping; 60 FPS on mid phone (Low) | ~35 KB |
| M3 | On foot | walking physics, slip-face slide-back, jump, collisions, head bob, mobile polish | climbing a slip face is hard; descending triggers grain flow | ~40 KB |
| M4 | Wind and sand | climate model, wind field, saltation and dust particles, tracks, ripple migration, grass | no sand moves below threshold; gusts sweep streamers; tracks fill in | ~50 KB |
| M5 | Weather | dust devils, haboob + volumetrics, dry lightning, shimmer, mirage, dust-coupled sky | haboob turns sun copper, visibility < 100 m; mirage only on hot flats | ~60 KB |
| M6 | Places | rocks with strata, yardangs, mushroom rocks, ruins, colossus, ribcage, obelisk sundial, dead-tree pan, acacias, tumbleweeds | sundial reads correct solar time | ~70 KB |
| M7 | Board and glider | sandboard, glider polar, thermals, ridge lift, vultures, vario | can climb in thermals; glide ratio 8 to 10 | ~75 KB |
| M8 | Sound | full audio graph and music | every sound has a physical driver | ~80 KB |
| M9 | Night and rings | moon phases, rings with shadows, Milky Way, Purkinje shift | ring shadow band appears in the right season | ~84 KB |
| M10 | Polish | quality tiers, intro, HUD, menu, photo mode, share links, planet parameters, accessibility, device testing, size crunch, deploy | ≤ 90 KB, targets met on your phone and PC | ≤ 90 KB |

---

## 15. Testing and verification

- **Visual regression**: headless Chromium + Playwright screenshots at fixed seeds and times (dawn, noon, sunset, night, storm, glide), at desktop and phone viewports.
- **Physics checks**: sun position vs reference values; slope histogram of generated terrain; GLSL vs JS height parity; zero flux below threshold; glide ratio from a scripted flight.
- **Performance**: frame-time logging per pass in a debug overlay (GPU timer queries where available).
- **Real devices**: I cannot run your phone from here, so at milestones M0, M2, M5 and M10 you open the build on your phone and PC and report FPS and feel.
- **Size gate** on every build.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Phones too slow for volumetrics and particles | tiers, quarter-res volumetrics, dynamic resolution, storms-only volumetrics on Low |
| Float render targets missing or unfilterable | `RGBA16F` fallback; `texelFetch` instead of filtering |
| Size creep | per-module budgets, build gate, reserve of 6 KB, cut list ready (oasis, tumbleweeds, music, cirrus) |
| Aliasing of ripples and glints | footprint-aware filtering, fade to average shading, light TAA |
| Shader compile stalls on load | parallel compile during the intro, small shader count |
| Dune shapes looking synthetic | two-scale compound dunes, domain warping, optional avalanche relaxation |
| iOS quirks (audio unlock, no fullscreen API, gyro permission) | Enter button gesture, home-screen meta tags, explicit gyro toggle |
| Too "Dune" | originality rules in section 2; ring planet and coupled-physics identity |

---

## 17. Decisions for you (my recommendation first)

1. **Graphics API**: WebGL2 for maximum phone reach (recommended), or WebGPU to match the reference.
2. **Size cap**: 90 KB raw hard cap (recommended), or allow up to 100 KB for more features.
3. **Signature sky**: ringed planet with one moon (recommended), or a plain Earth-like sky.
4. **Camera**: first person with board and glider visible at the edges (recommended, cheapest), or third person with a cloaked figure whose cape is a wind-driven cloth simulation (+~2 KB).
5. **Traversal scope**: walk + sandboard + glider (recommended), or walk only to save ~4 KB for more scenery.
6. **Name**: keep "ERG" or choose another.
7. **Hosting**: GitHub Pages from this repo, or you host the single file yourself.
