import { describe, expect, it } from "vitest";

import level01 from "../src/levels/data/level-01.json";
import { sanityCheckLevel } from "../src/levels/sanity";
import type { LevelData } from "../src/levels/schema";
import { parseLevel } from "../src/levels/schema";

function makeLevel(overrides: Partial<LevelData> = {}): LevelData {
  return {
    id: "test-level",
    name: "Test Level",
    world: 1,
    bounds: { x: 0, y: -10, z: -10, w: 40, h: 30, d: 20 },
    killY: -8,
    spawn: { x: 4, y: 1.5, z: 0 },
    portal: { x: 18, y: 1, z: 0, rotY: 90 },
    shards: [{ x: 10, y: 2, z: 0 }],
    terrain: [{ type: "box", x: 0, y: 0, z: -3, w: 20, h: 1, d: 6 }],
    hazards: [],
    intendedPath: "Roll right to the gate.",
    ...overrides,
  };
}

describe("levelSchema / parseLevel", () => {
  it("accepts a valid fixture", () => {
    const level = parseLevel(makeLevel(), "fixture");
    expect(level.id).toBe("test-level");
    expect(level.terrain).toHaveLength(1);
  });

  it("accepts the shipped level-01 JSON", () => {
    const level = parseLevel(level01, "level-01.json");
    expect(level.id).toBe("level-01");
    expect(level.name).toBe("First Light");
    expect(level.world).toBe(1);
    expect(level.shards).toHaveLength(3);
    expect(level.hazards).toHaveLength(0);
  });

  it("rejects a missing intendedPath, naming the source", () => {
    const raw: Record<string, unknown> = { ...makeLevel() };
    delete raw.intendedPath;
    expect(() => parseLevel(raw, "broken.json")).toThrowError(
      /broken\.json[\s\S]*intendedPath/,
    );
  });

  it("rejects an empty intendedPath", () => {
    expect(() =>
      parseLevel(makeLevel({ intendedPath: "" }), "fixture"),
    ).toThrowError(/intendedPath/);
  });

  it("rejects zero shards", () => {
    expect(() => parseLevel(makeLevel({ shards: [] }), "fixture")).toThrowError(
      /shards/,
    );
  });

  it("rejects an unknown hazard type", () => {
    const raw = {
      ...makeLevel(),
      hazards: [{ type: "laser", x: 10, y: 1, z: 0, w: 2, d: 2, face: "up" }],
    };
    expect(() => parseLevel(raw, "fixture")).toThrowError(/hazards/);
  });

  it("rejects non-finite numbers (NaN and Infinity)", () => {
    expect(() =>
      parseLevel(makeLevel({ killY: Number.NaN }), "fixture"),
    ).toThrowError(/killY/);
    expect(() =>
      parseLevel(
        makeLevel({ spawn: { x: 4, y: Number.POSITIVE_INFINITY, z: 0 } }),
        "fixture",
      ),
    ).toThrowError(/spawn/);
  });

  it("rejects non-positive sizes", () => {
    expect(() =>
      parseLevel(
        makeLevel({
          terrain: [{ type: "box", x: 0, y: 0, z: -3, w: 0, h: 1, d: 6 }],
        }),
        "fixture",
      ),
    ).toThrowError(/terrain/);
  });

  it("rejects a world outside 1..4", () => {
    expect(() => parseLevel(makeLevel({ world: 5 }), "fixture")).toThrowError(
      /world/,
    );
  });

  it("accepts spikes hazards and ramp terrain", () => {
    const level = parseLevel(
      makeLevel({
        terrain: [
          { type: "box", x: 0, y: 0, z: -3, w: 20, h: 1, d: 6 },
          { type: "ramp", x: 20, y: 0, z: -1, w: 4, h: 3, d: 3, dir: "+x" },
        ],
        hazards: [
          { type: "spikes", x: 12, y: 1, z: -2, w: 4, d: 2, face: "up" },
        ],
      }),
      "fixture",
    );
    expect(level.hazards[0]?.type).toBe("spikes");
  });
});

describe("sanityCheckLevel", () => {
  it("passes the valid fixture with no violations", () => {
    expect(sanityCheckLevel(makeLevel())).toEqual([]);
  });

  it("passes the shipped level-01 JSON", () => {
    expect(sanityCheckLevel(parseLevel(level01, "level-01.json"))).toEqual([]);
  });

  it("flags terrain outside bounds", () => {
    const level = makeLevel({
      terrain: [
        { type: "box", x: 0, y: 0, z: -3, w: 20, h: 1, d: 6 },
        { type: "box", x: 38, y: 0, z: 0, w: 6, h: 1, d: 2 },
      ],
    });
    const violations = sanityCheckLevel(level);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/terrain\[1\].*outside bounds/);
  });

  it("flags a shard outside bounds", () => {
    const level = makeLevel({
      shards: [{ x: 10, y: 25, z: 0 }],
    });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/shards\[0\].*outside bounds/),
    ]);
  });

  it("flags a spawn outside bounds", () => {
    const level = makeLevel({ spawn: { x: -5, y: 1.5, z: 0 } });
    const violations = sanityCheckLevel(level);
    expect(violations).toContainEqual(
      expect.stringMatching(/spawn.*outside bounds/),
    );
  });

  it("flags a spawn with no terrain top within 3 u beneath it", () => {
    const level = makeLevel({ spawn: { x: 4, y: 5, z: 0 } });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/spawn.*no terrain top within 3 u/),
    ]);
  });

  it("flags a spawn hovering off every terrain footprint", () => {
    const level = makeLevel({ spawn: { x: 30, y: 1.5, z: 0 } });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/spawn.*no terrain top/),
    ]);
  });

  it("flags a portal not seated on a terrain top", () => {
    const level = makeLevel({ portal: { x: 18, y: 2, z: 0, rotY: 90 } });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(
        /portal.*not fully seated.*within 0\.5 u of a terrain top/,
      ),
    ]);
  });

  it("flags a hazard within 2 u of spawn", () => {
    const level = makeLevel({
      hazards: [{ type: "spikes", x: 3, y: 1, z: -1, w: 4, d: 2, face: "up" }],
    });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/hazards\[0\].*within 2 u of spawn/),
    ]);
  });

  it("accepts a hazard farther than 2 u from spawn", () => {
    const level = makeLevel({
      hazards: [{ type: "spikes", x: 12, y: 1, z: -1, w: 4, d: 2, face: "up" }],
    });
    expect(sanityCheckLevel(level)).toEqual([]);
  });

  it("flags a hazard AABB outside bounds", () => {
    const level = makeLevel({
      hazards: [{ type: "spikes", x: 38, y: 1, z: -1, w: 4, d: 2, face: "up" }],
    });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/hazards\[0\].*outside bounds/),
    ]);
  });

  it("flags a killY that is not strictly below the lowest terrain", () => {
    const level = makeLevel({ killY: 0 });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/killY.*strictly below the lowest terrain/),
    ]);
  });

  it("treats a ramp's AABB as its bounding volume for bounds checks", () => {
    const level = makeLevel({
      terrain: [
        { type: "box", x: 0, y: 0, z: -3, w: 20, h: 1, d: 6 },
        { type: "ramp", x: 38, y: 0, z: -1, w: 4, h: 3, d: 3, dir: "+x" },
      ],
    });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/terrain\[1\] \(ramp.*outside bounds/),
    ]);
  });
});

describe("sanity — ramp surface height (spawn/portal seat on slopes)", () => {
  const rampTerrain: LevelData["terrain"] = [
    { type: "box", x: 0, y: 0, z: -5, w: 8, h: 1, d: 10 },
    { type: "ramp", x: 8, y: 0, z: -5, w: 10, h: 3, d: 10, dir: "+x" },
  ];

  it("accepts a spawn resting just above the mid-slope surface", () => {
    const level = makeLevel({
      terrain: rampTerrain,
      spawn: { x: 13, y: 2, z: 0 },
    });
    expect(sanityCheckLevel(level).filter((v) => v.includes("spawn"))).toEqual(
      [],
    );
  });

  it("rejects a spawn floating high over the ramp's LOW end", () => {
    const level = makeLevel({
      terrain: rampTerrain,
      spawn: { x: 8.5, y: 6, z: 0 },
    });
    expect(sanityCheckLevel(level).some((v) => v.includes("spawn"))).toBe(true);
  });

  it("rejects a portal seated at bounding-box height over the ramp's low corner", () => {
    const level = makeLevel({
      terrain: rampTerrain,
      portal: { x: 8.2, y: 3, z: 0, rotY: 0 },
    });
    expect(sanityCheckLevel(level).some((v) => v.includes("portal"))).toBe(
      true,
    );
  });
});

describe("sanity — wall-mounted spikes AABB axes", () => {
  it("catches +x wall teeth whose VERTICAL extent (w) leaves bounds", () => {
    const level = makeLevel({
      hazards: [{ type: "spikes", x: 10, y: 17, z: 0, w: 5, d: 2, face: "+x" }],
    });
    expect(sanityCheckLevel(level).some((v) => v.includes("hazards[0]"))).toBe(
      true,
    );
  });
});

describe("levelSchema — Phase 4 hazards (blade/platform/crumble/bouncer)", () => {
  it("accepts a static blade", () => {
    const level = parseLevel(
      makeLevel({
        hazards: [{ type: "blade", x: 12, y: 1.6, z: 0, r: 0.8 }],
      }),
      "fixture",
    );
    expect(level.hazards[0]).toMatchObject({ type: "blade", r: 0.8 });
  });

  it("accepts a pathed blade with a 2-point path and speed", () => {
    const level = parseLevel(
      makeLevel({
        hazards: [
          {
            type: "blade",
            x: 12,
            y: 1.6,
            z: 0,
            r: 0.8,
            path: [
              { x: 12, y: 1.6, z: 0 },
              { x: 16, y: 1.6, z: 0 },
            ],
            speed: 2,
          },
        ],
      }),
      "fixture",
    );
    expect(level.hazards[0]).toMatchObject({ type: "blade", speed: 2 });
  });

  it("accepts a platform starting at its corner, defaulting mode to pingpong", () => {
    const raw = {
      ...makeLevel(),
      hazards: [
        {
          type: "platform",
          x: 22,
          y: 2,
          z: -1,
          w: 3,
          d: 2,
          path: [
            { x: 22, y: 2, z: -1 },
            { x: 28, y: 2, z: -1 },
          ],
          speed: 2,
        },
      ],
    };
    const level = parseLevel(raw, "fixture");
    expect(level.hazards[0]).toMatchObject({
      type: "platform",
      mode: "pingpong",
    });
  });

  it("accepts a crumble slab", () => {
    const level = parseLevel(
      makeLevel({
        hazards: [{ type: "crumble", x: 10, y: 3, z: -1, w: 2, d: 2 }],
      }),
      "fixture",
    );
    expect(level.hazards[0]?.type).toBe("crumble");
  });

  it("accepts a bouncer", () => {
    const level = parseLevel(
      makeLevel({ hazards: [{ type: "bouncer", x: 12, y: 1, z: 0 }] }),
      "fixture",
    );
    expect(level.hazards[0]?.type).toBe("bouncer");
  });

  it("rejects a platform missing its path", () => {
    const raw = {
      ...makeLevel(),
      hazards: [{ type: "platform", x: 22, y: 2, z: -1, w: 3, d: 2, speed: 2 }],
    };
    expect(() => parseLevel(raw, "fixture")).toThrowError(/hazards[\s\S]*path/);
  });

  it("rejects a platform missing its speed", () => {
    const raw = {
      ...makeLevel(),
      hazards: [
        {
          type: "platform",
          x: 22,
          y: 2,
          z: -1,
          w: 3,
          d: 2,
          path: [
            { x: 22, y: 2, z: -1 },
            { x: 28, y: 2, z: -1 },
          ],
        },
      ],
    };
    expect(() => parseLevel(raw, "fixture")).toThrowError(
      /hazards[\s\S]*speed/,
    );
  });

  it("rejects a mover path with a single waypoint", () => {
    const raw = {
      ...makeLevel(),
      hazards: [
        {
          type: "blade",
          x: 12,
          y: 1.6,
          z: 0,
          r: 0.8,
          path: [{ x: 12, y: 1.6, z: 0 }],
          speed: 2,
        },
      ],
    };
    expect(() => parseLevel(raw, "fixture")).toThrowError(/hazards[\s\S]*path/);
  });

  it("rejects a blade with a non-positive radius", () => {
    expect(() =>
      parseLevel(
        makeLevel({ hazards: [{ type: "blade", x: 12, y: 1.6, z: 0, r: 0 }] }),
        "fixture",
      ),
    ).toThrowError(/hazards\.0\.r/);
    expect(() =>
      parseLevel(
        makeLevel({ hazards: [{ type: "blade", x: 12, y: 1.6, z: 0, r: -1 }] }),
        "fixture",
      ),
    ).toThrowError(/hazards\.0\.r/);
  });

  it("rejects an unknown hazard type string", () => {
    const raw = {
      ...makeLevel(),
      hazards: [{ type: "grinder", x: 12, y: 1.6, z: 0, r: 0.8 }],
    };
    expect(() => parseLevel(raw, "fixture")).toThrowError(/hazards/);
  });
});

describe("sanityCheckLevel — Phase 4 movers & helpers", () => {
  it("flags a pathed blade without speed, naming speed", () => {
    const level = makeLevel({
      hazards: [
        {
          type: "blade",
          x: 14,
          y: 2,
          z: 0,
          r: 0.6,
          path: [
            { x: 14, y: 2, z: 0 },
            { x: 17, y: 2, z: 0 },
          ],
        },
      ],
    });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/hazards\[0\].*has a path but no speed/),
    ]);
  });

  it("flags a platform that does not start at path[0]", () => {
    const level = makeLevel({
      hazards: [
        {
          type: "platform",
          x: 22,
          y: 2,
          z: -1,
          w: 3,
          d: 2,
          path: [
            { x: 23, y: 2, z: -1 },
            { x: 28, y: 2, z: -1 },
          ],
          speed: 2,
          mode: "pingpong",
        },
      ],
    });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/hazards\[0\].*must start at path\[0\]/),
    ]);
  });

  it("allows a helper platform right at spawn (no clearance violation)", () => {
    const level = makeLevel({
      hazards: [
        {
          type: "platform",
          x: 3,
          y: 0.5,
          z: -1,
          w: 2,
          d: 2,
          path: [
            { x: 3, y: 0.5, z: -1 },
            { x: 3, y: 3, z: -1 },
          ],
          speed: 1.5,
          mode: "pingpong",
        },
      ],
    });
    expect(sanityCheckLevel(level)).toEqual([]);
  });

  it("allows a bouncer within 2 u of spawn", () => {
    const level = makeLevel({
      hazards: [{ type: "bouncer", x: 5, y: 1, z: 0 }],
    });
    expect(sanityCheckLevel(level)).toEqual([]);
  });

  it("still flags a lethal blade near spawn", () => {
    const level = makeLevel({
      hazards: [{ type: "blade", x: 5, y: 1.5, z: 0, r: 0.5 }],
    });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/hazards\[0\] \(blade.*within 2 u of spawn/),
    ]);
  });

  it("flags a platform whose path sweeps outside bounds", () => {
    const level = makeLevel({
      hazards: [
        {
          type: "platform",
          x: 30,
          y: 2,
          z: -1,
          w: 3,
          d: 2,
          path: [
            { x: 30, y: 2, z: -1 },
            { x: 39, y: 2, z: -1 },
          ],
          speed: 2,
          mode: "pingpong",
        },
      ],
    });
    expect(sanityCheckLevel(level)).toEqual([
      expect.stringMatching(/hazards\[0\].*outside bounds/),
    ]);
  });

  it("passes the same platform with an in-bounds path", () => {
    const level = makeLevel({
      hazards: [
        {
          type: "platform",
          x: 30,
          y: 2,
          z: -1,
          w: 3,
          d: 2,
          path: [
            { x: 30, y: 2, z: -1 },
            { x: 35, y: 2, z: -1 },
          ],
          speed: 2,
          mode: "pingpong",
        },
      ],
    });
    expect(sanityCheckLevel(level)).toEqual([]);
  });

  it("passes a level using every Phase 4 hazard type validly", () => {
    const level = makeLevel({
      hazards: [
        { type: "blade", x: 10, y: 2, z: 0, r: 0.6 },
        {
          type: "blade",
          x: 14,
          y: 2,
          z: 0,
          r: 0.6,
          path: [
            { x: 14, y: 2, z: 0 },
            { x: 14, y: 2, z: 2 },
          ],
          speed: 2,
          mode: "loop",
        },
        {
          type: "platform",
          x: 22,
          y: 2,
          z: -1,
          w: 3,
          d: 2,
          path: [
            { x: 22, y: 2, z: -1 },
            { x: 27, y: 4, z: -1 },
          ],
          speed: 2,
          mode: "pingpong",
        },
        { type: "crumble", x: 8, y: 1, z: -2, w: 2, d: 2 },
        { type: "bouncer", x: 16, y: 1, z: 1 },
      ],
    });
    expect(sanityCheckLevel(level)).toEqual([]);
  });
});

describe("sanity — platform speed cap & portal footprint seating", () => {
  it("rejects a platform at or above maxSpeedXZ (uncarryable rider)", () => {
    const level = makeLevel({
      hazards: [
        {
          type: "platform",
          x: 8,
          y: 3,
          z: -1.5,
          w: 3,
          d: 3,
          path: [
            { x: 8, y: 3, z: -1.5 },
            { x: 14, y: 3, z: -1.5 },
          ],
          speed: 8,
          mode: "pingpong",
        },
      ],
    });
    const violations = sanityCheckLevel(parseLevel(level, "fixture"));
    expect(violations.some((v) => /maxSpeedXZ/.test(v))).toBe(true);
  });

  it("accepts a platform just below maxSpeedXZ", () => {
    const level = makeLevel({
      hazards: [
        {
          type: "platform",
          x: 8,
          y: 3,
          z: -1.5,
          w: 3,
          d: 3,
          path: [
            { x: 8, y: 3, z: -1.5 },
            { x: 14, y: 3, z: -1.5 },
          ],
          speed: 7.5,
          mode: "pingpong",
        },
      ],
    });
    expect(sanityCheckLevel(parseLevel(level, "fixture"))).toEqual([]);
  });

  it("rejects a portal whose footprint corner hangs past the terrain edge", () => {
    const level = makeLevel({ portal: { x: 19.5, y: 1, z: 0, rotY: 90 } });
    const violations = sanityCheckLevel(parseLevel(level, "fixture"));
    expect(violations.some((v) => /portal .* seated/.test(v))).toBe(true);
  });

  it("footprint rotation follows rotY: the same overhang appears at rotY 0 near the edge", () => {
    const seated = makeLevel({ portal: { x: 18, y: 1, z: 0, rotY: 0 } });
    expect(sanityCheckLevel(parseLevel(seated, "fixture"))).toEqual([]);
    const overhung = makeLevel({ portal: { x: 19, y: 1, z: 0, rotY: 0 } });
    const violations = sanityCheckLevel(parseLevel(overhung, "fixture"));
    expect(violations.some((v) => /portal .* seated/.test(v))).toBe(true);
  });
});
