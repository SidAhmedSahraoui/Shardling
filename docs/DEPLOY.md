# Deploying Shardling

Shardling is a fully static HTML5 build — one `index.html` plus a hashed
`assets/` folder, no server, no runtime dependencies, no external asset
fetches. It runs from any static host or portal by opening `index.html`.

## 1. Build & package

```bash
npm ci          # clean install (first time / CI)
npm run check   # typecheck + lint + tests + level validation — must be green
npm run package # build, size-audit, and produce shardling.zip
```

`npm run package` runs the production build (`vite build`), enforces the size
budgets (`scripts/reportBundleSize.ts`), then zips `dist/` into
**`shardling.zip`** with `index.html` at the archive root (the layout every
HTML5 portal expects).

### Size budgets (enforced by the build — it fails if exceeded)

| Metric                   | Budget  | Current  |
| ------------------------ | ------- | -------- |
| Initial JS + WASM (gzip) | ≤ 4 MB  | ~1.09 MB |
| Total `dist/`            | ≤ 15 MB | ~3.09 MB |
| `shardling.zip` (zipped) | —       | ~1.10 MB |

The Rapier physics WASM is inlined (base64) into the main JS by the
`rapier3d-compat` build, so there is no separate `.wasm` file to upload. The
`lil-gui` chunk in `dist/assets/` is a lazy import loaded **only** under
`?debug=1`; players never download it.

## 2. Portal SDK behaviour

The game selects its portal SDK at boot from the host domain
(`src/sdk/crazyGamesSdk.ts` → `selectPortalSdk`):

- **Any host except `*.crazygames.com`** (local, itch, self-hosted, other
  portals) → **`NullSdk`**: every SDK call is a no-op. This is the reference
  behaviour — the game is fully playable with no portal present.
- **`*.crazygames.com`** → the CrazyGames SDK v3 is injected at runtime and
  wired up. Every call is defensively guarded, so an SDK error still degrades
  to the `NullSdk` experience rather than breaking gameplay.

What the bridge (`src/sdk/PortalBridge.ts`) drives on the portal:

- `gameplayStart` / `gameplayStop` on level enter, pause, resume, and complete
  (transition-guarded — no doubled or orphaned calls).
- `celebrate` on each level clear.
- A **midgame ad every 3rd completion**, offered between levels (never mid-play).
- **Cloud save**: every local save is mirrored to the portal store; on a
  device with no local save, cloud progress is restored. **Local storage is
  the source of truth on conflict** — existing local progress is never
  overwritten by the cloud.

To smoke-test the portal path locally you can only confirm the _fallback_: on
`localhost` the SDK is `NullSdk`, verified by `window.__shardling.sdk`.

## 3. Host anywhere (generic static)

Upload the **contents** of `dist/` (or unzip `shardling.zip`) to any static
host — Netlify, GitHub Pages, S3/CloudFront, itch.io (HTML5 project), etc.
No build step runs on the host; serve the files as-is with `index.html` as the
entry point. Everything is same-origin and self-contained, so a strict CSP is
fine.

## 4. CrazyGames submission checklist

1. `npm run check` is green and `npm run package` succeeded.
2. Upload **`shardling.zip`** in the CrazyGames developer portal (HTML5, zip
   with `index.html` at the root).
3. Confirm in the portal preview:
   - The game boots to the menu and all four worlds are reachable.
   - `gameplayStart`/`gameplayStop` fire on level enter/pause/complete (portal
     analytics / ad timing).
   - A midgame ad appears roughly every 3rd level completion.
   - Progress persists across a reload (cloud save round-trips).
4. Provide store metadata: title **Shardling**, the description/tags from
   `index.html`'s meta tags, and a capture of gameplay for the thumbnail.
5. Controls to list: **WASD/Arrows** move, **Space** jump/double-jump,
   **Q/E or drag** rotate camera, **mouse wheel/pinch** zoom, **Esc/P** pause,
   **R** restart. On touch: on-screen joystick + jump button, drag to rotate.

## 5. Notes

- **Original IP.** All geometry, materials, and audio are generated in code;
  the repo contains no binary game assets. The only embedded binary is a
  base64 OFL-licensed font subset (`src/ui/fontData.ts`, notice retained).
- **Save key:** `shardling:v1` in `localStorage` (and the portal cloud store).
- **Offline:** the build has no network dependency; it runs offline once
  loaded (the CrazyGames SDK script is the only runtime fetch, and only on
  their domains).
