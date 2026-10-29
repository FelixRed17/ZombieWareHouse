import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { Weapon } from '../src/player/Weapon';
import { Player } from '../src/player/Player';
import { GameState } from '../src/game/GameState';
import {
  applyShotResult,
  pauseOnUnlock,
  resetRun,
  resumeRun,
  routeCombatInput,
  runGameplayFrame,
  type GameplayFrameSystems,
} from '../src/game/GameplayFrame';
import { GAME_CONFIG } from '../src/shared/config';
import type { Damageable, PickupEffect, ShotResult, WorldQuery } from '../src/shared/types';
import { PlayerMovement } from '../src/player/PlayerMovement';

interface TestDamageable extends Damageable {
  readonly damageCalls: number;
  readonly damageAmounts: readonly number[];
  readonly deathTransitions: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert(Object.is(actual, expected), `${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function near(actual: number, expected: number, message: string, tolerance = 1e-9): void {
  assert(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${String(expected)} ± ${tolerance}, got ${String(actual)}`);
}

function resultIs(result: ShotResult | null, hitId: string | null, killed: boolean, message: string): void {
  assert(result !== null, `${message}: expected a fired shot`);
  equal(result.hitId, hitId, `${message} hitId`);
  equal(result.killed, killed, `${message} killed`);
}

function createWeapon(): Weapon {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld(true);
  return new Weapon(camera);
}

function getViewModel(weapon: Weapon): Group {
  const viewModel = weapon.camera.getObjectByName('weapon-view-model');
  assert(viewModel instanceof Group, 'camera should own one pistol view model');
  return viewModel;
}

function getMuzzleFlash(weapon: Weapon): Group {
  const muzzleFlash = weapon.camera.getObjectByName('weapon-muzzle-flash');
  assert(muzzleFlash instanceof Group, 'view model should own one muzzle flash');
  return muzzleFlash;
}

function getFlashMaterial(weapon: Weapon): MeshBasicMaterial {
  const flashCone = weapon.camera.getObjectByName('muzzle-flash-cone');
  assert(flashCone instanceof Mesh, 'view model should contain its reusable flash geometry');
  assert(flashCone.material instanceof MeshBasicMaterial, 'muzzle flash should use its owned basic material');
  return flashCone.material;
}

function collectModelResources(root: Group): { geometries: Set<BufferGeometry>; materials: Set<Material> } {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
    }
  });
  return { geometries, materials };
}

function createTarget(id: string, distance: number, startingHealth = 100): TestDamageable {
  const parent = new Group();
  const root = new Group();
  const nestedChild = new Group();
  nestedChild.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  root.add(nestedChild);
  root.position.z = -distance;
  parent.add(root);

  let health = startingHealth;
  let damageCalls = 0;
  const damageAmounts: number[] = [];
  let deathTransitions = 0;
  return {
    id,
    root,
    get isAlive() { return health > 0; },
    get damageCalls() { return damageCalls; },
    get damageAmounts() { return damageAmounts; },
    get deathTransitions() { return deathTransitions; },
    takeDamage(amount: number): boolean {
      damageCalls += 1;
      damageAmounts.push(amount);
      if (health <= 0) return false;
      health = Math.max(0, health - amount);
      const killed = health === 0;
      if (killed) deathTransitions += 1;
      return killed;
    },
  };
}

function createBlocker(distance: number): Mesh {
  const parent = new Group();
  const blocker = new Mesh(new BoxGeometry(2, 2, 0.5), new MeshBasicMaterial());
  blocker.position.z = -distance;
  parent.add(blocker);
  return blocker;
}

function fire(weapon: Weapon, targets: readonly Damageable[] = [], blockers: readonly Mesh[] = []): ShotResult | null {
  return weapon.tryShoot(targets, blockers);
}

function fireRounds(weapon: Weapon, count: number): void {
  for (let index = 0; index < count; index += 1) {
    if (index > 0) weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
    assert(fire(weapon) !== null, `expected shot ${index + 1} of ${count} to fire`);
  }
}

function openWorld(): WorldQuery {
  return { bounds: new Box3(), shotBlockers: [], spawnPoints: [], canOccupy: () => true };
}

function measurePlayerMovement(codes: readonly string[], pitchRadians = 0): Vector3 {
  const movement = new PlayerMovement();
  const camera = new PerspectiveCamera();
  camera.position.set(0, GAME_CONFIG.player.eyeHeight, 18);
  camera.rotation.x = pitchRadians;
  const origin = camera.position.clone();
  movement.setActive(true);

  try {
    for (const code of codes) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    movement.update(1, camera, openWorld());
    return new Vector3(camera.position.x - origin.x, 0, camera.position.z - origin.z);
  } finally {
    for (const code of codes) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    movement.dispose();
  }
}

function emptyMagazine(weapon: Weapon): void {
  let fired = 0;
  while (weapon.snapshot.ammo > 0) {
    if (fired > 0) weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
    assert(fire(weapon) !== null, `expected emptying shot ${fired + 1} to fire`);
    fired += 1;
  }
}

/** Reach a three-round reserve using only shots and completed reloads. */
function createWeaponWithThreeReserveRounds(): Weapon {
  const weapon = createWeapon();
  for (let reload = 0; reload < 5; reload += 1) {
    emptyMagazine(weapon);
    assert(weapon.reload(), `expected full reserve reload ${reload + 1} to start`);
    weapon.update(GAME_CONFIG.weapon.reloadSeconds);
  }

  fireRounds(weapon, 5);
  assert(weapon.reload(), 'expected partial magazine reload to start');
  weapon.update(GAME_CONFIG.weapon.reloadSeconds);
  equal(weapon.snapshot.reserve, 3, 'reserve after public setup');
  equal(weapon.snapshot.ammo, GAME_CONFIG.weapon.magazineSize, 'magazine after public setup');
  return weapon;
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: 'WASD diagonals stay normalized and camera pitch does not change horizontal speed',
    run() {
      const forward = measurePlayerMovement(['KeyW']);
      const diagonal = measurePlayerMovement(['KeyW', 'KeyD']);
      const pitchedForward = measurePlayerMovement(['KeyW'], 0.9);
      near(forward.length(), GAME_CONFIG.player.walkSpeed, 'forward distance');
      near(diagonal.length(), GAME_CONFIG.player.walkSpeed, 'diagonal distance');
      near(pitchedForward.length(), GAME_CONFIG.player.walkSpeed, 'pitched forward distance');
      assert(diagonal.x > 0 && diagonal.z < 0, 'W+D should move forward and right');
    },
  },
  {
    name: 'Sprint uses configured speed and WorldQuery collision blocks movement',
    run() {
      const sprint = measurePlayerMovement(['KeyW', 'ShiftLeft']);
      near(sprint.length(), GAME_CONFIG.player.sprintSpeed, 'sprint distance');

      const movement = new PlayerMovement();
      const camera = new PerspectiveCamera();
      camera.position.set(0, GAME_CONFIG.player.eyeHeight, 18);
      movement.setActive(true);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      try {
        movement.update(1, camera, {
          bounds: new Box3(), shotBlockers: [], spawnPoints: [], canOccupy: () => false,
        });
        equal(camera.position.z, 18, 'z after blocked movement');
        equal(camera.position.x, 0, 'x after blocked movement');
      } finally {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        movement.dispose();
      }
    },
  },
  {
    name: 'Focus deactivation clears held movement until a fresh key press',
    run() {
      const movement = new PlayerMovement();
      const camera = new PerspectiveCamera();
      camera.position.set(0, GAME_CONFIG.player.eyeHeight, 18);
      const world = openWorld();
      movement.setActive(true);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      movement.setActive(false);
      movement.setActive(true);
      try {
        movement.update(1, camera, world);
        equal(camera.position.z, 18, 'z with the pre-focus-loss key still held');
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        movement.update(1, camera, world);
        near(camera.position.z, 18 - GAME_CONFIG.player.walkSpeed, 'z after a fresh key press');
      } finally {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        movement.dispose();
      }
    },
  },
  {
    name: 'A fresh weapon starts with the configured magazine and reserve',
    run() {
      const weapon = createWeapon();
      equal(weapon.snapshot.ammo, 8, 'starting magazine ammo');
      equal(weapon.snapshot.reserve, 48, 'starting reserve ammo');
      equal(weapon.snapshot.isReloading, false, 'starting reload state');
    },
  },
  {
    name: 'A miss fires, costs one round, and returns a non-null miss result',
    run() {
      const weapon = createWeapon();
      resultIs(fire(weapon), null, false, 'miss');
      equal(weapon.snapshot.ammo, GAME_CONFIG.weapon.magazineSize - 1, 'ammo after miss');
    },
  },
  {
    name: 'A camera-attached lower-right pistol leaves centered aim and recursive target hits intact',
    run() {
      const weapon = createWeapon();
      const viewModel = getViewModel(weapon);
      const presentation = GAME_CONFIG.weapon.presentation;
      equal(viewModel.parent, weapon.camera, 'view-model parent');
      assert(viewModel.position.x > 0, 'view model should sit to the right of screen center');
      assert(viewModel.position.y < 0, 'view model should sit below screen center');
      equal(viewModel.position.x, presentation.viewPosition[0], 'neutral view-model x');
      equal(viewModel.position.y, presentation.viewPosition[1], 'neutral view-model y');

      const directionBefore = weapon.camera.getWorldDirection(new Vector3()).clone();
      const target = createTarget('center-after-recoil', 5);
      assert(fire(weapon, [target])?.hitId === target.id, 'center ray should hit the target with the model attached');
      weapon.update(1 / 60);
      const directionAfter = weapon.camera.getWorldDirection(new Vector3());
      assert(directionBefore.distanceTo(directionAfter) < 1e-9, 'view-model recoil must not rotate the shot camera');
      equal(target.damageCalls, 1, 'center target damage calls');
    },
  },
  {
    name: 'Accepted shots trigger reusable flash and recoil only when update advances presentation',
    run() {
      const weapon = createWeapon();
      const viewModel = getViewModel(weapon);
      const muzzleFlash = getMuzzleFlash(weapon);
      const flashMaterial = getFlashMaterial(weapon);
      const neutralPosition = viewModel.position.clone();
      const neutralPitch = viewModel.rotation.x;
      equal(muzzleFlash.visible, false, 'initial muzzle flash visibility');

      assert(fire(weapon) !== null, 'accepted miss should still produce a fired shot');
      equal(muzzleFlash.visible, false, 'feedback pose before the simulation update');
      equal(viewModel.position.z, neutralPosition.z, 'recoil before the simulation update');
      weapon.update(1 / 60);
      equal(muzzleFlash.visible, true, 'flash after an accepted shot update');
      assert(viewModel.position.z > neutralPosition.z, 'recoil should move the pistol back toward the camera');
      assert(viewModel.rotation.x > neutralPitch, 'recoil should lift the pistol muzzle');
      const firstFlashOpacity = flashMaterial.opacity;

      assert(weapon.reload(), 'reload should start for the rejected-shot check');
      equal(fire(weapon), null, 'shot during reload should be rejected');
      weapon.update(0.02);
      equal(muzzleFlash.visible, true, 'the accepted shot flash should continue its existing lifetime');
      assert(flashMaterial.opacity < firstFlashOpacity, 'a rejected shot must not restart the flash lifetime');
      assert(viewModel.position.z < neutralPosition.z + GAME_CONFIG.weapon.presentation.recoilDistance,
        'recoil should recover during update without another accepted shot');
    },
  },
  {
    name: 'Withholding updates freezes recoil and flash during pause, then resumes their recovery',
    run() {
      const weapon = createWeapon();
      const viewModel = getViewModel(weapon);
      const muzzleFlash = getMuzzleFlash(weapon);
      const flashMaterial = getFlashMaterial(weapon);
      assert(fire(weapon) !== null, 'accepted shot should start feedback');
      weapon.update(1 / 60);
      const pausedPosition = viewModel.position.clone();
      const pausedRotation = viewModel.rotation.clone();
      const pausedOpacity = flashMaterial.opacity;
      equal(muzzleFlash.visible, true, 'flash before pause');

      // Game pauses by withholding Weapon.update, so neither effect advances here.
      equal(viewModel.position.distanceTo(pausedPosition), 0, 'recoil pose during pause');
      equal(viewModel.rotation.x, pausedRotation.x, 'recoil pitch during pause');
      equal(flashMaterial.opacity, pausedOpacity, 'flash brightness during pause');
      equal(muzzleFlash.visible, true, 'flash visibility during pause');

      weapon.update(1 / 60);
      assert(viewModel.position.z < pausedPosition.z, 'recoil should recover after simulation resumes');
      assert(flashMaterial.opacity < pausedOpacity, 'flash should fade after simulation resumes');
    },
  },
  {
    name: 'Reset clears an active flash and restores the neutral pose without rebuilding resources',
    run() {
      const weapon = createWeapon();
      const viewModel = getViewModel(weapon);
      const muzzleFlash = getMuzzleFlash(weapon);
      const resourcesBefore = collectModelResources(viewModel);
      assert(resourcesBefore.geometries.size > 0, 'pistol should own geometry');
      assert(resourcesBefore.materials.size > 0, 'pistol should own materials');

      assert(fire(weapon) !== null, 'accepted shot should start presentation');
      weapon.update(1 / 60);
      equal(muzzleFlash.visible, true, 'active flash before reset');
      assert(viewModel.position.z > GAME_CONFIG.weapon.presentation.viewPosition[2], 'recoil should be active before reset');
      weapon.reset();
      equal(muzzleFlash.visible, false, 'flash after reset');
      equal(viewModel.position.x, GAME_CONFIG.weapon.presentation.viewPosition[0], 'reset x');
      equal(viewModel.position.y, GAME_CONFIG.weapon.presentation.viewPosition[1], 'reset y');
      equal(viewModel.position.z, GAME_CONFIG.weapon.presentation.viewPosition[2], 'reset z');
      equal(viewModel.rotation.x, GAME_CONFIG.weapon.presentation.viewRotation[0], 'reset pitch');

      const resourcesAfter = collectModelResources(viewModel);
      equal(resourcesAfter.geometries.size, resourcesBefore.geometries.size, 'geometry count after restart');
      equal(resourcesAfter.materials.size, resourcesBefore.materials.size, 'material count after restart');
      for (const geometry of resourcesBefore.geometries) assert(resourcesAfter.geometries.has(geometry), 'restart should reuse geometry');
      for (const material of resourcesBefore.materials) assert(resourcesAfter.materials.has(material), 'restart should reuse materials');
    },
  },
  {
    name: 'Dispose detaches the pistol and releases its owned resources exactly once',
    run() {
      const weapon = createWeapon();
      const viewModel = getViewModel(weapon);
      const resources = collectModelResources(viewModel);
      let geometryDisposals = 0;
      let materialDisposals = 0;
      for (const geometry of resources.geometries) geometry.addEventListener('dispose', () => geometryDisposals += 1);
      for (const material of resources.materials) material.addEventListener('dispose', () => materialDisposals += 1);

      weapon.dispose();
      equal(viewModel.parent, null, 'view-model parent after dispose');
      equal(geometryDisposals, resources.geometries.size, 'disposed geometry count');
      equal(materialDisposals, resources.materials.size, 'disposed material count');
      weapon.dispose();
      equal(geometryDisposals, resources.geometries.size, 'geometry dispose should be idempotent');
      equal(materialDisposals, resources.materials.size, 'material dispose should be idempotent');
    },
  },
  {
    name: 'Cooldown rejects attempts without consuming ammo and expires through update',
    run() {
      const weapon = createWeapon();
      fire(weapon);
      const ammoAfterShot = weapon.snapshot.ammo;
      equal(fire(weapon), null, 'immediate cooldown rejection');
      equal(weapon.snapshot.ammo, ammoAfterShot, 'ammo after immediate rejection');
      weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
      resultIs(fire(weapon), null, false, 'shot after cooldown expiry');
      equal(weapon.snapshot.ammo, ammoAfterShot - 1, 'ammo after cooldown expiry');
    },
  },
  {
    name: 'Reload delays ammunition transfer until its exact simulation-time completion',
    run() {
      const weapon = createWeapon();
      fireRounds(weapon, 3);
      assert(weapon.reload(), 'reload should start');
      equal(weapon.snapshot.isReloading, true, 'reload state after start');
      weapon.update(GAME_CONFIG.weapon.reloadSeconds - 0.01);
      equal(weapon.snapshot.ammo, 5, 'magazine before reload completion');
      equal(weapon.snapshot.reserve, 48, 'reserve before reload completion');
      equal(weapon.snapshot.isReloading, true, 'reload state before completion');
      weapon.update(0.01);
      equal(weapon.snapshot.ammo, 8, 'magazine at reload completion');
      equal(weapon.snapshot.reserve, 45, 'reserve at reload completion');
      equal(weapon.snapshot.isReloading, false, 'reload state at completion');
    },
  },
  {
    name: 'A full magazine cannot start or alter a reload',
    run() {
      const weapon = createWeapon();
      assert(!weapon.reload(), 'full magazine reload should be rejected');
      equal(weapon.snapshot.ammo, 8, 'ammo after rejected full reload');
      equal(weapon.snapshot.reserve, 48, 'reserve after rejected full reload');
      equal(weapon.snapshot.isReloading, false, 'reload state after rejected full reload');
    },
  },
  {
    name: 'A repeated reload request does not restart an existing reload',
    run() {
      const weapon = createWeapon();
      fireRounds(weapon, 2);
      assert(weapon.reload(), 'first reload should start');
      weapon.update(0.75);
      assert(!weapon.reload(), 'repeated reload should be rejected');
      weapon.update(0.75);
      equal(weapon.snapshot.ammo, 8, 'ammo after original reload duration');
      equal(weapon.snapshot.reserve, 46, 'reserve after original reload duration');
      equal(weapon.snapshot.isReloading, false, 'reload state after original reload duration');
    },
  },
  {
    name: 'A reload rejects shooting without consuming ammunition',
    run() {
      const weapon = createWeapon();
      fireRounds(weapon, 1);
      assert(weapon.reload(), 'reload should start');
      weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
      equal(fire(weapon), null, 'shot during reload');
      equal(weapon.snapshot.ammo, 7, 'ammo during reload');
      equal(weapon.snapshot.reserve, 48, 'reserve during reload');
    },
  },
  {
    name: 'Withholding updates freezes reload progress',
    run() {
      const weapon = createWeapon();
      assert(fire(weapon) !== null, 'initial shot should fire');
      assert(weapon.reload(), 'reload should start');

      // Pausing the game means Game stops calling Weapon.update. The reload remains
      // pending until the next active-play update advances simulation time.
      equal(weapon.snapshot.ammo, 7, 'ammo while updates are withheld');
      equal(weapon.snapshot.reserve, 48, 'reserve while updates are withheld');
      equal(weapon.snapshot.isReloading, true, 'reload while updates are withheld');
      equal(fire(weapon), null, 'shot while reload is frozen');
      equal(weapon.snapshot.ammo, 7, 'ammo after rejected frozen shot');

      weapon.update(GAME_CONFIG.weapon.reloadSeconds);
      equal(weapon.snapshot.ammo, 8, 'ammo after resumed simulation update');
      equal(weapon.snapshot.reserve, 47, 'reserve after resumed simulation update');
      equal(weapon.snapshot.isReloading, false, 'reload after resumed simulation update');
    },
  },
  {
    name: 'Withholding updates freezes the fire cooldown',
    run() {
      const weapon = createWeapon();
      assert(fire(weapon) !== null, 'initial shot should fire');
      equal(fire(weapon), null, 'shot before another cooldown update');
      equal(weapon.snapshot.ammo, 7, 'ammo before another cooldown update');
      weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
      assert(fire(weapon) !== null, 'shot after cooldown update');
      equal(weapon.snapshot.ammo, 6, 'ammo after cooldown update');
    },
  },
  {
    name: 'An insufficient reserve transfers only its remaining three rounds',
    run() {
      const weapon = createWeaponWithThreeReserveRounds();
      emptyMagazine(weapon);
      assert(weapon.reload(), 'reload with three reserve rounds should start');
      weapon.update(GAME_CONFIG.weapon.reloadSeconds);
      equal(weapon.snapshot.ammo, 3, 'ammo after partial reserve reload');
      equal(weapon.snapshot.reserve, 0, 'reserve after partial reserve reload');
      equal(weapon.snapshot.isReloading, false, 'reload state after partial reserve reload');
      assert(!weapon.reload(), 'reload without reserve should be rejected');
      equal(weapon.snapshot.ammo, 3, 'ammo after no-reserve rejection');
      equal(weapon.snapshot.reserve, 0, 'reserve after no-reserve rejection');
      equal(weapon.snapshot.isReloading, false, 'reload state after no-reserve rejection');
    },
  },
  {
    name: 'Ammo pickups add to reserve without directly refilling the magazine',
    run() {
      const weapon = createWeapon();
      fireRounds(weapon, 2);
      weapon.addAmmo(GAME_CONFIG.pickups.ammoAmount);
      equal(weapon.snapshot.ammo, 6, 'magazine after ammo pickup');
      equal(weapon.snapshot.reserve, 48 + GAME_CONFIG.pickups.ammoAmount, 'reserve after ammo pickup');
      equal(weapon.snapshot.isReloading, false, 'reload state after ammo pickup');
    },
  },
  {
    name: 'Reset during reload restores starting ammo and clears both timers',
    run() {
      const weapon = createWeapon();
      fireRounds(weapon, 2);
      assert(weapon.reload(), 'reload should start');
      weapon.update(0.5);
      weapon.reset();
      equal(weapon.snapshot.ammo, 8, 'ammo after reset');
      equal(weapon.snapshot.reserve, 48, 'reserve after reset');
      equal(weapon.snapshot.isReloading, false, 'reload state after reset');
      resultIs(fire(weapon), null, false, 'immediate shot after reset');
      equal(weapon.snapshot.ammo, 7, 'ammo after immediate reset shot');
    },
  },
  {
    name: 'Reset restores starting ammo and clears cooldown',
    run() {
      const weapon = createWeapon();
      fire(weapon);
      weapon.reset();
      equal(weapon.snapshot.ammo, GAME_CONFIG.weapon.magazineSize, 'ammo after reset');
      equal(weapon.snapshot.reserve, GAME_CONFIG.weapon.startingReserve, 'reserve after reset');
      resultIs(fire(weapon), null, false, 'immediate shot after reset');
      equal(weapon.snapshot.ammo, GAME_CONFIG.weapon.magazineSize - 1, 'ammo after immediate reset shot');
    },
  },
  {
    name: 'An empty magazine rejects shots without consuming ammo',
    run() {
      const weapon = createWeapon();
      for (let index = 0; index < GAME_CONFIG.weapon.magazineSize; index += 1) {
        if (index > 0) weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
        assert(fire(weapon) !== null, `expected magazine shot ${index + 1} to fire`);
      }
      equal(weapon.snapshot.ammo, 0, 'empty magazine');
      weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
      equal(fire(weapon), null, 'empty magazine rejection');
      equal(weapon.snapshot.ammo, 0, 'ammo after empty rejection');
    },
  },
  {
    name: 'A nested child mesh hit resolves to its Damageable root',
    run() {
      const weapon = createWeapon();
      const target = createTarget('nested-target', 5);
      resultIs(fire(weapon, [target]), target.id, false, 'nested hit');
      equal(target.damageCalls, 1, 'nested target damage calls');
    },
  },
  {
    name: 'Nearer cover stops the shot and consumes the round',
    run() {
      const weapon = createWeapon();
      const target = createTarget('behind-cover', 8);
      resultIs(fire(weapon, [target], [createBlocker(4)]), null, false, 'cover hit');
      equal(target.damageCalls, 0, 'damage behind cover');
      equal(weapon.snapshot.ammo, GAME_CONFIG.weapon.magazineSize - 1, 'ammo after cover hit');
    },
  },
  {
    name: 'A target before farther cover receives damage',
    run() {
      const weapon = createWeapon();
      const target = createTarget('before-cover', 4);
      resultIs(fire(weapon, [target], [createBlocker(8)]), target.id, false, 'target before cover');
      equal(target.damageCalls, 1, 'damage before cover');
    },
  },
  {
    name: 'Dead targets are excluded from the recursive raycast',
    run() {
      const weapon = createWeapon();
      const deadTarget = createTarget('already-dead', 4, 0);
      resultIs(fire(weapon, [deadTarget]), null, false, 'dead target exclusion');
      equal(deadTarget.damageCalls, 0, 'damage to excluded target');
    },
  },
  {
    name: 'Three 34-damage hits kill a 100-HP target exactly once',
    run() {
      const weapon = createWeapon();
      const target = createTarget('three-hit-target', 4, 100);
      const results: ShotResult[] = [];
      for (let index = 0; index < 3; index += 1) {
        if (index > 0) weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
        const shot = fire(weapon, [target]);
        assert(shot !== null, `expected hit ${index + 1} to fire`);
        results.push(shot);
      }
      equal(results[0].killed, false, 'first hit death transition');
      equal(results[1].killed, false, 'second hit death transition');
      equal(results[2].killed, true, 'third hit death transition');
      equal(target.damageCalls, 3, 'target damage calls');
      equal(target.damageAmounts.join(','), '34,34,34', 'damage amounts');
      equal(target.deathTransitions, 1, 'target death transitions');

      weapon.update(GAME_CONFIG.weapon.cooldownSeconds);
      resultIs(fire(weapon, [target]), null, false, 'shot after target death');
      equal(target.damageCalls, 3, 'damage calls after death');
      equal(target.deathTransitions, 1, 'death transitions after death');
    },
  },
  {
    name: 'GameState clamps healing and damage and does not heal after death',
    run() {
      const state = new GameState();
      state.reset();
      state.damage(25);
      equal(state.health, 75, 'health after damage');
      state.heal(100);
      equal(state.health, GAME_CONFIG.maxHealth, 'health cap');
      state.damage(1000);
      equal(state.health, 0, 'health floor');
      equal(state.phase, 'gameOver', 'fatal damage phase');
      state.heal(100);
      equal(state.health, 0, 'health after post-death heal');
      equal(state.phase, 'gameOver', 'phase after post-death heal');
    },
  },
  {
    name: 'Production frame orchestration applies attacks, routes pickups, and advances time in order',
    run() {
      const state = new GameState();
      state.reset();
      state.elapsedSeconds = 12.25;
      const weapon = createWeapon();
      const order: string[] = [];
      let enemyElapsed = -1;
      const effects: readonly PickupEffect[] = [
        { kind: 'health', amount: 60 },
        { kind: 'ammo', amount: GAME_CONFIG.pickups.ammoAmount },
      ];
      const systems: GameplayFrameSystems = {
        movePlayer(dt) { equal(dt, 0.5, 'player delta'); order.push('player'); },
        advanceWeapon(dt) { equal(dt, 0.5, 'weapon delta'); order.push('weapon'); },
        updateEnemies(dt, elapsed) {
          equal(dt, 0.5, 'enemy delta');
          enemyElapsed = elapsed;
          order.push('enemies');
          return 20;
        },
        updatePickups(dt) { equal(dt, 0.5, 'pickup delta'); order.push('pickups'); return effects; },
        addAmmo(amount) { order.push('ammo'); weapon.addAmmo(amount); },
      };

      assert(runGameplayFrame(0.5, true, state, systems), 'active frame should run');
      equal(order.join(','), 'player,weapon,enemies,pickups,ammo', 'simulation order');
      equal(enemyElapsed, 12.25, 'elapsed time passed to spawner');
      equal(state.health, GAME_CONFIG.maxHealth, 'health after enemy damage and capped pickup');
      equal(weapon.snapshot.ammo, GAME_CONFIG.weapon.magazineSize, 'magazine after ammo pickup');
      equal(weapon.snapshot.reserve, GAME_CONFIG.weapon.startingReserve + GAME_CONFIG.pickups.ammoAmount,
        'reserve after ammo pickup');
      equal(state.elapsedSeconds, 12.75, 'elapsed time after active frame');
    },
  },
  {
    name: 'Only a fresh ShotResult.killed transition awards a kill',
    run() {
      const state = new GameState();
      state.reset();
      applyShotResult(state, null);
      applyShotResult(state, { hitId: null, killed: false });
      applyShotResult(state, { hitId: 'wounded-zombie', killed: false });
      equal(state.kills, 0, 'kills for miss and nonlethal hit');
      applyShotResult(state, { hitId: 'dead-zombie', killed: true });
      applyShotResult(state, { hitId: 'dead-zombie', killed: false });
      equal(state.kills, 1, 'kills after a single death transition');
    },
  },
  {
    name: 'The 300-second active frame produces victory',
    run() {
      const state = new GameState();
      state.reset();
      state.elapsedSeconds = GAME_CONFIG.roundSeconds - 0.5;
      const order: string[] = [];
      const systems: GameplayFrameSystems = {
        movePlayer() { order.push('player'); },
        advanceWeapon() { order.push('weapon'); },
        updateEnemies() { order.push('enemies'); return 0; },
        updatePickups() { order.push('pickups'); return []; },
        addAmmo() { order.push('ammo'); },
      };

      assert(runGameplayFrame(0.5, true, state, systems), 'final active frame should run');
      equal(state.elapsedSeconds, GAME_CONFIG.roundSeconds, 'clamped round duration');
      equal(state.remainingSeconds, 0, 'remaining time');
      equal(state.phase, 'victory', 'victory phase');
      equal(order.join(','), 'player,weapon,enemies,pickups', 'victory frame sequence');
    },
  },
  {
    name: 'Fatal damage beats same-frame victory and skips health and ammo pickups',
    run() {
      const state = new GameState();
      state.reset();
      state.elapsedSeconds = GAME_CONFIG.roundSeconds - 0.25;
      const weapon = createWeapon();
      let pickupUpdates = 0;
      const systems: GameplayFrameSystems = {
        movePlayer() {},
        advanceWeapon() {},
        updateEnemies() { return GAME_CONFIG.maxHealth; },
        updatePickups() {
          pickupUpdates += 1;
          return [{ kind: 'health', amount: GAME_CONFIG.maxHealth }, { kind: 'ammo', amount: 10 }];
        },
        addAmmo(amount) { weapon.addAmmo(amount); },
      };

      assert(runGameplayFrame(0.5, true, state, systems), 'fatal frame should run');
      equal(state.health, 0, 'health after fatal attack');
      equal(state.phase, 'gameOver', 'death priority');
      equal(state.elapsedSeconds, GAME_CONFIG.roundSeconds - 0.25, 'timer after fatal attack');
      equal(pickupUpdates, 0, 'pickup update after fatal damage');
      equal(weapon.snapshot.reserve, GAME_CONFIG.weapon.startingReserve, 'ammo pickup after fatal damage');
    },
  },
  {
    name: 'Paused, terminal, and uncaptured frames do not advance gameplay',
    run() {
      const state = new GameState();
      state.reset();
      state.elapsedSeconds = 42;
      let updates = 0;
      const systems: GameplayFrameSystems = {
        movePlayer() { updates += 1; },
        advanceWeapon() { updates += 1; },
        updateEnemies() { updates += 1; return 0; },
        updatePickups() { updates += 1; return []; },
        addAmmo() { updates += 1; },
      };

      assert(!runGameplayFrame(1, false, state, systems), 'uncaptured frame should be rejected');
      state.phase = 'paused';
      assert(!runGameplayFrame(1, true, state, systems), 'paused frame should be rejected');
      state.phase = 'menu';
      assert(!runGameplayFrame(1, true, state, systems), 'menu frame should be rejected');
      state.phase = 'gameOver';
      assert(!runGameplayFrame(1, true, state, systems), 'death frame should be rejected');
      state.phase = 'victory';
      assert(!runGameplayFrame(1, true, state, systems), 'terminal frame should be rejected');
      equal(updates, 0, 'gameplay system updates while paused or terminal');
      equal(state.elapsedSeconds, 42, 'elapsed time while paused or terminal');
    },
  },
  {
    name: 'Combat input is rejected without active capture and outside playing',
    run() {
      const state = new GameState();
      state.reset();
      let requests = 0;
      const action = () => requests += 1;
      assert(!routeCombatInput(state, false, action), 'uncaptured combat input should be rejected');
      for (const phase of ['menu', 'paused', 'gameOver', 'victory'] as const) {
        state.phase = phase;
        assert(!routeCombatInput(state, true, action), `${phase} combat input should be rejected`);
      }
      state.phase = 'playing';
      assert(routeCombatInput(state, true, action), 'captured playing input should be accepted');
      equal(requests, 1, 'combat actions routed');
    },
  },
  {
    name: 'Resume keeps health, elapsed time, and kills from the existing run',
    run() {
      const state = new GameState();
      state.reset();
      state.health = 43;
      state.elapsedSeconds = 88.5;
      state.kills = 6;
      state.phase = 'paused';
      resumeRun(state);
      equal(state.phase, 'playing', 'phase after resume');
      equal(state.health, 43, 'health after resume');
      equal(state.elapsedSeconds, 88.5, 'elapsed time after resume');
      equal(state.kills, 6, 'kills after resume');
    },
  },
  {
    name: 'Pointer unlock pauses active play but preserves both outcome phases',
    run() {
      const state = new GameState();
      state.reset();
      pauseOnUnlock(state);
      equal(state.phase, 'paused', 'phase after active unlock');
      state.phase = 'gameOver';
      pauseOnUnlock(state);
      equal(state.phase, 'gameOver', 'death phase after pointer unlock');
      state.phase = 'victory';
      pauseOnUnlock(state);
      equal(state.phase, 'victory', 'victory phase after pointer unlock');
    },
  },
  {
    name: 'Fresh-run orchestration calls each existing reset and restores run state',
    run() {
      const state = new GameState();
      state.reset();
      state.health = 12;
      state.elapsedSeconds = 97;
      state.kills = 4;
      state.phase = 'gameOver';
      const camera = new PerspectiveCamera();
      const player = new Player(camera, document.createElement('canvas'));
      const weapon = createWeapon();
      assert(fire(weapon) !== null, 'weapon setup shot should fire');
      assert(weapon.reload(), 'weapon setup reload should start');
      camera.position.set(3, 2.5, -7);
      camera.rotation.set(0.2, 1, -0.3);
      const order: string[] = [];
      let enemyResetCalls = 0;
      let pickupResetCalls = 0;

      try {
        resetRun({
          resetPlayer() { order.push('player'); player.reset(); },
          resetWeapon() { order.push('weapon'); weapon.reset(); },
          resetEnemies() { order.push('enemies'); enemyResetCalls += 1; },
          resetPickups() { order.push('pickups'); pickupResetCalls += 1; },
          resetState() { order.push('state'); state.reset(); },
        });

        equal(order.join(','), 'player,weapon,enemies,pickups,state', 'reset method order');
        equal(enemyResetCalls, 1, 'enemy reset calls');
        equal(pickupResetCalls, 1, 'pickup reset calls');
        equal(camera.position.x, 0, 'camera reset x');
        equal(camera.position.y, GAME_CONFIG.player.eyeHeight, 'camera reset eye height');
        equal(camera.position.z, 18, 'camera reset z');
        equal(camera.rotation.x, 0, 'camera reset pitch');
        equal(camera.rotation.y, 0, 'camera reset yaw');
        equal(weapon.snapshot.ammo, GAME_CONFIG.weapon.magazineSize, 'weapon reset magazine');
        equal(weapon.snapshot.reserve, GAME_CONFIG.weapon.startingReserve, 'weapon reset reserve');
        equal(weapon.snapshot.isReloading, false, 'weapon reset reload state');
        equal(state.health, GAME_CONFIG.maxHealth, 'state reset health');
        equal(state.elapsedSeconds, 0, 'state reset timer');
        equal(state.kills, 0, 'state reset kills');
        equal(state.phase, 'playing', 'state reset phase');
      } finally {
        player.dispose();
        weapon.dispose();
      }
    },
  },
];

const results = document.querySelector<HTMLPreElement>('#results');
assert(results, 'Missing test output element');
const lines: string[] = [];
const failures: string[] = [];
for (const check of checks) {
  try {
    check.run();
    lines.push(`PASS  ${check.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(check.name);
    lines.push(`FAIL  ${check.name}\n      ${message}`);
  }
}

lines.push('', `${checks.length - failures.length}/${checks.length} checks passed`);
results.textContent = lines.join('\n');
results.className = failures.length === 0 ? 'pass' : 'fail';
if (failures.length > 0) throw new Error(`Gameplay checks failed: ${failures.join(', ')}`);
