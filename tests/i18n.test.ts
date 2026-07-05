import { afterEach, describe, expect, it, vi } from "vitest";

import { levels } from "../src/levels/registry";
import {
  detectLocale,
  getLocale,
  isLocale,
  isRtl,
  localeLabels,
  LOCALES,
  setLocale,
} from "../src/ui/i18n";
import { ar } from "../src/ui/locales/ar";
import { fr } from "../src/ui/locales/fr";
import { en, strings } from "../src/ui/strings";

function shape(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  const out: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (prefix === "" && key === "levelNames") {
      continue;
    }
    out.push(...shape(child, prefix ? `${prefix}.${key}` : key));
  }
  return out.sort();
}

function leaves(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child) => leaves(child));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((child) =>
      leaves(child),
    );
  }
  return [];
}

describe("i18n", () => {
  afterEach(() => {
    setLocale("en");
    vi.unstubAllGlobals();
  });

  it("every locale bundle has the exact same key structure", () => {
    const reference = shape(en);
    expect(shape(fr)).toEqual(reference);
    expect(shape(ar)).toEqual(reference);
  });

  it("no locale leaves any text blank", () => {
    for (const bundle of [en, fr, ar]) {
      for (const value of leaves(bundle)) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("world name lists align across locales", () => {
    const count = en.levelSelect.worldNames.length;
    expect(fr.levelSelect.worldNames).toHaveLength(count);
    expect(ar.levelSelect.worldNames).toHaveLength(count);
  });

  it("translates a title for every registered level in fr and ar", () => {
    for (const level of levels) {
      expect(fr.levelNames[level.id], `fr missing ${level.id}`).toBeTruthy();
      expect(ar.levelNames[level.id], `ar missing ${level.id}`).toBeTruthy();
    }
  });

  it("does not translate level ids that do not exist", () => {
    const ids = new Set(levels.map((level) => level.id));
    for (const id of Object.keys(fr.levelNames)) {
      expect(ids.has(id), `fr has stray ${id}`).toBe(true);
    }
    for (const id of Object.keys(ar.levelNames)) {
      expect(ids.has(id), `ar has stray ${id}`).toBe(true);
    }
  });

  it("detects the first supported navigator language, else English", () => {
    vi.stubGlobal("navigator", { languages: ["fr-FR", "en-US"] });
    expect(detectLocale()).toBe("fr");
    vi.stubGlobal("navigator", { languages: ["ar-EG"] });
    expect(detectLocale()).toBe("ar");
    vi.stubGlobal("navigator", { languages: ["de", "es"] });
    expect(detectLocale()).toBe("en");
    vi.stubGlobal("navigator", { language: "fr-CA", languages: [] });
    expect(detectLocale()).toBe("fr");
    vi.stubGlobal("navigator", undefined);
    expect(detectLocale()).toBe("en");
  });

  it("setLocale swaps the live strings binding and tracks the locale", () => {
    setLocale("fr");
    expect(getLocale()).toBe("fr");
    expect(strings.menu.play).toBe(fr.menu.play);
    expect(strings.settings.language).toBe(fr.settings.language);

    setLocale("ar");
    expect(strings.menu.play).toBe(ar.menu.play);
    expect(isRtl()).toBe(true);

    setLocale("en");
    expect(strings.menu.play).toBe(en.menu.play);
    expect(isRtl()).toBe(false);
  });

  it("marks only Arabic as right-to-left", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("fr")).toBe(false);
    expect(isRtl("en")).toBe(false);
  });

  it("validates locale codes", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("xx")).toBe(false);
    expect(isLocale(7)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("exposes a display label for every locale", () => {
    for (const locale of LOCALES) {
      expect(localeLabels[locale].length).toBeGreaterThan(0);
    }
  });
});
