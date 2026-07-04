import RAPIER from "@dimforge/rapier3d-compat";

import { App } from "./core/App";
import { AudioSynth } from "./core/AudioSynth";
import type { DeviceProfile } from "./core/Device";
import { detectDevice } from "./core/Device";
import { EventBus } from "./core/EventBus";
import type { LoopHooks } from "./core/GameLoop";
import { GameLoop } from "./core/GameLoop";
import { InputManager } from "./core/InputManager";
import type { Settings } from "./core/SaveManager";
import { SaveManager } from "./core/SaveManager";
import { DebugTools } from "./debug/DebugTools";
import { isDebugEnabled } from "./debug/flags";
import type { GameScreenMode } from "./game/GameScreen";
import { GameScreen } from "./game/GameScreen";
import type { LevelResult } from "./game/LevelRunner";
import type { ShowcaseScene } from "./game/showcase";
import { buildShowcase } from "./game/showcase";
import { MaterialFactory } from "./gfx/MaterialFactory";
import type { LevelEntry } from "./levels/registry";
import { levelById, nextLevelId } from "./levels/registry";
import { FadeVeil } from "./screens/FadeVeil";
import { Hud } from "./screens/Hud";
import { LevelCompleteScreen } from "./screens/LevelCompleteScreen";
import { LevelSelectScreen } from "./screens/LevelSelectScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { PauseScreen } from "./screens/PauseScreen";
import { ScreenManager } from "./screens/ScreenManager";
import { SettingsScreen } from "./screens/SettingsScreen";
import { selectPortalSdk } from "./sdk/crazyGamesSdk";
import { PortalBridge } from "./sdk/PortalBridge";
import type { PortalSdk } from "./sdk/PortalSdk";
import { installFavicon } from "./ui/logo";
import { OrientationHint } from "./ui/OrientationHint";
import { TouchControls } from "./ui/TouchControls";

declare global {
  interface Window {
    __shardling?: {
      app: App;
      loop: GameLoop;
      profile: DeviceProfile;
      save: SaveManager;
      bus: EventBus;
      audio: AudioSynth;
      input: InputManager;
      touchControls: TouchControls;
      sdk: PortalSdk;
      portal: PortalBridge;
      screens: ScreenManager;
      materials: MaterialFactory;
      getSession: () => GameScreen | null;
      getShowcase: () => ShowcaseScene | null;
    };
  }
}

installFavicon();

await RAPIER.init();

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container element");
}
const uiRoot: HTMLElement = container;

const profile = detectDevice();
const app = new App(container, profile);
const save = new SaveManager();
const bus = new EventBus();

const sdk = await selectPortalSdk();
const portal = new PortalBridge({ sdk, bus, save });
await portal.restoreCloudSave(save);

let cachedSettings: Settings = save.getSettings();
bus.on("settings:changed", ({ settings }) => {
  cachedSettings = settings;
});

const audio = new AudioSynth();
const applyAudioSettings = (settings: Settings): void => {
  audio.setVolume(settings.volume);
  audio.setMuted(settings.muted);
};
applyAudioSettings(save.getSettings());
bus.on("settings:changed", ({ settings }) => {
  applyAudioSettings(settings);
});
bus.on("ui:click", () => {
  audio.play("uiClick");
});
bus.on("player:jumped", ({ double }) => {
  audio.play(double ? "doubleJump" : "jump");
});
bus.on("player:landed", ({ impact }) => {
  audio.play("land", { intensity: impact });
});
bus.on("player:bounced", () => {
  audio.play("bounce");
});
let collectOrder = 0;
bus.on("level:loaded", () => {
  collectOrder = 0;
});
bus.on("player:died", () => {
  collectOrder = 0;
});
bus.on("shard:collected", () => {
  audio.play("collect", { step: collectOrder });
  collectOrder += 1;
});
bus.on("player:died", () => {
  audio.play("death");
});

bus.on("shards:complete", () => {
  audio.play("portalActive");
});
bus.on("level:complete", (result) => {
  audio.play("portalEnter");
  onLevelComplete(result);
});
const unlockAudio = (): void => {
  audio.unlock();
};
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

const materials = new MaterialFactory();
const veil = new FadeVeil({
  root: container,
  reduceMotion: () => cachedSettings.reduceMotion,
});

let session: GameScreen | null = null;
let sessionEntry: LevelEntry | null = null;
let hud: Hud | null = null;
let showcase: ShowcaseScene | null = null;
let active: LoopHooks;

const input = new InputManager({
  target: app.renderer.domElement,
  getYaw: () => session?.cameraYaw ?? 0,
  getSensitivity: () => cachedSettings.camSensitivity,
});

const touchControls = new TouchControls({ root: uiRoot, input });
input.attachTouchSource(touchControls);
const orientationHint = new OrientationHint({
  root: uiRoot,
  reduceMotion: () => cachedSettings.reduceMotion,
});
bus.on("settings:changed", () => {
  orientationHint.refresh();
});

const debugTools = isDebugEnabled()
  ? DebugTools.create({
      app,
      getWorld: () => session?.world ?? null,
      getStatus: () =>
        session
          ? {
              state: session.playerStateName,
              bodies: session.world.bodies.len(),
            }
          : null,
    })
  : null;

function startShowcase(): void {
  showcase ??= buildShowcase(app, materials, {
    reduceMotion: () => cachedSettings.reduceMotion,
  });
  active = showcase;
}

function startSession(entry: LevelEntry | null): void {
  if (session) {
    return;
  }
  showcase?.dispose();
  showcase = null;

  const grayboxRequested =
    new URLSearchParams(window.location.search).get("graybox") === "1";
  const mode: GameScreenMode =
    grayboxRequested || entry === null
      ? { kind: "graybox" }
      : { kind: "level", data: entry.data };

  sessionEntry = mode.kind === "level" && entry ? entry : null;
  session = new GameScreen({
    app,
    materials,
    bus,
    audio,
    input,
    save,
    mode,
    isCameraExternal: () => debugTools?.freeFlyActive ?? false,
    deathVisual: () => veil.deathFade(),
  });
  active = session;

  if (sessionEntry) {
    const runner = session.runner;
    hud = new Hud({
      bus,
      getTimeMs: () => runner?.timeMs ?? 0,
      getDeaths: () => runner?.deaths ?? 0,
      shardTotal: sessionEntry.data.shards.length,
      reduceMotion: () => save.getSettings().reduceMotion,
      onPause: pauseGame,
      root: uiRoot,
    });
  }
  touchControls.show();
}

function endSession(): void {
  if (!session) {
    return;
  }
  touchControls.hide();
  hud?.destroy();
  hud = null;
  session.destroy();
  session = null;
  sessionEntry = null;
  startShowcase();
}

function pauseGame(): void {
  if (
    !session ||
    session.paused ||
    session.dying ||
    screens.busy ||
    screens.current !== null
  ) {
    return;
  }
  session.setPaused(true);
  void screens.show(
    new PauseScreen({
      bus,
      onResume: resumeGame,
      onRestart: () => {
        if (!session) {
          return;
        }
        void screens.show(null).then(() => {
          session?.restartLevel();
          session?.setPaused(false);
        });
      },
      onQuit: () => {
        endSession();
        showMenu();
      },
    }),
  );
}

function resumeGame(): void {
  if (!session) {
    return;
  }
  void screens.show(null).then(() => {
    session?.setPaused(false);
  });
}

function onLevelComplete(result: LevelResult): void {
  const entry = sessionEntry;
  if (!entry) {
    return;
  }
  const { newBest } = save.recordLevelCompletion(entry.id, result);
  const record = save.getLevel(entry.id);
  const nextId = nextLevelId(entry.id);
  let resultsActionFired = false;
  const once = (action: () => void) => (): void => {
    if (resultsActionFired) {
      return;
    }
    resultsActionFired = true;
    action();
  };
  void screens.show(
    new LevelCompleteScreen({
      bus,
      result: {
        timeMs: result.timeMs,
        deaths: result.deaths,
        bestTimeMs: record?.bestTimeMs ?? null,
        newBest,
        hasNext: nextId !== null,
      },
      onNext: once(() => {
        const next = nextId ? (levelById(nextId) ?? null) : null;
        endSession();
        void screens.show(null);
        void portal
          .adBetweenLevels()
          .catch(() => undefined)
          .then(() => {
            startSession(next);
          });
      }),
      onReplay: once(() => {
        endSession();
        startSession(entry);
        void screens.show(null);
      }),
      onMenu: once(() => {
        endSession();
        showLevelSelect();
      }),
    }),
  );
}

const loop = new GameLoop({
  step: (dt) => {
    active.step(dt);
  },
  render: (alpha, frameDt) => {
    active.render(alpha, frameDt);
    debugTools?.update(frameDt);
  },
});
startShowcase();
loop.start();

const screens = new ScreenManager(container, {
  reduceMotion: () => save.getSettings().reduceMotion,
});

function showMenu(): void {
  void screens.show(
    new MenuScreen({
      version: __APP_VERSION__,
      bus,
      onPlay: () => {
        showLevelSelect();
      },
      onSettings: () => {
        showSettings();
      },
    }),
  );
}

function showLevelSelect(): void {
  void screens.show(
    new LevelSelectScreen({
      save,
      bus,
      onPlay: (entry) => {
        startSession(entry);
        void screens.show(null);
      },
      onBack: () => {
        if (session) {
          return;
        }
        showMenu();
      },
    }),
  );
}

function showSettings(): void {
  void screens.show(
    new SettingsScreen({
      save,
      bus,
      onBack: () => {
        showMenu();
      },
    }),
  );
}

window.addEventListener("keydown", (event) => {
  if (screens.current !== null || screens.busy) {
    return;
  }
  const key = event.key;
  if (key === "Escape" || key === "p" || key === "P") {
    if (session) {
      pauseGame();
    } else {
      showMenu();
    }
  }
});

showMenu();

window.__shardling = {
  app,
  loop,
  profile,
  save,
  bus,
  audio,
  input,
  touchControls,
  sdk,
  portal,
  screens,
  materials,
  getSession: () => session,
  getShowcase: () => showcase,
};
