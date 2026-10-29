import { Vector3 } from 'three';
import type { Camera } from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { WorldQuery } from '../shared/types';

/** Basic grounded preview movement. Team 1 owns input and movement refinements. */
export class PlayerMovement {
  private readonly keys = new Set<string>();
  private readonly blockedUntilRelease = new Set<string>();
  private active = false;
  private readonly events = new AbortController();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly direction = new Vector3();
  private readonly candidate = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor() {
    const options = { signal: this.events.signal };
    window.addEventListener('keydown', this.onKeyDown, options);
    window.addEventListener('keyup', this.onKeyUp, options);
    window.addEventListener('blur', this.deactivate, options);
    document.addEventListener('visibilitychange', this.onVisibilityChange, options);
  }

  update(dtSeconds: number, camera: Camera, world: WorldQuery): void {
    // There is no vertical movement in this prototype; keep the grounded eye point fixed.
    camera.position.y = GAME_CONFIG.player.eyeHeight;
    const forwardInput = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const rightInput = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    // Flatten before normalization so pitch never changes horizontal speed.
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

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.clear();
  }

  clear(): void {
    // If keyup is lost during a pause/focus change, require a fresh release before reuse.
    for (const code of this.keys) this.blockedUntilRelease.add(code);
    this.keys.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.isMovementKey(event.code)) return;
    if (!this.active) {
      this.blockedUntilRelease.add(event.code);
      return;
    }
    if (!this.blockedUntilRelease.has(event.code)) this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    this.blockedUntilRelease.delete(event.code);
  };

  private readonly deactivate = (): void => this.setActive(false);

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.deactivate();
  };

  private isMovementKey(code: string): boolean {
    return code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' ||
      code === 'ShiftLeft' || code === 'ShiftRight';
  }

  dispose(): void {
    this.events.abort();
    this.active = false;
    this.keys.clear();
    this.blockedUntilRelease.clear();
  }
}
