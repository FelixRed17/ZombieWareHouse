import { Vector3 } from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { Damageable, WorldQuery } from '../shared/types';

const GRID_CELL_SIZE = 1;
const NEIGHBORS = [
  { x: 1, z: 0, cost: 1 }, { x: -1, z: 0, cost: 1 },
  { x: 0, z: 1, cost: 1 }, { x: 0, z: -1, cost: 1 },
  { x: 1, z: 1, cost: Math.SQRT2 }, { x: 1, z: -1, cost: Math.SQRT2 },
  { x: -1, z: 1, cost: Math.SQRT2 }, { x: -1, z: -1, cost: Math.SQRT2 },
] as const;
const STEERING_ANGLES = [30, -30, 60, -60, 90, -90, 135, -135, 180].map((degrees) => degrees * Math.PI / 180);
const DISTANCE_EPSILON = 0.001;

interface NavigationGrid {
  readonly minX: number;
  readonly minZ: number;
  readonly columns: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly walkable: Uint8Array;
  cellAt(x: number, z: number): number;
  centerOf(index: number, y?: number): Vector3;
  isWalkable(index: number): boolean;
  findClosestWalkable(position: Vector3): number;
  findPath(start: number, goal: number): number[];
}

interface ZombieState {
  attackCooldownRemaining: number;
  routeTargetCell: number;
  route: number[];
  routeIndex: number;
  routeComputed: boolean;
}

/** Pursuit, obstacle routing and attack timing for each enemy instance. */
export class ZombieAI {
  private states = new WeakMap<Damageable, ZombieState>();
  private grids = new WeakMap<WorldQuery, NavigationGrid>();
  private readonly direct = new Vector3();
  private readonly candidate = new Vector3();
  private readonly destination = new Vector3();

  update(enemy: Damageable, dtSeconds: number, playerPosition: Vector3, world: WorldQuery): number {
    if (!enemy.isAlive) return 0;
    const state = this.stateFor(enemy);
    const dt = Math.max(0, dtSeconds);
    state.attackCooldownRemaining = Math.max(0, state.attackCooldownRemaining - dt);

    const position = enemy.root.position;
    const dx = playerPosition.x - position.x;
    const dz = playerPosition.z - position.z;
    const distance = Math.hypot(dx, dz);
    const attackRange = GAME_CONFIG.zombie.attackRange;
    if (distance <= attackRange) {
      enemy.root.rotation.y = Math.atan2(dx, dz);
      if (state.attackCooldownRemaining <= 0) {
        state.attackCooldownRemaining = GAME_CONFIG.zombie.attackCooldownSeconds;
        return GAME_CONFIG.zombie.damage;
      }
      return 0;
    }

    if (distance <= DISTANCE_EPSILON || dt === 0) return 0;
    this.direct.set(dx / distance, 0, dz / distance);
    const moveDistance = Math.min(GAME_CONFIG.zombie.speed * dt, 0.22);

    this.candidate.copy(position).addScaledVector(this.direct, moveDistance);
    if (world.canOccupy(this.candidate, GAME_CONFIG.zombie.radius)) {
      this.move(enemy, this.direct, moveDistance);
      this.clearRoute(state);
      return 0;
    }

    const grid = this.gridFor(world);
    const playerCell = grid.cellAt(playerPosition.x, playerPosition.z);
    const currentWaypoint = state.route[state.routeIndex];
    const targetChanged = state.routeComputed && state.routeTargetCell !== playerCell;
    const waypointBlocked = currentWaypoint !== undefined && !world.canOccupy(
      grid.centerOf(currentWaypoint), GAME_CONFIG.zombie.radius,
    );
    const planRoute = (): void => {
      const start = grid.findClosestWalkable(position);
      const goal = grid.findClosestWalkable(playerPosition);
      state.route = start >= 0 && goal >= 0 ? grid.findPath(start, goal) : [];
      state.routeIndex = 0;
      state.routeTargetCell = playerCell;
      state.routeComputed = true;
    };

    if (targetChanged || waypointBlocked) planRoute();
    if (!state.routeComputed) {
      // Try a small local steering choice before paying for a grid search.
      const localDirection = this.findSteeredDirection(position, playerPosition, this.direct, moveDistance, world);
      if (localDirection) {
        this.move(enemy, localDirection, moveDistance);
        this.clearRoute(state);
        return 0;
      }
      planRoute();
    }

    while (state.routeIndex < state.route.length) {
      const waypointPosition = grid.centerOf(state.route[state.routeIndex]);
      const waypointDx = position.x - waypointPosition.x;
      const waypointDz = position.z - waypointPosition.z;
      if (waypointDx * waypointDx + waypointDz * waypointDz >= 0.3 ** 2) break;
      state.routeIndex += 1;
    }
    const waypoint = state.route[state.routeIndex];
    if (waypoint === undefined) {
      // The route has reached the player's cell. Use local pursuit for the
      // final short approach, including when that cell is beside a cover edge.
      const localDirection = this.findSteeredDirection(position, playerPosition, this.direct, moveDistance, world);
      if (localDirection) {
        this.move(enemy, localDirection, moveDistance);
        this.clearRoute(state);
      }
      return 0;
    }
    this.destination.copy(grid.centerOf(waypoint));
    this.destination.sub(position);
    this.destination.y = 0;
    const waypointDistance = this.destination.length();
    if (waypointDistance <= DISTANCE_EPSILON) {
      state.routeIndex += 1;
      return 0;
    }
    this.destination.multiplyScalar(1 / waypointDistance);
    this.candidate.copy(position).addScaledVector(this.destination, moveDistance);
    if (world.canOccupy(this.candidate, GAME_CONFIG.zombie.radius)) {
      this.move(enemy, this.destination, moveDistance);
    } else {
      // A route can start from a grid cell slightly away from the zombie's
      // exact position. A short local step reconnects it to the waypoint.
      const routeSteering = this.findSteeredDirection(
        position, grid.centerOf(waypoint), this.destination, moveDistance, world, 0, -0.25,
      );
      if (routeSteering) this.move(enemy, routeSteering, moveDistance);
      else {
        state.routeComputed = false;
        state.route.length = 0;
        state.routeIndex = 0;
      }
    }
    return 0;
  }

  reset(): void {
    this.states = new WeakMap<Damageable, ZombieState>();
  }

  private stateFor(enemy: Damageable): ZombieState {
    let state = this.states.get(enemy);
    if (!state) {
      state = {
        attackCooldownRemaining: 0,
        routeTargetCell: -1,
        route: [],
        routeIndex: 0,
        routeComputed: false,
      };
      this.states.set(enemy, state);
    }
    return state;
  }

  private move(enemy: Damageable, direction: Vector3, distance: number): void {
    enemy.root.position.x += direction.x * distance;
    enemy.root.position.z += direction.z * distance;
    enemy.root.rotation.y = Math.atan2(direction.x, direction.z);
  }

  private clearRoute(state: ZombieState): void {
    state.route.length = 0;
    state.routeIndex = 0;
    state.routeComputed = false;
    state.routeTargetCell = -1;
  }

  private findSteeredDirection(
    position: Vector3,
    target: Vector3,
    forward: Vector3,
    moveDistance: number,
    world: WorldQuery,
    minimumAlignment = 0.7,
    minimumProgress = 0.25,
  ): Vector3 | null {
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestDirection: Vector3 | null = null;
    const distanceBefore = Math.hypot(target.x - position.x, target.z - position.z);
    for (const angle of STEERING_ANGLES) {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const x = forward.x * cosine + forward.z * sine;
      const z = forward.z * cosine - forward.x * sine;
      if (x * forward.x + z * forward.z < minimumAlignment) continue;
      this.candidate.copy(position).setX(position.x + x * moveDistance).setZ(position.z + z * moveDistance);
      if (!world.canOccupy(this.candidate, GAME_CONFIG.zombie.radius)) continue;
      const targetDistance = Math.hypot(target.x - this.candidate.x, target.z - this.candidate.z);
      if (targetDistance >= distanceBefore - moveDistance * minimumProgress) continue;
      if (targetDistance > distanceBefore + moveDistance * 0.25) continue;
      if (targetDistance < bestDistance) {
        bestDistance = targetDistance;
        if (!bestDirection) bestDirection = new Vector3();
        bestDirection.set(x, 0, z).normalize();
      }
    }
    return bestDirection;
  }

  private gridFor(world: WorldQuery): NavigationGrid {
    let grid = this.grids.get(world);
    if (!grid) {
      grid = createNavigationGrid(world);
      this.grids.set(world, grid);
    }
    return grid;
  }
}

function createNavigationGrid(world: WorldQuery): NavigationGrid {
  const minX = world.bounds.min.x;
  const minZ = world.bounds.min.z;
  const columns = Math.ceil((world.bounds.max.x - minX) / GRID_CELL_SIZE);
  const rows = Math.ceil((world.bounds.max.z - minZ) / GRID_CELL_SIZE);
  const walkable = new Uint8Array(columns * rows);
  const cellAt = (x: number, z: number): number => {
    const column = Math.floor((x - minX) / GRID_CELL_SIZE);
    const row = Math.floor((z - minZ) / GRID_CELL_SIZE);
    if (column < 0 || column >= columns || row < 0 || row >= rows) return -1;
    return row * columns + column;
  };
  const centerOf = (index: number, y = 0): Vector3 => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return new Vector3(minX + (column + 0.5) * GRID_CELL_SIZE, y, minZ + (row + 0.5) * GRID_CELL_SIZE);
  };
  for (let index = 0; index < walkable.length; index += 1) {
    walkable[index] = world.canOccupy(centerOf(index), GAME_CONFIG.zombie.radius) ? 1 : 0;
  }

  const isWalkable = (index: number): boolean => index >= 0 && index < walkable.length && walkable[index] === 1;
  const findClosestWalkable = (position: Vector3): number => {
    const wanted = cellAt(position.x, position.z);
    if (wanted < 0) return -1;
    if (isWalkable(wanted)) return wanted;
    const wantedX = wanted % columns;
    const wantedZ = Math.floor(wanted / columns);
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let radius = 1; radius <= 4; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = wantedX + dx;
          const z = wantedZ + dz;
          if (x < 0 || x >= columns || z < 0 || z >= rows) continue;
          const index = z * columns + x;
          if (!isWalkable(index)) continue;
          const point = centerOf(index);
          const distance = (point.x - position.x) ** 2 + (point.z - position.z) ** 2;
          if (distance < bestDistance) {
            bestIndex = index;
            bestDistance = distance;
          }
        }
      }
      if (bestIndex >= 0) return bestIndex;
    }
    return bestIndex;
  };

  const findPath = (start: number, goal: number): number[] => {
    if (!isWalkable(start) || !isWalkable(goal)) return [];
    if (start === goal) return [];
    const total = walkable.length;
    const scores = new Float64Array(total);
    scores.fill(Number.POSITIVE_INFINITY);
    const previous = new Int32Array(total);
    previous.fill(-1);
    const closed = new Uint8Array(total);
    const heap = new MinHeap();
    scores[start] = 0;
    heap.push(start, heuristic(start, goal, columns));

    while (heap.size > 0) {
      const current = heap.pop();
      if (current < 0 || closed[current]) continue;
      if (current === goal) {
        const path: number[] = [];
        for (let index = goal; index !== start; index = previous[index]) {
          if (index < 0) return [];
          path.push(index);
        }
        path.reverse();
        return path;
      }
      closed[current] = 1;
      const x = current % columns;
      const z = Math.floor(current / columns);
      for (const neighbor of NEIGHBORS) {
        const nextX = x + neighbor.x;
        const nextZ = z + neighbor.z;
        if (nextX < 0 || nextX >= columns || nextZ < 0 || nextZ >= rows) continue;
        const next = nextZ * columns + nextX;
        if (!isWalkable(next) || closed[next]) continue;
        if (neighbor.x !== 0 && neighbor.z !== 0) {
          const sideX = z * columns + nextX;
          const sideZ = nextZ * columns + x;
          if (!isWalkable(sideX) || !isWalkable(sideZ)) continue;
        }
        const nextScore = scores[current] + neighbor.cost;
        if (nextScore >= scores[next]) continue;
        scores[next] = nextScore;
        previous[next] = current;
        heap.push(next, nextScore + heuristic(next, goal, columns));
      }
    }
    return [];
  };

  return { minX, minZ, columns, rows, cellSize: GRID_CELL_SIZE, walkable, cellAt, centerOf, isWalkable, findClosestWalkable, findPath };
}

function heuristic(from: number, to: number, columns: number): number {
  const dx = Math.abs(from % columns - to % columns);
  const dz = Math.abs(Math.floor(from / columns) - Math.floor(to / columns));
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

class MinHeap {
  private readonly entries: { index: number; score: number }[] = [];

  get size(): number { return this.entries.length; }

  push(index: number, score: number): void {
    const entry = { index, score };
    this.entries.push(entry);
    let child = this.entries.length - 1;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (this.entries[parent].score <= score) break;
      this.entries[child] = this.entries[parent];
      child = parent;
    }
    this.entries[child] = entry;
  }

  pop(): number {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!first) return -1;
    if (last && this.entries.length > 0) {
      let parent = 0;
      while (true) {
        const left = parent * 2 + 1;
        const right = left + 1;
        if (left >= this.entries.length) break;
        const child = right < this.entries.length && this.entries[right].score < this.entries[left].score ? right : left;
        if (this.entries[child].score >= last.score) break;
        this.entries[parent] = this.entries[child];
        parent = child;
      }
      this.entries[parent] = last;
    }
    return first.index;
  }
}
