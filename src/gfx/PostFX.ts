/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { HalfFloatType, Vector2 } from "three";

import { tuning } from "../config/tuning";
import type { DeviceProfile } from "../core/Device";

const BLOOM_RESOLUTION_SCALE = 0.5;
const SMAA_PRESET = SMAAPreset.MEDIUM;

export class PostFX {
  private readonly renderer: WebGLRenderer;
  private readonly profile: DeviceProfile;
  private readonly composer: EffectComposer;
  private readonly bloom: BloomEffect;
  private readonly grain: NoiseEffect;
  private readonly scratchSize = new Vector2();

  constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    profile: DeviceProfile,
  ) {
    this.renderer = renderer;
    this.profile = profile;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.renderer.toneMappingExposure = tuning.toneMappingExposure;

    this.composer = new EffectComposer(
      renderer,
      profile.tier === "hi" ? { frameBufferType: HalfFloatType } : undefined,
    );

    this.bloom = new BloomEffect({
      mipmapBlur: true,
      intensity: tuning.bloomIntensity,
      luminanceThreshold: tuning.bloomLuminanceThreshold,
      luminanceSmoothing: tuning.bloomLuminanceSmoothing,
    });
    const toneMapping = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    });
    this.grain = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply: true,
    });
    this.grain.blendMode.opacity.value = tuning.filmGrainOpacity;
    const vignette = new VignetteEffect({
      offset: tuning.vignetteOffset,
      darkness: tuning.vignetteDarkness,
    });
    const effects = this.profile.smaa
      ? [
          new SMAAEffect({ preset: SMAA_PRESET }),
          this.bloom,
          toneMapping,
          this.grain,
          vignette,
        ]
      : [this.bloom, toneMapping, this.grain, vignette];

    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new EffectPass(camera, ...effects));

    const size = renderer.getSize(this.scratchSize);
    this.setSize(size.width, size.height);
  }

  setReduceMotion(reduce: boolean): void {
    this.grain.blendMode.opacity.value = reduce ? 0 : tuning.filmGrainOpacity;
  }

  render(frameDtSec: number): void {
    this.composer.render(frameDtSec);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    if (this.profile.bloomHalfRes) {
      const draw = this.renderer.getDrawingBufferSize(this.scratchSize);
      this.bloom.setSize(
        Math.max(1, Math.round(draw.width * BLOOM_RESOLUTION_SCALE)),
        Math.max(1, Math.round(draw.height * BLOOM_RESOLUTION_SCALE)),
      );
    }
  }

  dispose(): void {
    this.composer.dispose();
  }
}
