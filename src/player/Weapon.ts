import type { Object3D, PerspectiveCamera } from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { Damageable, ShotResult, WeaponSnapshot } from '../shared/types';

/** TEAM 1 STUB: typed combat boundary. Preview deliberately does not fire. */
export class Weapon {
  private ammo: number = GAME_CONFIG.weapon.magazineSize;
  private reserve: number = GAME_CONFIG.weapon.startingReserve;
  private isReloading = false;

  constructor(readonly camera: PerspectiveCamera) {}

  get snapshot(): WeaponSnapshot {
    return { ammo: this.ammo, reserve: this.reserve, isReloading: this.isReloading };
  }

  tryShoot(_targets: readonly Damageable[], _blockers: readonly Object3D[]): ShotResult | null {
    // TODO(P1-02): cooldown, ammo, recursive center raycast, cover occlusion, damage.
    return null;
  }

  reload(): boolean {
    // TODO(P1-03): use simulation time; transfer reserve only on completion.
    return false;
  }

  update(_dtSeconds: number): void {
    // TODO(P1-03): advance fire/reload timers only while playing.
  }

  addAmmo(amount: number): void { this.reserve += Math.max(0, Math.floor(amount)); }

  reset(): void {
    this.ammo = GAME_CONFIG.weapon.magazineSize;
    this.reserve = GAME_CONFIG.weapon.startingReserve;
    this.isReloading = false;
  }

  dispose(): void {
    // TODO(P1-04): dispose owned weapon view-model resources.
  }
}
