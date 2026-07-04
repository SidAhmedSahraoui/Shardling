import { Color, PerspectiveCamera, Scene, WebGLRenderer } from "three";

import { palette } from "../config/palette";
import { tuning } from "../config/tuning";
import { PostFX } from "../gfx/PostFX";
import type { DeviceProfile } from "./Device";

export class App {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly profile: DeviceProfile;

  private readonly postfx: PostFX;
  private readonly container: HTMLElement;
  private resizeRaf = 0;
  private dprQuery: MediaQueryList | null = null;
  private readonly onWindowResize = (): void => {
    this.resize();
    if (this.resizeRaf === 0) {
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = 0;
        this.resize();
      });
    }
  };
  private readonly onDprChange = (): void => {
    this.resize();
    this.watchDpr();
  };

  constructor(container: HTMLElement, profile: DeviceProfile) {
    this.container = container;
    this.profile = profile;
    this.renderer = new WebGLRenderer({ antialias: false });
    this.renderer.setClearColor(new Color(palette.bg0));
    this.renderer.shadowMap.enabled = profile.shadowMaps;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(tuning.camFov, 1, 0.1, 200);
    container.appendChild(this.renderer.domElement);
    this.postfx = new PostFX(this.renderer, this.scene, this.camera, profile);
    this.resize();
    window.addEventListener("resize", this.onWindowResize);
    this.watchDpr();
  }

  private watchDpr(): void {
    this.dprQuery?.removeEventListener("change", this.onDprChange);
    this.dprQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    this.dprQuery.addEventListener("change", this.onDprChange);
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.profile.maxDpr),
    );
    this.renderer.setSize(width, height);
    this.postfx.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(frameDtSec: number): void {
    this.postfx.render(frameDtSec);
  }

  dispose(): void {
    window.removeEventListener("resize", this.onWindowResize);
    this.dprQuery?.removeEventListener("change", this.onDprChange);
    if (this.resizeRaf !== 0) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = 0;
    }
    this.postfx.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
