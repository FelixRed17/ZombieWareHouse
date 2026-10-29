import type { Scene, Vector3 } from 'three';
import type { PickupEffect } from '../shared/types';

/** TEAM 3 STUB: no pickup models or effects are spawned in the preview. */
export class Pickups {
  constructor(readonly scene: Scene) {}

  update(_dtSeconds: number, _playerPosition: Vector3): readonly PickupEffect[] {
    // TODO(P3-02): proximity collection; return each effect exactly once.
    return [];
  }

  reset(): void {
    // TODO(P3-02): clear items, recreate fixed valid pickup locations.
  }

  dispose(): void {
    // TODO(P3-02): clear items and dispose owned mesh resources.
  }
}
