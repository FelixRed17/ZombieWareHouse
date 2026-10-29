import type { PickupEffect, ShotResult } from '../shared/types';
import type { GameState } from './GameState';

/** The production gameplay boundary used by Game and the deterministic harness. */
export interface GameplayFrameSystems {
  movePlayer(dtSeconds: number): void;
  advanceWeapon(dtSeconds: number): void;
  updateEnemies(dtSeconds: number, elapsedSeconds: number): number;
  updatePickups(dtSeconds: number): readonly PickupEffect[];
  addAmmo(amount: number): void;
}

/**
 * Advances one active simulation frame in the documented order.
 * Returns false when the game is paused, terminal, or lacks active capture.
 */
export function runGameplayFrame(
  dtSeconds: number,
  hasActiveCapture: boolean,
  state: GameState,
  systems: GameplayFrameSystems,
): boolean {
  if (!hasActiveCapture || state.phase !== 'playing') return false;

  systems.movePlayer(dtSeconds);
  systems.advanceWeapon(dtSeconds);
  state.damage(systems.updateEnemies(dtSeconds, state.elapsedSeconds));

  // Fatal damage ends this frame before a pickup can heal or the timer can win.
  if (state.phase !== 'playing') return true;

  for (const effect of systems.updatePickups(dtSeconds)) {
    if (effect.kind === 'health') state.heal(effect.amount);
    else systems.addAmmo(effect.amount);
  }
  state.advance(dtSeconds);
  return true;
}

/** Game awards a kill only for a fresh death transition from the weapon. */
export function applyShotResult(state: GameState, shot: ShotResult | null): void {
  if (shot?.killed) state.kills += 1;
}

/** Route shooting/reload requests only during active, captured play. */
export function routeCombatInput(state: GameState, hasActiveCapture: boolean, action: () => void): boolean {
  if (state.phase !== 'playing' || !hasActiveCapture) return false;
  action();
  return true;
}

/** Resume the same run without touching health, time, kills, or subsystem state. */
export function resumeRun(state: GameState): void {
  if (state.phase === 'paused') state.phase = 'playing';
}

/** Keep a terminal phase intact when releasing pointer lock after an outcome. */
export function pauseOnUnlock(state: GameState): void {
  if (state.phase === 'playing') state.phase = 'paused';
}

/** Run the existing subsystem reset methods in one production/testable path. */
export interface RunResetMethods {
  resetPlayer(): void;
  resetWeapon(): void;
  resetEnemies(): void;
  resetPickups(): void;
  resetState(): void;
}

export function resetRun(methods: RunResetMethods): void {
  methods.resetPlayer();
  methods.resetWeapon();
  methods.resetEnemies();
  methods.resetPickups();
  methods.resetState();
}
