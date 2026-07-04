import type { MeshBasicMaterial, Scene } from "three";
import { CircleGeometry, Mesh } from "three";

import { tuning } from "../config/tuning";
import type { MaterialFactory } from "./MaterialFactory";

const CIRCLE_SEGMENTS = 32;
const SURFACE_LIFT = 0.02;
const SHADOW_RENDER_ORDER = 1;

export interface BlobShadowOptions {
  scene: Scene;
  materials: MaterialFactory;
  radius?: number;
}

export class BlobShadow {
  private readonly scene: Scene;
  private readonly material: MeshBasicMaterial;
  private readonly mesh: Mesh;
  private enabled = true;

  constructor(opts: BlobShadowOptions) {
    this.scene = opts.scene;
    this.material = opts.materials.createBlobShadowMaterial();

    const geometry = new CircleGeometry(
      opts.radius ?? tuning.blobShadowRadius,
      CIRCLE_SEGMENTS,
    );
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.name = "blobShadow";
    this.mesh.renderOrder = SHADOW_RENDER_ORDER;
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  update(
    ballPos: { x: number; y: number; z: number },
    groundY: number | null,
  ): void {
    if (!this.enabled || groundY === null) {
      this.mesh.visible = false;
      return;
    }
    const height = ballPos.y - groundY;
    if (height >= tuning.blobShadowMaxHeight) {
      this.mesh.visible = false;
      return;
    }

    const t = Math.max(height, 0) / tuning.blobShadowMaxHeight;
    const scale = 1 + (tuning.blobShadowMinScale - 1) * t;
    this.material.opacity = tuning.blobShadowOpacity * (1 - t);
    this.mesh.scale.set(scale, 1, scale);
    this.mesh.position.set(ballPos.x, groundY + SURFACE_LIFT, ballPos.z);
    this.mesh.visible = true;
  }

  setVisible(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.mesh.visible = false;
    }
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
