import { Vector3 } from 'three';
import type { Camera } from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { WorldQuery } from '../shared/types';

/** Basic grounded preview movement. Team 1 owns input and movement refinements. */
export class PlayerMovement {
  private readonly keys = new Set<string>();
  private readonly events = new AbortController();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly direction = new Vector3();
  private readonly candidate = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor() {
    const options = { signal: this.events.signal };
    window.addEventListener('keydown', (event) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) this.keys.add(event.code);
    }, options);
    window.addEventListener('keyup', (event) => this.keys.delete(event.code), options);
    window.addEventListener('blur', () => this.clear(), options);
  }

  update(dtSeconds: number, camera: Camera, world: WorldQuery): void {
    const forwardInput = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const rightInput = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    this.right.crossVectors(this.forward, this.up).normalize();
    this.direction.copy(this.forward).multiplyScalar(forwardInput).addScaledVector(this.right, rightInput).normalize();
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.direction.multiplyScalar(dtSeconds * (sprint ? GAME_CONFIG.player.sprintSpeed : GAME_CONFIG.player.walkSpeed));

    // Resolve axes separately so the player slides along crate and wall edges.
    this.candidate.copy(camera.position);
    this.candidate.x += this.direction.x;
    if (world.canOccupy(this.candidate, GAME_CONFIG.player.radius)) camera.position.x = this.candidate.x;
    this.candidate.copy(camera.position);
    this.candidate.z += this.direction.z;
    if (world.canOccupy(this.candidate, GAME_CONFIG.player.radius)) camera.position.z = this.candidate.z;
  }

  clear(): void { this.keys.clear(); }

  dispose(): void {
    this.events.abort();
    this.clear();
  }
}
