import type { Scene, Vector3 } from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { Damageable, WorldQuery } from '../shared/types';
import { EnemyBase } from './EnemyBase';
import { FlyingPumpkin } from './FlyingPumpkin';
import { Zombie } from './Zombie';
import { ZombieAI } from './ZombieAI';

const PUMPKIN_SPAWN_EVERY = 4;

/** Owns enemy lifetime, round pacing and the shared active enemy cap. */
export class ZombieSpawner {
  private readonly enemies: EnemyBase[] = [];
  private readonly ai = new ZombieAI();
  private spawnElapsedSeconds = 0;
  private nextSpawnIntervalSeconds: number = GAME_CONFIG.spawning.initialIntervalSeconds;
  private nextId = 1;
  private spawnedThisRound = 0;

  constructor(readonly scene: Scene) {}

  update(dtSeconds: number, elapsedSeconds: number, playerPosition: Vector3, world: WorldQuery): number {
    const dt = Math.max(0, dtSeconds);
    let damage = 0;
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      enemy.update(dt);
      if (enemy.isAlive) {
        damage += this.ai.update(enemy, dt, playerPosition, world);
      } else if (enemy.isCleanupReady) {
        enemy.dispose();
        this.enemies.splice(index, 1);
      }
    }

    const liveCount = this.enemies.reduce((count, enemy) => count + Number(enemy.isAlive), 0);
    if (liveCount >= GAME_CONFIG.spawning.maxAlive) {
      // Do not bank a backlog while full; a newly free slot waits a full interval.
      this.spawnElapsedSeconds = 0;
      return damage;
    }

    this.spawnElapsedSeconds += dt;
    if (this.spawnElapsedSeconds < this.nextSpawnIntervalSeconds - 1e-9) return damage;

    const spawnPoint = this.chooseSpawnPoint(playerPosition, world);
    if (!spawnPoint) return damage;
    const idNumber = this.nextId++;
    this.spawnedThisRound += 1;
    const enemy = this.spawnedThisRound % PUMPKIN_SPAWN_EVERY === 0
      ? new FlyingPumpkin(`pumpkin-${idNumber}`)
      : new Zombie(`zombie-${idNumber}`);
    enemy.spawnAt(spawnPoint);
    this.scene.add(enemy.root);
    this.enemies.push(enemy);
    this.spawnElapsedSeconds = 0;
    this.nextSpawnIntervalSeconds = Math.max(
      GAME_CONFIG.spawning.minimumIntervalSeconds,
      GAME_CONFIG.spawning.initialIntervalSeconds - Math.max(0, elapsedSeconds) / 90,
    );
    return damage;
  }

  getTargets(): readonly Damageable[] {
    return this.enemies.filter((enemy) => enemy.isAlive);
  }

  reset(): void {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies.length = 0;
    this.spawnElapsedSeconds = 0;
    this.nextSpawnIntervalSeconds = GAME_CONFIG.spawning.initialIntervalSeconds;
    this.spawnedThisRound = 0;
    this.ai.reset();
  }

  dispose(): void { this.reset(); }

  private chooseSpawnPoint(playerPosition: Vector3, world: WorldQuery): Vector3 | null {
    const radius = GAME_CONFIG.zombie.radius;
    const valid: { point: Vector3; space: number }[] = [];
    for (const source of world.spawnPoints) {
      const point = source.clone();
      point.y = 0;
      const playerDistance = Math.hypot(point.x - playerPosition.x, point.z - playerPosition.z);
      if (playerDistance < GAME_CONFIG.spawning.minPlayerDistance) continue;
      if (point.x - radius < world.bounds.min.x || point.x + radius > world.bounds.max.x ||
          point.z - radius < world.bounds.min.z || point.z + radius > world.bounds.max.z) continue;
      if (!world.canOccupy(point, radius)) continue;

      let nearestZombie = Number.POSITIVE_INFINITY;
      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue;
        const dx = point.x - enemy.root.position.x;
        const dz = point.z - enemy.root.position.z;
        nearestZombie = Math.min(nearestZombie, dx * dx + dz * dz);
      }
      valid.push({ point, space: nearestZombie });
    }
    if (valid.length === 0) return null;
    valid.sort((a, b) => b.space - a.space);
    return valid[0].point;
  }
}
