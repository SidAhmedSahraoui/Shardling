# SHARDLING — Claude Code Build Prompt (3D)

You are the lead engineer building **Shardling**, an original 3D momentum-physics platformer for the web. This document is the complete specification. Read it fully before writing any code. A `CLAUDE.md` file exists at the repo root — it defines the working rules for every session; this document defines _what_ to build.

---

## 0. Mission

Build a production-quality, portal-ready browser game:

- **Pitch:** You are a shardling — a palm-sized orb of living soot with one luminous eye — rolling through the Hollow, a ruined sky-temple of floating stone islands where light shattered into amber shards. Each level: collect every shard, then reach the portal gate. Momentum is everything: you roll, you carry speed, you jump and double-jump across the void. Traps kill instantly; restarts are instant. Short levels, escalating mastery.
- **Deliverable:** a complete game (20 levels at v1.0), shippable to web game portals, plus a clean, documented, tested codebase that a second engineer could extend without asking questions.

### Hard constraints

1. **Original IP only.** All art, names, level layouts, sounds, and text are created from scratch in this project. Never copy, reference, or imitate assets from any existing game.
2. **Zero binary assets.** Every mesh is built from parametric primitives in code (`MeshFactory`); every material/texture is generated (`MaterialFactory`, canvas textures); every sound is synthesized (Web Audio). The repo contains only source code and JSON. Tiny build, crisp at any resolution, fully iterable in code.
3. **Stack (fixed):** TypeScript (strict) · Three.js (latest stable at project start) · `@dimforge/rapier3d-compat` (WASM physics) · `postprocessing` (pmndrs) · Vite · Vitest · ESLint + Prettier · Zod. Dev-only: `lil-gui` (dynamically imported under `?debug=1`). No other dependencies without explicit approval. `three/examples/jsm` utilities (RoundedBoxGeometry, BufferGeometryUtils) are part of three and allowed.
4. **Performance:** 60 fps on a mid-tier phone and a 4 GB-RAM Chromebook; initial payload (JS + WASM) ≤ 4 MB gzipped; total build ≤ 15 MB.
5. **Phased delivery.** Work through the phases in §6 in order. At the end of each phase: run `npm run check`, fix everything, commit, update the Phase Log in `CLAUDE.md`, write a short summary, and **stop for review**.

---

## 1. Game Specification

### 1.1 Core loop

Spawn → roll/jump through the level → collect all shards (portal gate is dormant until then) → portal activates → roll through the gate → results screen (time, deaths, best time) → next level. Death (touch any hazard, or fall past the kill plane) → instant respawn at spawn, deaths +1, shards reset. Target level length: 20–90 seconds for a first clear.

### 1.2 Controls

Movement is **camera-relative**: input is projected onto the ground plane using the camera's current yaw.

| Action             | Keyboard / mouse                            | Touch                                |
| ------------------ | ------------------------------------------- | ------------------------------------ |
| Move               | `WASD` / arrows (relative to camera)        | Virtual joystick, bottom-left        |
| Jump / double jump | `Space`                                     | Jump button, bottom-right            |
| Rotate camera      | `Q`/`E`, or hold left mouse button and drag | Drag on the right half of the screen |
| Zoom               | Mouse wheel (clamped 6–12 u)                | Pinch (optional, clamp same)         |
| Restart level      | `R`                                         | Pause menu → Restart                 |
| Pause              | `Esc` / `P`                                 | Pause icon, top-right                |

Touch: joystick base ~120 px with 20 px dead zone; jump button ~80 px; full multitouch (steer + rotate + jump simultaneously). All input flows through `InputManager`, which exposes `{moveVec (camera-relative, normalized XZ), jumpPressed, jumpHeld, camYawDelta, zoomDelta}` per frame — gameplay code never reads keys or pointers directly.

### 1.3 Movement & game feel

The player is a Rapier **ball collider** (radius 0.4 on a 1-unit grid) on a dynamic rigid body with **CCD enabled** (a fast marble must never tunnel through thin floors). Movement uses **forces, never position writes**; rolling rotation emerges from friction. All constants live in `src/config/tuning.ts`, live-editable via the debug panel (§5.4).

| Constant                           | Initial value | Notes                                                 |
| ---------------------------------- | ------------- | ----------------------------------------------------- |
| `gravityY`                         | −32           | world gravity (game-y, not realistic)                 |
| `ballRadius` / `ballMass`          | 0.4 / 1       |                                                       |
| `moveForce`                        | 30            | applied along camera-relative input each physics tick |
| `airControlMult`                   | 0.55          | multiplier on moveForce while airborne                |
| `maxSpeedXZ`                       | 8             | hard clamp on horizontal speed                        |
| `maxFallSpeed`                     | 22            | clamp on −vy                                          |
| `jumpVelocity`                     | 11            | vy set on jump                                        |
| `doubleJumpMult`                   | 0.9           | second jump = jumpVelocity × this                     |
| `jumpCutMult`                      | 0.5           | on release while rising: vy × this (variable height)  |
| `coyoteMs` / `jumpBufferMs`        | 100 / 120     | grace windows                                         |
| `friction` / `restitution`         | 0.9 / 0       | rolling feel                                          |
| `linearDamping` / `angularDamping` | 0.12 / 0.6    | stop drift, keep control                              |

**Physics loop:** fixed timestep at 60 Hz with an accumulator; render transforms are interpolated between the last two physics states (no jitter at any display refresh rate).

**Ground detection:** a downward **shape-cast** of a slightly smaller sphere (radius 0.34) from the ball center, max distance `ballRadius + 0.15`, filtered to TERRAIN — a single center ray fails on ledge edges; the shape-cast doesn't. Grounded refreshes coyote timer and double jump.

**Feel acceptance tests (manual, Phase 2):** tap-jump apex visibly lower than held-jump apex; rolling off a ledge then jumping within ~100 ms still jumps; pressing jump ~100 ms early jumps on the landing frame; double jump resets only on ground contact (and bouncers); rotating the camera mid-run smoothly re-maps controls without a velocity hiccup; the ball never jitters against walls while holding into them.

### 1.4 Camera (first-class system — `CameraRig`)

Third-person chase camera orbiting the ball. Yaw controlled by the player (§1.2); pitch fixed at −24°; distance 8 u (zoom-clamped 6–12); FOV 55.

- **Follow:** damped position lerp (0.10) toward the orbit target; look-ahead up to 1.2 u along horizontal velocity.
- **Occlusion:** each frame, sphere-cast from the ball toward the camera (excluding sensors); if blocked, pull the camera in to the hit point (springs back smoothly when clear).
- **Pulses:** subtle zoom 1.0 → 1.03 → 1.0 over 300 ms on death and portal entry. All shake/pulses respect `reduceMotion`.
- The rig exposes `getYaw()` — the single source for camera-relative input math (forward = camera forward projected onto XZ, normalized).

### 1.5 Depth-perception aids (non-negotiable in 3D)

- **Blob shadow:** every frame, raycast down from the ball; render a soft dark circle (fading and shrinking with height, gone past 6 u) on the hit surface. This is how players judge landings — it ships in Phase 2 with the graybox, not as polish. Same treatment (smaller) under shards.
- **Surface read:** platform tops carry a subtle procedural grid/checker tint (canvas texture) for motion and scale reference.
- **Fog:** exponential fog toward `bg1` for depth cueing; the kill-void below fades to black.

### 1.6 Entities

**Shard (pickup).** Floating amber crystal (octahedron), emissive, idle bob + slow spin + glow pulse. Sensor collider. On collect: pop + expanding ring (camera-facing) + spark burst + rising two-note chime (pitch steps up per shard in the level) + HUD counter punch.

**Portal (goal).** A standing stone gate with a torus ring. _Dormant:_ dim, slow particle drift. _Active_ (all shards): bright cyan emissive, fast inward particle spiral, soft hum; activation plays a 120 ms level-wide flash. Rolling through while active → level complete.

**Hazards** (kill on touch; every lethal silhouette is serrated/sharp — danger must read by shape, never color alone):

| Type                            | Behavior spec                                                                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spikes`                        | Static sensor strip of pyramid teeth on a surface, faces `up/down/±x/±z`, sized in grid units.                                                                                                                                          |
| `blade`                         | Spinning disc (visual ~1.5 rev/s), thin cylinder sensor. Optional 3D waypoint `path` + `speed` (moves like a platform but kills).                                                                                                       |
| `platform` (helper, not lethal) | **Kinematic position-based** body moved with `setNextKinematicTranslation` along waypoints (`loop`/`pingpong`, `speed` u/s) — Rapier then imparts velocity/friction so it carries the player natively. Verify carry on a fast pingpong. |
| `crumble`                       | Static platform; on player contact: shake 0.35 s → collider disabled + mesh fades/falls → respawns after 2.5 s.                                                                                                                         |
| `bouncer` (helper)              | Pad that sets vy to `jumpVelocity × 1.35` and **refreshes the double jump**; squash animation + springy SFX.                                                                                                                            |

Hazard params are a Zod discriminated union in the level schema (§4.5).

### 1.7 Death & flow

On death: input frozen → 60 ms hit-stop (physics paused) → soot burst (16–20 particles) + 150 ms camera shake → 250 ms fade → level reloads. Death-to-control-restored ≤ 800 ms. Falling below the level's `killY` = death.

### 1.8 Screens & HUD

`Boot → Menu → LevelSelect → Game (+ HUD overlay) → Pause / LevelComplete overlays`. HUD and menus are DOM overlays (HTML/CSS) — crisper text, cheaper than in-scene UI; styled to the palette.

- **Menu:** glowing title treatment (CSS + canvas), Play, Settings (volume, mute, reduce motion, camera sensitivity), version.
- **LevelSelect:** 4 worlds × 5 levels grid; locked/unlocked; per-level best time + deaths; world accent colors.
- **HUD:** shards `n/N` (top-left, punches on collect), timer (top-center), deaths (top-right), pause (touch).
- **LevelComplete:** time, deaths, best (highlight new records), Next / Replay / Levels.
- All user-facing strings in `src/ui/strings.ts` (i18n-ready).

### 1.9 Save data

`localStorage` key `shardling:v1`, Zod-validated, versioned with migration. `{ version, settings: { volume, muted, reduceMotion, camSensitivity }, levels: { [id]: { completed, bestTimeMs, deaths } } }`. Corrupt/missing → fresh default, never a crash.

### 1.10 Content plan (20 levels, 4 worlds × 5)

Every mechanic gets one safe teaching level before appearing in combinations:

- **World 1 — Emberfall (movement):** L1 roll+jump, L2 gaps & momentum (first ramps), L3 double jump, L4 spikes, L5 exam.
- **World 2 — The Gears (movers):** L6 moving platforms, L7 crumble, L8 blades, L9 blade+platform combos, L10 exam.
- **World 3 — Updraft (verticality):** L11 bouncers, L12 vertical towers, L13 pathing blades, L14 precision chains, L15 exam.
- **World 4 — The Hollow Heart (mastery):** L16–L19 remix everything, L20 finale.

**3D level-design rules:** platform top surfaces ≥ 1.5 u wide in worlds 1–2 (≥ 1.0 u later); minimum traversal gap 2 u; every landing target visible from its takeoff point at default camera; first shard un-missable; no hazard can kill the player before it has been seen; each level JSON includes an `intendedPath` note. Ship 8 levels in Phase 4, all 20 by Phase 7.

---

## 2. Art Direction — "Glow in the Dark Ruins" (3D)

Minimal geometric shapes, dark atmosphere, luminous accents. Everything softly rounded except danger, which is sharp. The look is carried by emissive materials + bloom + fog, not by asset detail.

### 2.1 Palette (single source: `src/config/palette.ts`)

| Token          | Hex                                     | Use                                                  |
| -------------- | --------------------------------------- | ---------------------------------------------------- |
| `bg0` / `bg1`  | `#0E0F1A` / `#171A2B`                   | clear color / fog color (vertical gradient sky dome) |
| `terrain`      | `#23263A`                               | platform stone                                       |
| `terrainTop`   | `#2C3049`                               | top faces (subtle procedural grid tint)              |
| `player`       | `#14151F`                               | shardling body (matte, near-black)                   |
| `eye`          | `#7DF0FF`                               | eye emissive + player accents                        |
| `shard`        | `#FFC24B`                               | shards (warm amber = reward)                         |
| `hazard`       | `#FF4E6A`                               | all lethal things (hot coral = danger)               |
| `portal`       | `#46E0D4`                               | portal, success states                               |
| `worldAccents` | `#FFC24B` `#9B8CFF` `#5EE6A8` `#FF7A9E` | per-world rim/decor/UI tint                          |

### 2.2 Geometry & materials (all code)

`MeshFactory` builds everything from primitives: platforms = RoundedBoxGeometry (0.12 edge radius); ramps = rotated rounded boxes; spikes = merged pyramid teeth; blades = flat cylinder + notched edge; shards = octahedron; portal = torus + two pillars; player = sphere + child eye (flattened emissive sphere). `MaterialFactory` owns all materials: MeshStandardMaterial, low metalness, moderate roughness; emissive channels drive the glow (shard/portal/eye/hazard edges). Small canvas-generated textures only (grid tint, soft-circle sprite, radial ring). **Static level geometry is merged per material** (BufferGeometryUtils) → 1–3 draw calls for terrain; shards/spike teeth/motes use InstancedMesh or Points.

### 2.3 Lighting & post

One hemisphere light + one directional (no shadow maps on the mobile tier — blob shadows do that job; optional soft shadow map on high tier only). Postprocessing via `postprocessing`: selective **Bloom** (emissive-driven, half-resolution on mobile) + Vignette; SMAA on desktop tier, none on low tier. Sky = inverted gradient sphere; ~40 drifting dust motes (instanced) around the play space.

### 2.4 Animation standards

Physics animates the roll. Everything else eases — default `cubicOut`, springs `backOut`.

| Animation     | Spec                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| Idle          | body scale breathes ±1.5% (2.2 s); eye blinks every 3–5 s (110 ms scaleY)           |
| Eye           | child of a non-rotating wrapper; yaws toward velocity, lerped; never inherits roll  |
| Jump          | stretch to (0.88, 1.14, 0.88) for 90 ms on the **visual wrapper only**              |
| Land          | squash (1.14, 0.85, 1.14) 90 ms + dust puff (4–6 particles) + thud scaled by impact |
| Shard         | bob ±0.1 u (1.6 s sine) + spin + emissive pulse                                     |
| Collect       | scale 1→1.4→0 + camera-facing ring + 8 sparks                                       |
| Portal active | ring spin 0.4→1.6 rev/s + inward particle spiral                                    |
| Death         | 60 ms hit-stop → soot burst → shake → fade                                          |
| Transitions   | 220 ms fade-through-black; HUD elements slide 12 px                                 |

**Rule:** squash/stretch and all visual effects live on a wrapper `Object3D`; the physics body and collider are never scaled.

### 2.5 Accessibility

`reduceMotion` disables shake, hit-stop, and mote drift. Hazards shape-coded (§1.6). Touch targets ≥ 64 px. HUD text contrast ≥ 4.5:1 on `bg0`. Camera sensitivity setting.

---

## 3. Audio Direction (synthesized)

`AudioSynth` wraps one `AudioContext` (created on first user gesture) with a master gain; volume + mute persist. No audio files. Patches (tune by ear): jump (square 220→440 Hz, 90 ms) · doubleJump (330→660, 80 ms) · land (noise burst + 90 Hz thud, 70 ms, gain scales with impact) · collect (two-note pentatonic triangle chime, base pitch rises per shard) · death (saw 300→60 Hz + noise, 350 ms) · portalActive (detuned triad shimmer, 600 ms) · portalEnter (filtered-noise rise, 400 ms) · bounce (sine bend 150→500 Hz, 120 ms) · uiClick (8 ms tick) · rolling (looped filtered noise, gain/pitch mapped to ground speed, silent in air). Randomize ±3% pitch per play. Optional Phase 5: a 4-bar synthesized ambient pad at −18 dB.

---

## 4. Architecture

### 4.1 Repository layout

```
shardling/
├─ CLAUDE.md · BUILD_PROMPT.md · index.html
├─ package.json / tsconfig.json / vite.config.ts / eslint / prettier
├─ src/
│  ├─ main.ts                  # bootstrap: init Rapier (await), create App
│  ├─ config/  gameConfig.ts · tuning.ts · palette.ts
│  ├─ core/
│  │  ├─ App.ts                # renderer, composer, resize/DPR, scene stack
│  │  ├─ GameLoop.ts           # fixed 60 Hz physics accumulator + interpolation
│  │  ├─ EventBus.ts           # typed emitter
│  │  ├─ SaveManager.ts        # zod-validated localStorage + migrations
│  │  ├─ AudioSynth.ts · InputManager.ts · Device.ts   # tiering: lo/mid/hi
│  ├─ gfx/
│  │  ├─ MeshFactory.ts · MaterialFactory.ts            # ALL geometry & materials
│  │  ├─ ParticleFactory.ts    # pooled Points/instanced systems
│  │  ├─ PostFX.ts             # bloom + vignette (+SMAA hi tier)
│  │  └─ BlobShadow.ts         # raycast ground shadow
│  ├─ screens/                 # DOM overlays: Menu · LevelSelect · Hud · Pause · LevelComplete
│  ├─ game/
│  │  ├─ GameScreen.ts         # thin orchestrator: build level, wire systems
│  │  ├─ CameraRig.ts          # follow, orbit, occlusion, pulses
│  │  ├─ LevelRunner.ts        # timer, shard count, win/lose
│  │  └─ physics/ world.ts · groups.ts (collision bitmasks) · queries.ts (shapecasts)
│  ├─ entities/
│  │  ├─ player/ Player.ts · PlayerStateMachine.ts · PlayerVisuals.ts
│  │  ├─ hazards/ Spikes.ts · Blade.ts · MovingPlatform.ts · Crumble.ts · Bouncer.ts
│  │  ├─ Shard.ts · Portal.ts · EntityFactory.ts
│  ├─ levels/ schema.ts · loader.ts · registry.ts · data/level-01.json … level-20.json
│  ├─ sdk/ PortalSdk.ts (interface + NullSdk) · crazyGamesSdk.ts (Phase 8)
│  └─ ui/ strings.ts · dom helpers
├─ scripts/ validateLevels.ts
└─ tests/  (Vitest: schema, save, state machine, input math, registry)
```

### 4.2 Module rules

- `GameScreen` orchestrates; gameplay logic lives in systems/entities. Cross-module communication is the typed `EventBus` or direct parent→child calls only.
- **Physics/visual separation:** every entity owns `{ body/collider, visual wrapper }`; visuals interpolate toward physics state; effects touch wrappers only.
- Every entity implements `destroy()`: remove bodies/colliders from the Rapier world, **dispose geometries/materials it uniquely owns**, kill tweens/listeners. Level unload leaves zero leaks — verify with `?debug=1` counters (rapier bodies, three geometries) across 20 restarts.
- No magic numbers/colors outside `tuning.ts` / `palette.ts`.

### 4.3 Typed events

`level:loaded {id}` · `shard:collected {index,total}` · `shards:complete` · `player:died {cause}` · `player:landed {impact}` · `player:jumped {double}` · `level:complete {timeMs,deaths}` · `game:paused/resumed` · `settings:changed`.

### 4.4 Collision groups (Rapier interaction groups)

| Group   | Bit    | Interacts with                   |
| ------- | ------ | -------------------------------- |
| PLAYER  | 0x0001 | TERRAIN, HAZARD, PICKUP, TRIGGER |
| TERRAIN | 0x0002 | PLAYER                           |
| HAZARD  | 0x0004 | PLAYER (sensor)                  |
| PICKUP  | 0x0008 | PLAYER (sensor)                  |
| TRIGGER | 0x0010 | PLAYER (sensor: portal, bouncer) |

Camera-occlusion and ground shape-casts filter to TERRAIN only.

### 4.5 Level schema (authoring format)

Grid unit = 1 m. Coordinates `{x, y, z}`, **y-up**. Boxes are defined by min-corner + size for author sanity. Zod-validated at load (dev) and by `npm run validate:levels` (CI). Sanity checks: unique id · everything inside `bounds` AABB · spawn has terrain ≤ 3 u beneath it · portal within 0.5 u of a terrain top · ≥ 1 shard · no hazard AABB within 2 u of spawn · `killY` below lowest terrain.

```jsonc
{
  "id": "level-01",
  "name": "First Light",
  "world": 1,
  "bounds": { "x": 0, "y": -10, "z": -10, "w": 60, "h": 30, "d": 20 },
  "killY": -8,
  "spawn": { "x": 4, "y": 1.5, "z": 0 },
  "portal": { "x": 55, "y": 1, "z": 0, "rotY": 90 },
  "shards": [
    { "x": 14, "y": 2, "z": 0 },
    { "x": 28, "y": 5, "z": 2 },
    { "x": 42, "y": 2, "z": -2 },
  ],
  "terrain": [
    { "type": "box", "x": 0, "y": 0, "z": -3, "w": 20, "h": 1, "d": 6 },
    { "type": "box", "x": 24, "y": 3, "z": 0, "w": 6, "h": 1, "d": 4 },
    {
      "type": "ramp",
      "x": 20,
      "y": 0,
      "z": -1,
      "w": 4,
      "h": 3,
      "d": 3,
      "dir": "+x",
    },
    { "type": "box", "x": 34, "y": 0, "z": -4, "w": 26, "h": 1, "d": 8 },
  ],
  "hazards": [],
  "intendedPath": "Roll right, take the ramp for speed, jump to the high ledge for shard 2, drop, continue to the gate.",
  "hints": ["move", "camera", "jump"],
}
```

Hazard union examples:

```jsonc
{ "type": "spikes",  "x": 36, "y": 1, "z": -2, "w": 4, "d": 2, "face": "up" }
{ "type": "blade",   "x": 44, "y": 2, "z": 0, "r": 1.2,
  "path": [ { "x": 44, "y": 2, "z": -3 }, { "x": 44, "y": 2, "z": 3 } ], "speed": 3 }
{ "type": "platform","x": 20, "y": 3, "z": 0, "w": 3, "d": 3,
  "path": [ { "x": 20, "y": 3, "z": 0 }, { "x": 30, "y": 6, "z": 0 } ], "speed": 2.5, "mode": "pingpong" }
{ "type": "crumble", "x": 33, "y": 5, "z": 0, "w": 3, "d": 3 }
{ "type": "bouncer", "x": 12, "y": 1, "z": 0 }
```

Second anchor level — `level-06` (teaches moving platforms): two islands (x0–14 and x46–60) over the void, one `platform` ferrying x16→x44 at y3 (speed 2.5, pingpong), shards at {10, 2, 0}, {30, 6, 0} (requires jumping from the mover at its apex), {50, 2, 2}; portal at {57, 1, 0}; a `spikes` patch (4×2, up) on the far island landing to keep the arrival honest.

### 4.6 Player state machine (pure TS, unit-tested, no Three/Rapier imports)

States: `Grounded → Airborne(jumpsLeft=1) → DoubleJumped(jumpsLeft=0) → Dead`. Inputs: input snapshot + grounded flag + clock; owns coyote/buffer timers and jump-cut logic; emits intents (`jump`, `cut`) that `Player` applies to the body. `PlayerVisuals` maps states/events to wrapper animations.

### 4.7 Camera-relative input math (unit-tested)

`forward = normalize(project(camera.forward, XZ))`, `right = forward × up`; `moveVec = normalize(inputX·right + inputY·forward)`. Test yaw 0/90/180/270° mappings and the degenerate straight-down case.

### 4.8 Portal SDK abstraction

```ts
interface PortalSdk {
  init(): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  celebrate(): void;
  midgameAd(): Promise<void>; // between levels, every 3rd completion
  rewardedAd(): Promise<boolean>; // reserved
  cloudSave(d: string): Promise<void>;
  cloudLoad(): Promise<string | null>;
}
```

`NullSdk` (no-ops) is the default everywhere. Phase 8 adds a CrazyGames-SDK implementation selected only on that portal's domains; local/dev always gets `NullSdk`.

---

## 5. Engineering Standards

### 5.1 TypeScript & lint

`strict: true`, `noUncheckedIndexedAccess: true`, no `any`, no non-null assertions outside tests. ESLint typescript-eslint recommended-type-checked, `no-floating-promises`, import ordering. Prettier defaults. Named exports only.

### 5.2 Tests (Vitest — pure logic, no Three/Rapier in unit tests)

Required: level schema (valid fixtures pass; each invariant violation fails) · **all shipped level JSONs parse + pass sanity checks** · SaveManager (roundtrip, corruption recovery, migration) · PlayerStateMachine (coyote, buffer, double-jump reset, jump-cut) · camera-relative input math (§4.7) · registry ordering/unlock.

### 5.3 Scripts

`dev` · `build` · `preview` · `typecheck` · `lint` · `test` · `validate:levels` · `check` (= typecheck + lint + test + validate:levels). `check` must pass before any phase is done. After `build`, print gzip sizes (JS and WASM separately) and fail if the total exceeds 4 MB.

### 5.4 Debug mode

`?debug=1` enables: Rapier debug-render lines, FPS + draw-call + body/geometry counters, player state label, free-fly camera toggle (`F`), and a lil-gui panel (dynamic import) live-bound to `tuning.ts` (movement, jump, camera) with a "copy as code" button. This panel is how feel gets tuned — build it well in Phase 2. `?nojuice=1` disables juice for A/B comparison.

### 5.5 Git

Conventional commits (`feat:`, `fix:`, `chore:`, `content: level-07 …`). Small, single-purpose commits. Never commit with a failing `check`.

### 5.6 Do-not list

No external CDNs/fonts/models/textures at runtime · no glTF or binary assets in the repo · no position/velocity spam to fake physics (forces + the documented jump/cut/bounce velocity writes only) · never scale physics bodies (visual wrappers only) · no gameplay logic in screens · no timers/listeners surviving screen teardown · no new dependencies without approval · **never reference or borrow from existing games in code, comments, docs, or level names.**

---

## 6. Delivery Phases

Each phase = tasks → acceptance criteria → `npm run check` green → commit → update `CLAUDE.md` Phase Log → summarize → **STOP**.

**Phase 0 — Scaffold.** Vite + TS project; deps installed (`three`, `@dimforge/rapier3d-compat`, `postprocessing`, `zod`; dev: `vitest`, `lil-gui`, lint stack); folder tree from §4.1; scripts wired (`validate:levels` runs with zero levels); `await RAPIER.init()` boot; hello-world: lit spinning rounded box + a Rapier ball dropping onto a floor, fixed-timestep loop with interpolation already in place.
_AC:_ `npm run dev` shows the physics hello-world at 60 fps; `check` green; README quickstart written; bundle-size report prints.

**Phase 1 — Foundations.** `MaterialFactory` + `palette.ts`; `MeshFactory` (platform, ramp, shard, spike tooth, blade, portal, player+eye, particle sprites); `EventBus`; `SaveManager` (+tests); `AudioSynth` (jump/collect/uiClick first); `InputManager` incl. camera-relative math (+tests); `Device` tiering (lo/mid/hi → DPR cap, bloom res, SMAA on/off); DOM Menu + Settings working.
_AC:_ menu navigable by keyboard and touch; volume/mute/reduceMotion persist; a showcase scene renders every factory mesh with bloom, ≥ 60 fps.

**Phase 2 — The Sacred Phase: ball feel + camera.** Hardcoded graybox level (floors, a ramp, ledges, a wall to test occlusion). Ball body (CCD on), force movement with clamps, shape-cast grounding, jump/coyote/buffer/cut/double-jump, `CameraRig` (orbit, damped follow, look-ahead, occlusion), **blob shadow**, squash/stretch + dust + eye tracking/blink, rolling SFX, full debug panel (§5.4). `PlayerStateMachine` extracted + unit-tested.
_AC:_ every feel test in §1.3 passes; camera never clips through walls in the graybox; blob shadow tracks correctly over ledges; state label always correct; 20 restarts → stable body/geometry counts.

**Phase 3 — Level pipeline.** Zod schema + loader + registry + validator; `EntityFactory`; static terrain **merged per material**; Shard, Portal, Spikes; `LevelRunner`; death flow (§1.7); HUD; LevelComplete overlay; progress saved. Author `level-01` (§4.5 anchor).
_AC:_ full loop menu → level-01 → collect 3 → gate → results → menu; death respawn < 800 ms; refresh restores progress; terrain draw calls ≤ 3.

**Phase 4 — Hazard roster + Worlds 1–2.** Blade (static + pathed), MovingPlatform (kinematic; verify native carry on a fast pingpong), Crumble, Bouncer, ramps everywhere they help momentum. Author levels 01–08 per §1.10. LevelSelect screen (worlds, locks, best times).
_AC:_ `validate:levels` green for 8 levels; each hand-verified completable with `intendedPath` written; riding a fast platform never drops or jitters the ball; camera stays usable in every level's tightest spot.

**Phase 5 — Juice & audio.** Full animation table (§2.4), bloom/vignette tuned per tier, portal activation moment, particle systems pooled (≤ 400 live), remaining SFX + optional ambient pad, hit-stop, shake, transitions, results polish, `reduceMotion` respected everywhere.
_AC:_ `?nojuice=1` A/B shows a dramatic difference; no frame-time spikes from particles or collects.

**Phase 6 — Mobile & performance.** Virtual joystick + camera-drag + jump button (§1.2); resize/DPR handling with the composer; orientation hint; prevent browser scroll/zoom gestures on the canvas (Space/Arrows preventDefault, `touch-action: none`); pooling + allocation audit (zero per-frame allocations in hot paths); tier verification.
_AC:_ fully playable with two thumbs on a phone; 4× CPU throttle holds ~60 fps in the busiest level; draw calls ≤ 100 everywhere.

**Phase 7 — Full content.** Levels 09–20 per §1.10 with a difficulty review pass; settings final (incl. camera sensitivity); credits line; favicon + meta tags (generated art).
_AC:_ all 20 validate + hand-verified; a fresh save reaches the finale; per-level expected-death curve rises smoothly.

**Phase 8 — Portal readiness.** `crazyGamesSdk.ts` behind domain detection with `NullSdk` fallback; `gameplayStart/Stop` wired to level enter/pause/complete; midgame ad hook every 3rd completion (no-op locally); cloud save mirrored (localStorage is source of truth on conflict); final size audit; `dist/` zip; DEPLOY.md with submission checklist.
_AC:_ identical behavior under `NullSdk`; SDK verified no-op locally; payload ≤ limits.

---

## 7. Kickoff

Begin now with **Phase 0**. Before writing code, reply with: (1) your understanding of the architecture in ≤ 10 lines, (2) any spec ambiguities you want resolved, (3) the Phase 0 task list. Then execute Phase 0.
