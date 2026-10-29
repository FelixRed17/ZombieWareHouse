import type { Box3, Object3D, Vector3 } from 'three';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameOver' | 'victory';
export type PickupKind = 'health' | 'ammo';

export interface WeaponSnapshot {
  readonly ammo: number;
  readonly reserve: number;
  readonly isReloading: boolean;
}

/** HUD receives values only; it must not mutate gameplay state. */
export interface GameSnapshot {
  readonly phase: GamePhase;
  readonly health: number;
  readonly remainingSeconds: number;
  readonly kills: number;
  readonly weapon: WeaponSnapshot;
}

/** Shared by player movement and zombie AI. Coordinates are in world space. */
export interface WorldQuery {
  readonly bounds: Box3;
  readonly shotBlockers: readonly Object3D[];
  readonly spawnPoints: readonly Vector3[];
  canOccupy(position: Vector3, radius: number): boolean;
}

/** Roots include child meshes. Walk up from raycast hits to match a root. */
export interface Damageable {
  readonly id: string;
  readonly root: Object3D;
  readonly isAlive: boolean;
  /** True only on the live-to-dead transition, so one kill is counted once. */
  takeDamage(amount: number): boolean;
}

/** Null from tryShoot means no shot was fired; a miss still returns a result. */
export interface ShotResult {
  readonly hitId: string | null;
  readonly killed: boolean;
}

/** Consumed once by Game. Pickups never modify Player or GameState directly. */
export interface PickupEffect {
  readonly kind: PickupKind;
  readonly amount: number;
}
