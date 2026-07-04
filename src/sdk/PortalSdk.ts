export interface PortalSdk {
  init(): Promise<void>;

  gameplayStart(): void;

  gameplayStop(): void;

  celebrate(): void;

  midgameAd(): Promise<void>;

  rewardedAd(): Promise<boolean>;

  cloudSave(data: string): Promise<void>;

  cloudLoad(): Promise<string | null>;
}

export class NullSdk implements PortalSdk {
  init(): Promise<void> {
    return Promise.resolve();
  }

  gameplayStart(): void {}

  gameplayStop(): void {}

  celebrate(): void {}

  midgameAd(): Promise<void> {
    return Promise.resolve();
  }

  rewardedAd(): Promise<boolean> {
    return Promise.resolve(false);
  }

  cloudSave(): Promise<void> {
    return Promise.resolve();
  }

  cloudLoad(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
