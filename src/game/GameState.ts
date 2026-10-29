import { GAME_CONFIG } from '../shared/config';
import type { GamePhase, GameSnapshot, WeaponSnapshot } from '../shared/types';

export class GameState {
  phase: GamePhase = 'menu';
  health: number = GAME_CONFIG.maxHealth;
  elapsedSeconds = 0;
  kills = 0;

  get remainingSeconds(): number {
    return Math.max(0, GAME_CONFIG.roundSeconds - this.elapsedSeconds);
  }

  reset(): void {
    this.health = GAME_CONFIG.maxHealth;
    this.elapsedSeconds = 0;
    this.kills = 0;
    this.phase = 'playing';
  }

  damage(amount: number): void {
    if (this.phase !== 'playing') return;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    if (this.health === 0) this.phase = 'gameOver';
  }

  heal(amount: number): void {
    if (this.phase !== 'playing') return;
    this.health = Math.min(GAME_CONFIG.maxHealth, this.health + Math.max(0, amount));
  }

  advance(dtSeconds: number): void {
    if (this.phase !== 'playing') return;
    this.elapsedSeconds = Math.min(GAME_CONFIG.roundSeconds, this.elapsedSeconds + Math.max(0, dtSeconds));
    if (this.remainingSeconds === 0) this.phase = 'victory';
  }

  snapshot(weapon: WeaponSnapshot): GameSnapshot {
    return { phase: this.phase, health: this.health, remainingSeconds: this.remainingSeconds, kills: this.kills, weapon };
  }
}
