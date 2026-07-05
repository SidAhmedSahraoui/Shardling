import { z } from "zod";

import { tuning } from "../config/tuning";

const SAVE_VERSION = 1;

export const SAVE_KEY = "shardling:v1";

const settingsSchema = z.object({
  volume: z.number(),
  muted: z.boolean(),
  reduceMotion: z.boolean(),
  camSensitivity: z.number(),
  language: z.string().default("en"),
});

const levelRecordSchema = z.object({
  completed: z.boolean(),
  bestTimeMs: z.number().nullable(),
  deaths: z.number().int().min(0),
});

const saveDataSchema = z.object({
  version: z.literal(SAVE_VERSION),
  settings: settingsSchema,
  levels: z.record(z.string(), levelRecordSchema),
});

export type Settings = z.infer<typeof settingsSchema>;

export type LevelRecord = z.infer<typeof levelRecordSchema>;

export type SaveData = z.infer<typeof saveDataSchema>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function createDefaults(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: {
      volume: tuning.defaultVolume,
      muted: false,
      reduceMotion: false,
      camSensitivity: tuning.defaultCamSensitivity,
      language: "en",
    },
    levels: {},
  };
}

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function resolveDefaultStorage(): StorageLike {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike })
      .localStorage;
    if (candidate) {
      return candidate;
    }
  } catch {}
  return createMemoryStorage();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const saveDataV0Schema = z.object({
  version: z.literal(0),
  settings: settingsSchema.omit({ camSensitivity: true }),
  levels: z.record(z.string(), levelRecordSchema),
});

type Migration = (data: unknown) => unknown;

const migrations: ReadonlyMap<number, Migration> = new Map<number, Migration>([
  [
    0,
    (data) => {
      const parsed = saveDataV0Schema.safeParse(data);
      if (!parsed.success) {
        return data;
      }
      return {
        version: 1,
        settings: {
          ...parsed.data.settings,
          camSensitivity: tuning.defaultCamSensitivity,
        },
        levels: parsed.data.levels,
      };
    },
  ],
]);

function readVersion(data: unknown): number | null {
  if (typeof data === "object" && data !== null && "version" in data) {
    const version: unknown = data.version;
    if (typeof version === "number" && Number.isInteger(version)) {
      return version;
    }
  }
  return null;
}

function migrateToCurrent(data: unknown): unknown {
  let current = data;
  let version = readVersion(current);
  while (version !== null && version < SAVE_VERSION) {
    const step = migrations.get(version);
    if (step === undefined) {
      return current;
    }
    current = step(current);
    const next = readVersion(current);
    if (next === null || next <= version) {
      return current;
    }
    version = next;
  }
  return current;
}

export class SaveManager {
  private readonly storage: StorageLike;
  private data: SaveData;
  private hadValidLocalSave = false;
  private cloudMirror: ((blob: string) => void) | undefined;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? resolveDefaultStorage();
    this.data = this.load();
  }

  hasLocalSave(): boolean {
    return this.hadValidLocalSave;
  }

  serialize(): string {
    return JSON.stringify(this.data);
  }

  setCloudMirror(mirror: ((blob: string) => void) | undefined): void {
    this.cloudMirror = mirror;
  }

  adoptCloudBlob(blob: string): boolean {
    const parsed = this.parseBlob(blob);
    if (parsed === null) {
      return false;
    }
    this.data = parsed;
    this.hadValidLocalSave = true;
    this.persist();
    return true;
  }

  getSettings(): Settings {
    return { ...this.data.settings };
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const next = { ...this.data.settings };
    if (patch.volume !== undefined && Number.isFinite(patch.volume)) {
      next.volume = clamp(patch.volume, 0, 1);
    }
    if (patch.muted !== undefined) {
      next.muted = patch.muted;
    }
    if (patch.reduceMotion !== undefined) {
      next.reduceMotion = patch.reduceMotion;
    }
    if (
      patch.camSensitivity !== undefined &&
      Number.isFinite(patch.camSensitivity)
    ) {
      next.camSensitivity = clamp(
        patch.camSensitivity,
        tuning.camSensitivityMin,
        tuning.camSensitivityMax,
      );
    }
    if (patch.language !== undefined) {
      next.language = patch.language;
    }
    this.data.settings = next;
    this.persist();
    return { ...next };
  }

  getLevel(id: string): LevelRecord | undefined {
    const record = this.data.levels[id];
    return record === undefined ? undefined : { ...record };
  }

  recordLevelCompletion(
    id: string,
    result: { timeMs: number; deaths: number },
  ): { newBest: boolean } {
    if (!Number.isFinite(result.timeMs) || !Number.isFinite(result.deaths)) {
      return { newBest: false };
    }
    const timeMs = Math.max(0, Math.round(result.timeMs));
    const deaths = Math.max(0, Math.round(result.deaths));
    const previous = this.data.levels[id];
    if (
      previous === undefined ||
      previous.bestTimeMs === null ||
      timeMs < previous.bestTimeMs
    ) {
      this.data.levels[id] = { completed: true, bestTimeMs: timeMs, deaths };
      this.persist();
      return { newBest: true };
    }
    this.data.levels[id] = { ...previous, completed: true };
    this.persist();
    return { newBest: false };
  }

  reset(): void {
    this.data = createDefaults();
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {}
  }

  private load(): SaveData {
    let raw: string | null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch {
      return createDefaults();
    }
    if (raw === null) {
      return createDefaults();
    }
    const parsed = this.parseBlob(raw);
    if (parsed === null) {
      return createDefaults();
    }
    this.hadValidLocalSave = true;
    return parsed;
  }

  private parseBlob(raw: string): SaveData | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    const result = saveDataSchema.safeParse(migrateToCurrent(parsed));
    if (!result.success) {
      return null;
    }
    const settings = result.data.settings;
    settings.volume = clamp(settings.volume, 0, 1);
    settings.camSensitivity = clamp(
      settings.camSensitivity,
      tuning.camSensitivityMin,
      tuning.camSensitivityMax,
    );
    return result.data;
  }

  private persist(): void {
    const blob = JSON.stringify(this.data);
    try {
      this.storage.setItem(SAVE_KEY, blob);
    } catch {}
    if (this.cloudMirror) {
      try {
        this.cloudMirror(blob);
      } catch {}
    }
  }
}
