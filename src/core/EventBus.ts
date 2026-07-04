import type { Settings } from "./SaveManager";

export interface GameEvents {
  "level:loaded": { id: string };
  "shard:collected": { index: number; total: number };
  "shards:complete": void;
  "player:died": { cause: "hazard" | "fall" };
  "player:landed": { impact: number };
  "player:jumped": { double: boolean };
  "player:bounced": void;
  "level:complete": { timeMs: number; deaths: number };
  "game:paused": void;
  "game:resumed": void;
  "settings:changed": { settings: Settings };
  "ui:click": void;
}

export type GameEventName = keyof GameEvents;

type StoredHandler = (payload: never) => void;

export class EventBus {
  private readonly handlers = new Map<GameEventName, Set<StoredHandler>>();

  on<K extends GameEventName>(
    type: K,
    handler: (payload: GameEvents[K]) => void,
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => {
      this.off(type, handler);
    };
  }

  off<K extends GameEventName>(
    type: K,
    handler: (payload: GameEvents[K]) => void,
  ): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit<K extends GameEventName>(
    type: K,
    ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]
  ): void {
    const set = this.handlers.get(type);
    if (!set || set.size === 0) {
      return;
    }
    const payload = args[0];
    for (const handler of [...set]) {
      handler(payload as never);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
