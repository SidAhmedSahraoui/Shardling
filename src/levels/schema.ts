import { z } from "zod";

const finiteNumber = z.number();
const positiveSize = z.number().positive();

const vec3Schema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
});

export type Vec3 = z.infer<typeof vec3Schema>;

const boxTerrainSchema = z.object({
  type: z.literal("box"),
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  w: positiveSize,
  h: positiveSize,
  d: positiveSize,
});

const rampDirSchema = z.enum(["+x", "-x", "+z", "-z"]);

const rampTerrainSchema = z.object({
  type: z.literal("ramp"),
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  w: positiveSize,
  h: positiveSize,
  d: positiveSize,
  dir: rampDirSchema,
});

export const terrainPieceSchema = z.discriminatedUnion("type", [
  boxTerrainSchema,
  rampTerrainSchema,
]);

export type TerrainPiece = z.infer<typeof terrainPieceSchema>;

const spikesFaceSchema = z.enum(["up", "down", "+x", "-x", "+z", "-z"]);

const spikesHazardSchema = z.object({
  type: z.literal("spikes"),
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  w: positiveSize,
  d: positiveSize,
  face: spikesFaceSchema,
});

const moverModeSchema = z.enum(["loop", "pingpong"]);

const pathSchema = z.array(vec3Schema).min(2);

const bladeHazardSchema = z.object({
  type: z.literal("blade"),
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  r: positiveSize,
  path: pathSchema.optional(),
  speed: positiveSize.optional(),
  mode: moverModeSchema.optional(),
});

const platformHazardSchema = z.object({
  type: z.literal("platform"),
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  w: positiveSize,
  d: positiveSize,
  path: pathSchema,
  speed: positiveSize,
  mode: moverModeSchema.default("pingpong"),
});

const crumbleHazardSchema = z.object({
  type: z.literal("crumble"),
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  w: positiveSize,
  d: positiveSize,
});

const bouncerHazardSchema = z.object({
  type: z.literal("bouncer"),
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
});

export const hazardSchema = z.discriminatedUnion("type", [
  spikesHazardSchema,
  bladeHazardSchema,
  platformHazardSchema,
  crumbleHazardSchema,
  bouncerHazardSchema,
]);

export type HazardData = z.infer<typeof hazardSchema>;
export type BladeData = Extract<HazardData, { type: "blade" }>;
export type PlatformData = Extract<HazardData, { type: "platform" }>;
export type CrumbleData = Extract<HazardData, { type: "crumble" }>;
export type BouncerData = Extract<HazardData, { type: "bouncer" }>;
export type MoverMode = z.infer<typeof moverModeSchema>;

const boundsSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  w: positiveSize,
  h: positiveSize,
  d: positiveSize,
});

export type LevelBounds = z.infer<typeof boundsSchema>;

const portalSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
  rotY: finiteNumber,
});

export const levelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  world: z.number().int().min(1).max(4),
  bounds: boundsSchema,
  killY: finiteNumber,
  spawn: vec3Schema,
  portal: portalSchema,
  shards: z.array(vec3Schema).min(1),
  terrain: z.array(terrainPieceSchema).min(1),
  hazards: z.array(hazardSchema),
  intendedPath: z.string().min(1),
  hints: z.array(z.string()).optional(),
});

export type LevelData = z.infer<typeof levelSchema>;

export function parseLevel(raw: unknown, sourceName: string): LevelData {
  const result = levelSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `  ${path}: ${issue.message}`;
      })
      .join("\n");
    throw new Error(`Invalid level data in ${sourceName}:\n${issues}`);
  }
  return result.data;
}
