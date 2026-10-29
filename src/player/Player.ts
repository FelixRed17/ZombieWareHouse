import type { PerspectiveCamera, Vector3 } from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GAME_CONFIG } from '../shared/config';
import type { WorldQuery } from '../shared/types';
import { PlayerMovement } from './PlayerMovement';

export class Player {
  readonly controls: PointerLockControls;
  private readonly movement = new PlayerMovement();

  constructor(readonly camera: PerspectiveCamera, element: HTMLElement) {
    this.controls = new PointerLockControls(camera, element);
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI - 0.12;
    this.controls.addEventListener('unlock', () => this.movement.clear());
    this.reset();
  }

  get position(): Vector3 { return this.camera.position; }

  reset(): void {
    this.movement.clear();
    this.camera.position.set(0, GAME_CONFIG.player.eyeHeight, 18);
    this.camera.rotation.set(0, 0, 0);
  }

  update(dtSeconds: number, world: WorldQuery): void {
    if (this.controls.isLocked) this.movement.update(dtSeconds, this.camera, world);
  }

  dispose(): void {
    this.movement.dispose();
    this.controls.unlock();
    this.controls.dispose();
  }
}
