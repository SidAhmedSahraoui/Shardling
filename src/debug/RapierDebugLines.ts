import type { World } from "@dimforge/rapier3d-compat";
import type { Scene } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  LineBasicMaterial,
  LineSegments,
} from "three";

const INITIAL_VERTEX_CAPACITY = 1024;

export class RapierDebugLines {
  private readonly scene: Scene;
  private readonly lines: LineSegments;
  private readonly material: LineBasicMaterial;
  private positionAttr: BufferAttribute;
  private positionArray: Float32Array;
  private colorAttr: BufferAttribute;
  private colorArray: Float32Array;
  private capacity: number;

  constructor(scene: Scene) {
    this.scene = scene;
    this.material = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
    });

    this.capacity = INITIAL_VERTEX_CAPACITY;
    this.positionArray = new Float32Array(this.capacity * 3);
    this.positionAttr = new BufferAttribute(this.positionArray, 3);
    this.positionAttr.setUsage(DynamicDrawUsage);
    this.colorArray = new Float32Array(this.capacity * 4);
    this.colorAttr = new BufferAttribute(this.colorArray, 4);
    this.colorAttr.setUsage(DynamicDrawUsage);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", this.positionAttr);
    geometry.setAttribute("color", this.colorAttr);
    geometry.setDrawRange(0, 0);

    this.lines = new LineSegments(geometry, this.material);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    scene.add(this.lines);
  }

  update(world: World | null): void {
    if (world === null) {
      this.lines.visible = false;
      return;
    }
    const buffers = world.debugRender();
    const vertexCount = buffers.vertices.length / 3;
    this.ensureCapacity(vertexCount);
    this.positionArray.set(buffers.vertices);
    this.colorArray.set(buffers.colors);
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, vertexCount);
    this.lines.visible = true;
  }

  destroy(): void {
    this.scene.remove(this.lines);
    this.lines.geometry.dispose();
    this.material.dispose();
  }

  private ensureCapacity(vertexCount: number): void {
    if (vertexCount <= this.capacity) {
      return;
    }
    let capacity = this.capacity;
    while (capacity < vertexCount) {
      capacity *= 2;
    }
    this.positionArray = new Float32Array(capacity * 3);
    this.positionAttr = new BufferAttribute(this.positionArray, 3);
    this.positionAttr.setUsage(DynamicDrawUsage);
    this.colorArray = new Float32Array(capacity * 4);
    this.colorAttr = new BufferAttribute(this.colorArray, 4);
    this.colorAttr.setUsage(DynamicDrawUsage);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", this.positionAttr);
    geometry.setAttribute("color", this.colorAttr);

    const old = this.lines.geometry;
    this.lines.geometry = geometry;
    old.dispose();
    this.capacity = capacity;
  }
}
