import type { Scene, Vector3 } from 'three';
import type { Damageable, WorldQuery } from '../shared/types';
import { Zombie } from './Zombie';
import { ZombieAI } from './ZombieAI';

/** TEAM 2 STUB: no enemies spawn until P2-01 through P2-03 are implemented. */
export class ZombieSpawner {
  private readonly zombies: Zombie[] = [];
  private readonly ai = new ZombieAI();

  constructor(readonly scene: Scene) {}

  update(dtSeconds: number, _elapsedSeconds: number, playerPosition: Vector3, world: WorldQuery): number {
    // TODO(P2-03): accumulate spawn time; choose valid points and cap live count.
    let damage = 0;
    for (const zombie of this.zombies) {
      zombie.update(dtSeconds);
      if (zombie.isAlive) damage += this.ai.update(zombie, dtSeconds, playerPosition, world);
    }
    return damage;
  }

  getTargets(): readonly Damageable[] { return this.zombies.filter((zombie) => zombie.isAlive); }

  reset(): void {
    for (const zombie of this.zombies) zombie.dispose();
    this.zombies.length = 0;
    // TODO(P2-03): reset spawn/AI timers and ID sequence as appropriate.
  }

  dispose(): void { this.reset(); }
}
