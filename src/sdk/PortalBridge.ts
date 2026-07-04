import type { EventBus } from "../core/EventBus";
import type { SaveManager } from "../core/SaveManager";
import type { PortalSdk } from "./PortalSdk";

const AD_EVERY_N_COMPLETIONS = 3;

export interface PortalBridgeOptions {
  sdk: PortalSdk;
  bus: EventBus;
  save: SaveManager;
}

export class PortalBridge {
  private readonly sdk: PortalSdk;
  private readonly save: SaveManager;
  private readonly unsubscribes: (() => void)[] = [];

  private inGameplay = false;
  private completions = 0;
  private destroyed = false;

  constructor(opts: PortalBridgeOptions) {
    this.sdk = opts.sdk;
    this.save = opts.save;
    const { bus, save } = opts;

    save.setCloudMirror((blob) => {
      void this.sdk.cloudSave(blob);
    });

    this.unsubscribes.push(
      bus.on("level:loaded", () => {
        this.enterGameplay();
      }),
      bus.on("game:resumed", () => {
        this.enterGameplay();
      }),
      bus.on("game:paused", () => {
        this.exitGameplay();
      }),
      bus.on("level:complete", () => {
        this.completions += 1;
        this.sdk.celebrate();
        this.exitGameplay();
      }),
    );
  }

  async restoreCloudSave(save: SaveManager): Promise<boolean> {
    if (save.hasLocalSave()) {
      void this.sdk.cloudSave(save.serialize());
      return false;
    }
    let blob: string | null;
    try {
      blob = await this.sdk.cloudLoad();
    } catch {
      return false;
    }
    if (blob === null) {
      return false;
    }
    return save.adoptCloudBlob(blob);
  }

  async adBetweenLevels(): Promise<void> {
    if (
      this.completions === 0 ||
      this.completions % AD_EVERY_N_COMPLETIONS !== 0
    ) {
      return;
    }
    try {
      await this.sdk.midgameAd();
    } catch {}
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.exitGameplay();
    this.save.setCloudMirror(undefined);
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes.length = 0;
  }

  private enterGameplay(): void {
    if (this.inGameplay) {
      return;
    }
    this.inGameplay = true;
    this.sdk.gameplayStart();
  }

  private exitGameplay(): void {
    if (!this.inGameplay) {
      return;
    }
    this.inGameplay = false;
    this.sdk.gameplayStop();
  }
}
