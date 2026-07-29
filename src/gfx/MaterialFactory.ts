import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PointsMaterial,
  RepeatWrapping,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";

import type { WorldTheme } from "../config/palette";
import { palette, worldTheme } from "../config/palette";
import { tuning } from "../config/tuning";

export type StandardMaterialKey =
  | "terrain"
  | "terrainTop"
  | "trim"
  | "player"
  | "eye"
  | "shard"
  | "hazard"
  | "portalDormant"
  | "portalActive"
  | "portalStone"
  | "bouncer";

type TextureKey = "grid" | "softCircle" | "ring";

export type SpriteKind =
  "mote" | "ring" | "dust" | "spark" | "ember" | "portalMote";

export interface ThemedTerrainMaterials {
  body: MeshStandardMaterial;
  top: MeshStandardMaterial;
  trim: MeshStandardMaterial;
}

const STONE_ROUGHNESS = 0.85;
const STONE_METALNESS = 0.05;
const PLAYER_ROUGHNESS = 0.8;
const PLAYER_METALNESS = 0.05;
const GLOW_ROUGHNESS = 0.45;
const GLOW_METALNESS = 0.05;
const EYE_EMISSIVE_INTENSITY = 2.2;
const SHARD_EMISSIVE_INTENSITY = 1.6;
const HAZARD_EMISSIVE_INTENSITY = 1.8;
const PORTAL_DORMANT_EMISSIVE_INTENSITY = 0.25;
const PORTAL_ACTIVE_EMISSIVE_INTENSITY = 2.4;
const BOUNCER_EMISSIVE_INTENSITY = 0.9;

const MOTE_SPRITE_OPACITY = 0.35;
const RING_SPRITE_OPACITY = 0.9;
const DUST_SPRITE_OPACITY = 0.5;
const SPARK_SPRITE_OPACITY = 0.95;
const EMBER_SPRITE_OPACITY = 0.9;
const PORTAL_MOTE_SPRITE_OPACITY = 0.75;
const MOTE_POINT_SIZE = 0.12;

const GRID_TEXTURE_SIZE = 128;
const GRID_LINE_PX = 3;
const GRID_LINE_ALPHA = 0.16;
const SOFT_CIRCLE_TEXTURE_SIZE = 64;
const SOFT_CIRCLE_CORE_STOP = 0.35;
const RING_TEXTURE_SIZE = 64;
const RING_INNER_STOP = 0.68;
const RING_PEAK_STOP = 0.8;
const RING_OUTER_STOP = 0.92;

const STONE_TEXTURE_SIZE = 512;
const STONE_PATCH_UNITS = 4;
const STONE_TILES_PER_SIDE = 4;
const STONE_GROUT_PX = 4;
const STONE_BEVEL_PX = 3;
const STONE_BEVEL_LIGHT_ALPHA = 0.18;
const STONE_BEVEL_DARK_ALPHA = 0.16;
const STONE_MOTTLE_PER_TILE = 3;
const STONE_MOTTLE_ALPHA = 0.05;
const STONE_IMPRINT_ALPHA = 0.14;
const RUNE_STROKE_PX = 7;
const RUNE_STROKE_ALPHA = 0.92;
const RUNE_SEGMENTS_MIN = 3;
const RUNE_SEGMENTS_MAX = 5;
const RUNE_MARGIN_RATIO = 0.24;
const STONE_SEED_BASE = 0x7f4a7c15;

const STRATA_TEXTURE_SIZE = 256;
const STRATA_BANDS = 5;
const STRATA_JITTER = 0.05;
const STRATA_SEAM_ALPHA = 0.18;
const STRATA_SEAM_PX = 2;
const STRATA_CHIP_COUNT = 14;
const STRATA_CHIP_ALPHA = 0.07;
const STRATA_SEED_BASE = 0x3c6ef372;

const SKY_TEXTURE_WIDTH = 2048;
const SKY_TEXTURE_HEIGHT = 1024;
const SKY_MID_STOP = 0.5;
const SKY_NADIR_FOG_STOP = 0.72;
const SKY_HORIZON_START = 0.36;
const SKY_HORIZON_PEAK = 0.5;
const SKY_HORIZON_END = 0.64;
const SKY_HORIZON_ALPHA = 0.45;
const STAR_BAND_TOP_V = 0.08;
const STAR_BAND_BOTTOM_V = 0.52;
const STAR_MIN_RADIUS_PX = 0.5;
const STAR_MAX_RADIUS_PX = 1.3;
const STAR_MIN_ALPHA = 0.45;
const STAR_MAX_ALPHA = 0.9;
const STAR_HALO_EVERY = 6;
const STAR_HALO_RADIUS_MULT = 2.6;
const STAR_HALO_ALPHA_MULT = 0.18;
const STAR_EDGE_PAD_PX = 4;
const STAR_SEED = 0x51ed270b;
const NEBULAE: readonly {
  u: number;
  v: number;
  radiusU: number;
  squashV: number;
  alpha: number;
}[] = [
  { u: 0.22, v: 0.2, radiusU: 0.16, squashV: 0.45, alpha: 0.06 },
  { u: 0.68, v: 0.3, radiusU: 0.2, squashV: 0.4, alpha: 0.05 },
  { u: 0.46, v: 0.12, radiusU: 0.13, squashV: 0.5, alpha: 0.045 },
  { u: 0.88, v: 0.16, radiusU: 0.11, squashV: 0.45, alpha: 0.04 },
];

function css(hex: number): string {
  return new Color(hex).getStyle();
}

function cssAlpha(hex: number, alpha: number): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function scaleHex(hex: number, mult: number): string {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * mult));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * mult));
  const b = Math.min(255, Math.round((hex & 255) * mult));
  return `rgb(${r}, ${g}, ${b})`;
}

function createLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function mask(luminance: number, alpha: number): string {
  const v = Math.round(luminance * 255);
  return `rgba(${v}, ${v}, ${v}, ${alpha})`;
}

function createCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("MaterialFactory: 2D canvas context unavailable");
  }
  return { canvas, ctx };
}

function repeatingTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(1 / STONE_PATCH_UNITS, 1 / STONE_PATCH_UNITS);
  return texture;
}

function createGridTexture(): CanvasTexture {
  const { canvas, ctx } = createCanvas(GRID_TEXTURE_SIZE, GRID_TEXTURE_SIZE);
  ctx.fillStyle = mask(1, 1);
  ctx.fillRect(0, 0, GRID_TEXTURE_SIZE, GRID_TEXTURE_SIZE);
  ctx.fillStyle = mask(0, GRID_LINE_ALPHA);
  ctx.fillRect(0, 0, GRID_TEXTURE_SIZE, GRID_LINE_PX);
  ctx.fillRect(0, 0, GRID_LINE_PX, GRID_TEXTURE_SIZE);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function createSoftCircleTexture(): CanvasTexture {
  const { canvas, ctx } = createCanvas(
    SOFT_CIRCLE_TEXTURE_SIZE,
    SOFT_CIRCLE_TEXTURE_SIZE,
  );
  const half = SOFT_CIRCLE_TEXTURE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, mask(1, 1));
  gradient.addColorStop(SOFT_CIRCLE_CORE_STOP, mask(1, 0.9));
  gradient.addColorStop(1, mask(1, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SOFT_CIRCLE_TEXTURE_SIZE, SOFT_CIRCLE_TEXTURE_SIZE);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function createRingTexture(): CanvasTexture {
  const { canvas, ctx } = createCanvas(RING_TEXTURE_SIZE, RING_TEXTURE_SIZE);
  const half = RING_TEXTURE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, mask(1, 0));
  gradient.addColorStop(RING_INNER_STOP, mask(1, 0));
  gradient.addColorStop(RING_PEAK_STOP, mask(1, 1));
  gradient.addColorStop(RING_OUTER_STOP, mask(1, 0));
  gradient.addColorStop(1, mask(1, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, RING_TEXTURE_SIZE, RING_TEXTURE_SIZE);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function drawRune(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rand: () => number,
  style: string,
): void {
  const margin = size * RUNE_MARGIN_RATIO;
  const span = size - margin * 2;
  const segments =
    RUNE_SEGMENTS_MIN +
    Math.floor(rand() * (RUNE_SEGMENTS_MAX - RUNE_SEGMENTS_MIN + 1));
  const grid = 3;
  const point = (): [number, number] => [
    x + margin + Math.floor(rand() * (grid + 1)) * (span / grid),
    y + margin + Math.floor(rand() * (grid + 1)) * (span / grid),
  ];
  ctx.strokeStyle = style;
  ctx.lineWidth = RUNE_STROKE_PX;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  let [px, py] = point();
  ctx.moveTo(px, py);
  for (let i = 0; i < segments; i += 1) {
    const [nx, ny] = point();
    ctx.lineTo(nx, ny);
    px = nx;
    py = ny;
  }
  ctx.stroke();
}

function createStoneTopTextures(
  theme: WorldTheme,
  world: number,
): { albedo: CanvasTexture; runes: CanvasTexture } {
  const size = STONE_TEXTURE_SIZE;
  const tile = size / STONE_TILES_PER_SIDE;
  const { canvas, ctx } = createCanvas(size, size);
  const runeLayer = createCanvas(size, size);
  runeLayer.ctx.fillStyle = "rgb(0, 0, 0)";
  runeLayer.ctx.fillRect(0, 0, size, size);

  const rand = createLcg((STONE_SEED_BASE ^ (world * 0x9e3779b9)) >>> 0);
  ctx.fillStyle = css(theme.grout);
  ctx.fillRect(0, 0, size, size);

  const drawBlock = (x: number, y: number, w: number, h: number): void => {
    const inset = STONE_GROUT_PX / 2;
    const bx = x + inset;
    const by = y + inset;
    const bw = w - STONE_GROUT_PX;
    const bh = h - STONE_GROUT_PX;
    if (bw <= 0 || bh <= 0) {
      return;
    }
    const jitter = 1 + (rand() * 2 - 1) * tuning.terrainTileJitter;
    ctx.fillStyle = scaleHex(theme.terrainTop, jitter);
    ctx.fillRect(bx, by, bw, bh);

    for (let m = 0; m < STONE_MOTTLE_PER_TILE; m += 1) {
      const mx = bx + rand() * bw;
      const my = by + rand() * bh;
      const mr = Math.min(bw, bh) * (0.2 + rand() * 0.25);
      const light = rand() > 0.5;
      const mottle = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      mottle.addColorStop(
        0,
        light
          ? `rgba(255, 255, 255, ${STONE_MOTTLE_ALPHA})`
          : `rgba(0, 0, 0, ${STONE_MOTTLE_ALPHA})`,
      );
      mottle.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      ctx.fillStyle = mottle;
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      ctx.restore();
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${STONE_BEVEL_LIGHT_ALPHA})`;
    ctx.fillRect(bx, by, bw, STONE_BEVEL_PX);
    ctx.fillRect(bx, by, STONE_BEVEL_PX, bh);
    ctx.fillStyle = `rgba(0, 0, 0, ${STONE_BEVEL_DARK_ALPHA})`;
    ctx.fillRect(bx, by + bh - STONE_BEVEL_PX, bw, STONE_BEVEL_PX);
    ctx.fillRect(bx + bw - STONE_BEVEL_PX, by, STONE_BEVEL_PX, bh);

    if (rand() < tuning.runeTileChance) {
      const runeSeed = (rand() * 0x100000000) >>> 0;
      const runeSize = Math.min(bw, bh);
      const rx = bx + (bw - runeSize) / 2;
      const ry = by + (bh - runeSize) / 2;
      drawRune(
        ctx,
        rx,
        ry,
        runeSize,
        createLcg(runeSeed),
        cssAlpha(theme.grout, STONE_IMPRINT_ALPHA + 0.1),
      );
      drawRune(
        runeLayer.ctx,
        rx,
        ry,
        runeSize,
        createLcg(runeSeed),
        `rgba(255, 255, 255, ${RUNE_STROKE_ALPHA})`,
      );
    }
  };

  const widthSteps = [0.75, 1, 1, 1.25, 1.5];
  for (let row = 0; row < STONE_TILES_PER_SIDE; row += 1) {
    const y = row * tile;
    let x = -rand() * tile;
    while (x < size) {
      const step = widthSteps[Math.floor(rand() * widthSteps.length)] ?? 1;
      const w = step * tile;
      drawBlock(x, y, w, tile);
      x += w;
    }
  }

  return {
    albedo: repeatingTexture(canvas),
    runes: repeatingTexture(runeLayer.canvas),
  };
}

function createStrataTexture(theme: WorldTheme, world: number): CanvasTexture {
  const size = STRATA_TEXTURE_SIZE;
  const { canvas, ctx } = createCanvas(size, size);
  const rand = createLcg((STRATA_SEED_BASE ^ (world * 0x85ebca6b)) >>> 0);
  const bandH = size / STRATA_BANDS;
  for (let b = 0; b < STRATA_BANDS; b += 1) {
    const jitter = 1 + (rand() * 2 - 1) * STRATA_JITTER;
    ctx.fillStyle = scaleHex(theme.terrain, jitter);
    ctx.fillRect(0, b * bandH, size, bandH);
    ctx.fillStyle = `rgba(0, 0, 0, ${STRATA_SEAM_ALPHA})`;
    ctx.fillRect(0, b * bandH, size, STRATA_SEAM_PX);
  }
  for (let c = 0; c < STRATA_CHIP_COUNT; c += 1) {
    const w = 6 + rand() * 22;
    const h = 3 + rand() * 6;
    ctx.fillStyle =
      rand() > 0.5
        ? `rgba(255, 255, 255, ${STRATA_CHIP_ALPHA})`
        : `rgba(0, 0, 0, ${STRATA_CHIP_ALPHA})`;
    ctx.fillRect(rand() * size, rand() * size, w, h);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function createSkyGradientTexture(theme: WorldTheme): CanvasTexture {
  const { canvas, ctx } = createCanvas(SKY_TEXTURE_WIDTH, SKY_TEXTURE_HEIGHT);
  const gradient = ctx.createLinearGradient(0, 0, 0, SKY_TEXTURE_HEIGHT);
  gradient.addColorStop(0, css(theme.skyZenith));
  gradient.addColorStop(SKY_MID_STOP, css(theme.skyMid));
  gradient.addColorStop(SKY_NADIR_FOG_STOP, css(theme.fog));
  gradient.addColorStop(1, css(theme.skyAbyss));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SKY_TEXTURE_WIDTH, SKY_TEXTURE_HEIGHT);

  const horizonTop = SKY_TEXTURE_HEIGHT * SKY_HORIZON_START;
  const horizonBottom = SKY_TEXTURE_HEIGHT * SKY_HORIZON_END;
  const horizon = ctx.createLinearGradient(0, horizonTop, 0, horizonBottom);
  horizon.addColorStop(0, cssAlpha(theme.skyHorizonBand, 0));
  horizon.addColorStop(
    SKY_HORIZON_PEAK,
    cssAlpha(theme.skyHorizonBand, SKY_HORIZON_ALPHA),
  );
  horizon.addColorStop(1, cssAlpha(theme.skyHorizonBand, 0));
  ctx.fillStyle = horizon;
  ctx.fillRect(0, horizonTop, SKY_TEXTURE_WIDTH, horizonBottom - horizonTop);

  const nebulaColors = [palette.portal, theme.trim, palette.portal, theme.trim];
  NEBULAE.forEach((blob, index) => {
    const cx = SKY_TEXTURE_WIDTH * blob.u;
    const cy = SKY_TEXTURE_HEIGHT * blob.v;
    const radius = SKY_TEXTURE_WIDTH * blob.radiusU;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, blob.squashV);
    const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    const color = nebulaColors[index % nebulaColors.length] ?? palette.portal;
    cloud.addColorStop(0, cssAlpha(color, blob.alpha));
    cloud.addColorStop(1, cssAlpha(color, 0));
    ctx.fillStyle = cloud;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  });

  const rand = createLcg(STAR_SEED);
  for (let i = 0; i < tuning.skyStarCount; i += 1) {
    const x =
      STAR_EDGE_PAD_PX + rand() * (SKY_TEXTURE_WIDTH - STAR_EDGE_PAD_PX * 2);
    const y =
      SKY_TEXTURE_HEIGHT *
      (STAR_BAND_BOTTOM_V -
        rand() * rand() * (STAR_BAND_BOTTOM_V - STAR_BAND_TOP_V));
    const radius =
      STAR_MIN_RADIUS_PX + rand() * (STAR_MAX_RADIUS_PX - STAR_MIN_RADIUS_PX);
    const alpha = STAR_MIN_ALPHA + rand() * (STAR_MAX_ALPHA - STAR_MIN_ALPHA);
    if (i % STAR_HALO_EVERY === 0) {
      ctx.fillStyle = cssAlpha(theme.star, alpha * STAR_HALO_ALPHA_MULT);
      ctx.beginPath();
      ctx.arc(x, y, radius * STAR_HALO_RADIUS_MULT, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = cssAlpha(theme.star, alpha);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function glowMaterial(
  hex: number,
  emissiveIntensity: number,
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity,
    roughness: GLOW_ROUGHNESS,
    metalness: GLOW_METALNESS,
  });
}

export class MaterialFactory {
  private readonly materials = new Map<
    StandardMaterialKey,
    MeshStandardMaterial
  >();
  private readonly textures = new Map<TextureKey, CanvasTexture>();
  private readonly spriteMaterials = new Map<SpriteKind, SpriteMaterial>();
  private readonly themedTerrain = new Map<number, ThemedTerrainMaterials>();
  private readonly themedTextures = new Map<number, CanvasTexture[]>();
  private readonly skyByWorld = new Map<
    number,
    { material: MeshBasicMaterial; texture: CanvasTexture }
  >();
  private readonly islandByWorld = new Map<number, MeshBasicMaterial>();
  private motePoints: PointsMaterial | undefined;

  material(key: StandardMaterialKey): MeshStandardMaterial {
    let material = this.materials.get(key);
    if (!material) {
      material = this.createMaterial(key);
      this.materials.set(key, material);
    }
    return material;
  }

  terrainThemeMaterials(world: number): ThemedTerrainMaterials {
    const index = Math.min(Math.max(Math.round(world), 1), 4);
    let themed = this.themedTerrain.get(index);
    if (!themed) {
      const theme = worldTheme(index);
      const { albedo, runes } = createStoneTopTextures(theme, index);
      const strata = createStrataTexture(theme, index);
      this.themedTextures.set(index, [albedo, runes, strata]);
      themed = {
        body: new MeshStandardMaterial({
          color: 0xffffff,
          map: strata,
          roughness: STONE_ROUGHNESS,
          metalness: STONE_METALNESS,
        }),
        top: new MeshStandardMaterial({
          color: 0xffffff,
          map: albedo,
          emissive: theme.trim,
          emissiveMap: runes,
          emissiveIntensity: tuning.runeEmissiveIntensity,
          roughness: STONE_ROUGHNESS,
          metalness: STONE_METALNESS,
        }),
        trim: glowMaterial(theme.trim, tuning.trimEmissiveIntensity),
      };
      this.themedTerrain.set(index, themed);
    }
    return themed;
  }

  spriteMaterial(kind: SpriteKind): SpriteMaterial {
    let material = this.spriteMaterials.get(kind);
    if (!material) {
      const colorByKind: Record<SpriteKind, number> = {
        mote: palette.eye,
        ring: palette.shard,
        dust: palette.terrainTop,
        spark: palette.shard,
        ember: palette.eye,
        portalMote: palette.portal,
      };
      const opacityByKind: Record<SpriteKind, number> = {
        mote: MOTE_SPRITE_OPACITY,
        ring: RING_SPRITE_OPACITY,
        dust: DUST_SPRITE_OPACITY,
        spark: SPARK_SPRITE_OPACITY,
        ember: EMBER_SPRITE_OPACITY,
        portalMote: PORTAL_MOTE_SPRITE_OPACITY,
      };
      material = new SpriteMaterial({
        map: kind === "ring" ? this.ringTexture() : this.softCircleTexture(),
        color: colorByKind[kind],
        opacity: opacityByKind[kind],
        transparent: true,
        blending: kind === "dust" ? NormalBlending : AdditiveBlending,
        depthWrite: false,
      });
      this.spriteMaterials.set(kind, material);
    }
    return material;
  }

  setDustTheme(world: number): void {
    this.spriteMaterial("dust").color.setHex(worldTheme(world).grout);
  }

  releaseSkiesExcept(world: number): void {
    const keep = Math.min(Math.max(Math.round(world), 1), 4);
    for (const [index, entry] of this.skyByWorld) {
      if (index !== keep) {
        entry.material.dispose();
        entry.texture.dispose();
        this.skyByWorld.delete(index);
      }
    }
  }

  motePointsMaterial(): PointsMaterial {
    this.motePoints ??= new PointsMaterial({
      map: this.softCircleTexture(),
      color: palette.eye,
      size: MOTE_POINT_SIZE,
      sizeAttenuation: true,
      transparent: true,
      opacity: MOTE_SPRITE_OPACITY,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return this.motePoints;
  }

  createBlobShadowMaterial(): MeshBasicMaterial {
    return new MeshBasicMaterial({
      map: this.softCircleTexture(),
      color: palette.bg0,
      transparent: true,
      opacity: tuning.blobShadowOpacity,
      depthWrite: false,
    });
  }

  skyMaterial(world = 1): MeshBasicMaterial {
    const index = Math.min(Math.max(Math.round(world), 1), 4);
    let entry = this.skyByWorld.get(index);
    if (!entry) {
      const texture = createSkyGradientTexture(worldTheme(index));
      entry = {
        material: new MeshBasicMaterial({
          map: texture,
          side: BackSide,
          fog: false,
        }),
        texture,
      };
      this.skyByWorld.set(index, entry);
    }
    return entry.material;
  }

  distantIslandMaterial(world = 1): MeshBasicMaterial {
    const index = Math.min(Math.max(Math.round(world), 1), 4);
    let material = this.islandByWorld.get(index);
    if (!material) {
      material = new MeshBasicMaterial({
        color: worldTheme(index).island,
        fog: false,
      });
      this.islandByWorld.set(index, material);
    }
    return material;
  }

  gridTexture(): CanvasTexture {
    return this.texture("grid");
  }

  softCircleTexture(): CanvasTexture {
    return this.texture("softCircle");
  }

  ringTexture(): CanvasTexture {
    return this.texture("ring");
  }

  dispose(): void {
    for (const material of this.materials.values()) {
      material.dispose();
    }
    this.materials.clear();
    for (const material of this.spriteMaterials.values()) {
      material.dispose();
    }
    this.spriteMaterials.clear();
    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    this.textures.clear();
    for (const themed of this.themedTerrain.values()) {
      themed.body.dispose();
      themed.top.dispose();
      themed.trim.dispose();
    }
    this.themedTerrain.clear();
    for (const list of this.themedTextures.values()) {
      for (const texture of list) {
        texture.dispose();
      }
    }
    this.themedTextures.clear();
    for (const entry of this.skyByWorld.values()) {
      entry.material.dispose();
      entry.texture.dispose();
    }
    this.skyByWorld.clear();
    for (const material of this.islandByWorld.values()) {
      material.dispose();
    }
    this.islandByWorld.clear();
    this.motePoints?.dispose();
    this.motePoints = undefined;
  }

  private texture(key: TextureKey): CanvasTexture {
    let texture = this.textures.get(key);
    if (!texture) {
      switch (key) {
        case "grid":
          texture = createGridTexture();
          break;
        case "softCircle":
          texture = createSoftCircleTexture();
          break;
        case "ring":
          texture = createRingTexture();
          break;
      }
      this.textures.set(key, texture);
    }
    return texture;
  }

  private createMaterial(key: StandardMaterialKey): MeshStandardMaterial {
    switch (key) {
      case "terrain":
        return new MeshStandardMaterial({
          color: palette.terrain,
          roughness: STONE_ROUGHNESS,
          metalness: STONE_METALNESS,
        });
      case "terrainTop":
        return new MeshStandardMaterial({
          color: palette.terrainTop,
          roughness: STONE_ROUGHNESS,
          metalness: STONE_METALNESS,
          map: this.gridTexture(),
        });
      case "trim":
        return glowMaterial(
          palette.worldAccents[0],
          tuning.trimEmissiveIntensity,
        );
      case "player":
        return new MeshStandardMaterial({
          color: palette.player,
          roughness: PLAYER_ROUGHNESS,
          metalness: PLAYER_METALNESS,
        });
      case "eye":
        return glowMaterial(palette.eye, EYE_EMISSIVE_INTENSITY);
      case "shard": {
        const material = glowMaterial(palette.shard, SHARD_EMISSIVE_INTENSITY);
        material.flatShading = true;
        return material;
      }
      case "hazard": {
        const material = glowMaterial(
          palette.hazard,
          HAZARD_EMISSIVE_INTENSITY,
        );
        material.flatShading = true;
        return material;
      }
      case "portalDormant":
        return glowMaterial(palette.portal, PORTAL_DORMANT_EMISSIVE_INTENSITY);
      case "portalActive":
        return glowMaterial(palette.portal, PORTAL_ACTIVE_EMISSIVE_INTENSITY);
      case "portalStone":
        return new MeshStandardMaterial({
          color: palette.terrain,
          roughness: STONE_ROUGHNESS,
          metalness: STONE_METALNESS,
        });
      case "bouncer":
        return glowMaterial(palette.bouncer, BOUNCER_EMISSIVE_INTENSITY);
    }
  }
}
