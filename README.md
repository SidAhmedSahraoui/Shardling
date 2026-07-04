<div align="center">

# Shardling

**A 3D momentum-physics platformer for the web, every mesh, material, and sound generated in code.**

You play a shardling: a palm-sized orb of living soot with one luminous eye, rolling through the Hollow, a ruined sky-temple of floating stone islands. Collect every shard, wake the portal gate, and don't touch anything sharp.

TypeScript · Three.js · Rapier (WASM) · Vite - ~1.1 MB gzipped, no binary assets.

<video src="demo/shardling-15s-1080p.mp4" controls muted loop playsinline width="760"></video>

**▶️ [Watch the 15-second gameplay demo →](demo/shardling-15s-1080p.mp4)** &nbsp;·&nbsp; 1080p MP4

</div>

---

## About this project

I built Shardling to see how far a browser game can go with **zero art pipeline**. There are no models, textures, or audio files anywhere in this repository, every triangle is assembled from parametric primitives, every material is painted onto a canvas at boot, and every sound is synthesized live with the Web Audio API. The whole thing, physics engine included, ships in about 1.1 MB gzipped and runs at 60 fps on a mid-range phone.

It's a complete game: 20 hand-authored levels across four worlds, a real momentum-based feel, moving hazards, mobile touch controls, save progress, and a menu-to-credits loop. This repo is a **portfolio piece** - I'm sharing it to show how I approach game feel, engine architecture, and shipping-quality web performance.

## What's interesting in here

**Game feel comes first.** The ball moves by force, not by setting velocity, with carefully tuned acceleration, friction, and speed clamps. On top of that sits a small, unit-tested state machine handling the things that make a platformer feel fair: coyote time, jump buffering, a variable-height jump you can cut mid-rise, and a double jump that refreshes on landing. I tuned all of it live through an in-game panel (`?debug=1`) and copied the values straight back into a single `tuning.ts`.

**The simulation is deterministic.** Physics runs on Rapier (compiled to WebAssembly) stepped at a fixed 60 Hz accumulator, and the renderer interpolates between the last two physics states. That means the game behaves identically on a 60 Hz laptop and a 144 Hz monitor, the refresh rate never leaks into the simulation, and a fast-moving ball can't tunnel through thin floors.

**The world moves with you.** Kinematic platforms and sweeping blades are driven position-based so riders are carried natively; the rolling ball gets an extra force-coupling model on top, because a sphere won't stay on a moving platform through friction alone.

**Levels are data, and the data is checked.** Each level is a JSON file validated by a Zod schema plus a geometry sanity pass, it verifies every shard is reachable, gaps are jumpable, and no hazard can kill you before you've seen it. That runs as part of the build gate, so a broken level can't ship.

**It's built to ship.** A thin SDK layer keeps the game portal-agnostic (it runs fully offline with an inert default, and a portal adapter activates only on the right domain), cloud save mirrors local progress with localStorage as the source of truth, and the production build hard-fails if the payload creeps over 4 MB.

**Performance is budgeted, not hoped for.** Terrain is merged per material and repeated meshes are instanced to stay under 100 draw calls; one half-resolution bloom pass carries the look; device tiering caps the pixel ratio on weaker hardware. It holds 60 fps even at 4× CPU throttle.

**And it's tested.** 215 unit tests cover the pure logic, the jump state machine, save-file migrations, level schemas, camera-relative input math, kept deliberately free of any Three.js or Rapier imports so they run in milliseconds.

## Controls

| Action     | Keyboard / Mouse                                         | Touch                             |
| ---------- | -------------------------------------------------------- | --------------------------------- |
| Move       | `WASD` / Arrow keys                                      | Left on-screen joystick           |
| Jump       | `Space` (tap low, hold high; press again to double-jump) | Right jump button                 |
| Aim camera | Drag mouse                                               | Drag the right side of the screen |
| Zoom       | Scroll wheel                                             | Pinch                             |
| Pause      | `P`                                                      | Pause button                      |

## Run it locally

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

Then open the URL and press **Play**.

Useful during development:

```bash
npm run check      # typecheck + lint + tests + level validation (the "is it done?" gate)
npm run build      # production build; prints gzip sizes and enforces the size budget
npm run preview    # serve the production build
```

Two debug flags help when tuning: `?debug=1` shows Rapier collision lines, FPS / draw-call / body counters, a free-fly camera, and a live tuning panel; `?nojuice=1` strips all the particles, screen-shake, and squash-and-stretch so you can feel the difference the polish makes.

## How it's built

Input flows one way and the layers stay decoupled. A typed event bus is the only channel between systems, the DOM UI never reaches into gameplay objects, and gameplay never touches the DOM.

```
input → InputManager (camera-relative) → Player (forces) → Rapier step
      → events → EventBus → HUD / LevelRunner / Audio / VFX
```

Two rules keep it honest: **every number lives in `config/tuning.ts` and every color in `config/palette.ts`** (a hardcoded constant anywhere else is treated as a bug), and **physics and visuals are separated** - each entity is a physics body plus a visual wrapper, and effects like squash-and-stretch only ever touch the wrapper, never the collider.

## Tech stack

- **TypeScript** in strict mode
- **Three.js** for rendering, with the `postprocessing` library for bloom and vignette
- **Rapier** (`@dimforge/rapier3d-compat`) for physics, running as WebAssembly
- **Vite** for the dev server and build, **Vitest** for tests, **Zod** for level and save-file validation

## Project structure

```
src/
├─ main.ts            bootstrap: await RAPIER.init(), create the App
├─ config/            tuning (every number) · palette (every color)
├─ core/              App · GameLoop (fixed-step + interpolation) · EventBus · SaveManager · AudioSynth · InputManager
├─ gfx/               MeshFactory · MaterialFactory · ParticleFactory · PostFX · BlobShadow
├─ screens/           DOM overlays: Menu · LevelSelect · HUD · Pause · LevelComplete
├─ game/              GameScreen · CameraRig · LevelRunner · physics/ (world, collision groups, queries)
├─ entities/          player/ · hazards/ · Shard · Portal · EntityFactory
├─ levels/            schema · loader · registry · data/*.json (20 levels)
├─ sdk/               portal abstraction (inert by default)
└─ ui/                strings · DOM helpers · touch controls
scripts/              level validation · bundle-size report
tests/                Vitest suites (pure logic, no engine imports)
```

## Credits

Designed, built, and tuned by **Sid Ahmed Sahraoui**.

Shardling is an original game, its world, mechanics, names, and every asset are my own work. This repository is public as a demonstration of my game-development work; you're welcome to read through it and take ideas, but it isn't set up to accept outside contributions.
