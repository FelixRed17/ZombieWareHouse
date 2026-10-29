import { Group } from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { Damageable } from '../shared/types';

/** TEAM 2: add a procedural body first, then optional GLB + AnimationMixer. */
export class Zombie implements Damageable {
  readonly root = new Group();
  private health: number = GAME_CONFIG.zombie.health;

  constructor(readonly id: string) { this.root.name = id; }

  get isAlive(): boolean { return this.health > 0; }

  takeDamage(amount: number): boolean {
    if (!this.isAlive) return false;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    return !this.isAlive;
  }

  update(_dtSeconds: number): void {
    // TODO(P2-01): advance mixer/death cleanup using simulation time.
  }

  dispose(): void {
    this.root.removeFromParent();
    // TODO(P2-01): dispose only resources owned by this instance.
  }
}
