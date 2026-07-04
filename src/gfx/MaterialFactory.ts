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

import { palette } from "../config/palette";
import { tuning } from "../config/tuning";

export type StandardMaterialKey =
  | "terrain"
  | "terrainTop"
  | "player"
  | "eye"
  | "shard"
  | "hazard"
  | "portalDormant"
  | "portalActive"
  | "portalStone"
  | "bouncer";

type TextureKey = "grid" | "softCircle" | "ring" | "skyGradient";

export type SpriteKind =
  "mote" | "ring" | "dust" | "spark" | "ember" | "portalMote";

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
const SKY_TEXTURE_WIDTH = 4;
const SKY_TEXTURE_HEIGHT = 256;

function css(hex: number): string {
  return new Color(hex).getStyle();
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

function createSkyGradientTexture(): CanvasTexture {
  const { canvas, ctx } = createCanvas(SKY_TEXTURE_WIDTH, SKY_TEXTURE_HEIGHT);
  const gradient = ctx.createLinearGradient(0, 0, 0, SKY_TEXTURE_HEIGHT);
  gradient.addColorStop(0, css(palette.bg0));
  gradient.addColorStop(1, css(palette.bg1));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SKY_TEXTURE_WIDTH, SKY_TEXTURE_HEIGHT);
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
  private sky: MeshBasicMaterial | undefined;
  private motePoints: PointsMaterial | undefined;

  material(key: StandardMaterialKey): MeshStandardMaterial {
    let material = this.materials.get(key);
    if (!material) {
      material = this.createMaterial(key);
      this.materials.set(key, material);
    }
    return material;
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

  skyMaterial(): MeshBasicMaterial {
    if (!this.sky) {
      this.sky = new MeshBasicMaterial({
        map: this.skyGradientTexture(),
        side: BackSide,
        fog: false,
      });
    }
    return this.sky;
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

  skyGradientTexture(): CanvasTexture {
    return this.texture("skyGradient");
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
    this.sky?.dispose();
    this.sky = undefined;
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
        case "skyGradient":
          texture = createSkyGradientTexture();
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
