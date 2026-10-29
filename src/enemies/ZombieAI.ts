import type { Vector3 } from 'three';
import type { WorldQuery } from '../shared/types';
import type { Zombie } from './Zombie';

/** TEAM 2 STUB: returns attack damage for Game to apply once. */
export class ZombieAI {
  update(_zombie: Zombie, _dtSeconds: number, _playerPosition: Vector3, _world: WorldQuery): number {
    // TODO(P2-02): seek, steer around obstacles, attack in range with a cooldown.
    return 0;
  }
}
