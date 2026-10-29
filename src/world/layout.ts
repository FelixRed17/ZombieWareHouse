import { GAME_CONFIG } from '../shared/config';
import type { PropKind } from './PropFactory';

/** Single placement source for rendering and collision. Upright props only. */
export interface PropPlacement {
  readonly kind: PropKind;
  readonly x: number;
  readonly z: number;
  readonly scale?: readonly [number, number, number];
}
export const ARENA = GAME_CONFIG.warehouse;
export const SPAWNS = [[-15, -22], [15, -22], [-15, 22], [15, 22]] as const;
export interface PickupLocation {
  readonly kind: 'health' | 'ammo';
  readonly x: number;
  readonly z: number;
  readonly respawnSeconds: number;
}
/** Pickup positions and active-time respawns are world-owned placement data. */
export const PICKUP_LOCATIONS = Object.freeze([
  Object.freeze({ kind: 'ammo', x: -10, z: -12, respawnSeconds: 15 }),
  Object.freeze({ kind: 'ammo', x: 10, z: 12, respawnSeconds: 15 }),
  Object.freeze({ kind: 'health', x: 10, z: -12, respawnSeconds: 30 }),
  Object.freeze({ kind: 'health', x: -10, z: 12, respawnSeconds: 30 }),
] as const satisfies readonly PickupLocation[]);
export const PICKUP_CLEARINGS = Object.freeze(
  PICKUP_LOCATIONS.map(({ x, z }) => Object.freeze([x, z] as const)),
);
export const PROPS: readonly PropPlacement[] = [
  ...[-18, -6, 6, 18].flatMap(z => [-17, 17].map(x => ({ kind: 'rack' as const, x, z }))),
  // Sparse ground loads leave every second rack bay open end-to-end.
  ...[-6, 18].flatMap(z => [-17, 17].map(x => ({ kind: 'crate' as const, x, z, scale: [2.4, 2, 3.2] as const }))),
  { kind: 'crate', x: -7, z: -7, scale: [3, 2, 3] },
  { kind: 'crate', x: 7, z: 4, scale: [2, 1.5, 2] },
  { kind: 'crate', x: -8, z: 8, scale: [1.5, 1.3, 1.5] },
  { kind: 'barrel', x: 8, z: -5 }, { kind: 'barrel', x: 8.8, z: -5.3 },
  { kind: 'barrel', x: -8, z: 10 },
  { kind: 'pallet', x: 7, z: 7 }, { kind: 'pallet', x: -12, z: -3 },
];
export const LIGHT_POSITIONS = [[-4, 7, -18], [-4, 7, 0], [-4, 7, 18], [13, 5, -10]] as const;
