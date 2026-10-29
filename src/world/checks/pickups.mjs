// Run from the repository root: node src/world/checks/pickups.mjs
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { PerspectiveCamera, Scene, Vector3 } from 'three';

const temp = await mkdtemp(join(process.cwd(), 'node_modules/.pickup-check-'));
try {
  await build({
    entryPoints: ['src/world/Pickups.ts', 'src/game/GameState.ts', 'src/player/Weapon.ts'],
    outbase: 'src',
    outdir: temp,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outExtension: { '.js': '.mjs' },
  });

  const [{ Pickups }, { GameState }, { Weapon }] = await Promise.all([
    import(join(temp, 'world/Pickups.mjs')),
    import(join(temp, 'game/GameState.mjs')),
    import(join(temp, 'player/Weapon.mjs')),
  ]);
  const scene = new Scene();
  const pickups = new Pickups(scene);
  const locate = (kind, x, z) => scene.children.find(item => item.name === `Pickup:${kind}@${x},${z}`);
  const ammoRoot = locate('ammo', -10, -12);
  const healthRoot = locate('health', 10, -12);
  const secondHealthRoot = locate('health', -10, 12);
  assert.ok(ammoRoot && healthRoot && secondHealthRoot);
  assert.equal(scene.children.length, 4);
  assert.deepEqual(scene.children.map(item => item.position.toArray()), [
    [-10, 0, -12], [10, 0, 12], [10, 0, -12], [-10, 0, 12],
  ]);

  // Collection uses XZ only, honors the configured radius, and returns once.
  assert.deepEqual(pickups.update(0, new Vector3(-8.79, 50, -12)), []);
  const ammoEffects = pickups.update(0, new Vector3(-8.9, -50, -12));
  assert.deepEqual(ammoEffects, [{ kind: 'ammo', amount: 16 }]);
  assert.equal(ammoRoot.visible, false);
  assert.deepEqual(pickups.update(0, new Vector3(-10, 1.7, -12)), []);
  assert.equal(scene.children.length, 4, 'inactive item stays allocated and cannot duplicate');

  // Exercise the existing Game consumers and confirm Game still routes effects.
  const gameSource = await readFile(new URL('../../game/Game.ts', import.meta.url), 'utf8');
  assert.match(gameSource, /if \(effect\.kind === 'health'\) this\.state\.heal\(effect\.amount\);\s*else this\.weapon\.addAmmo\(effect\.amount\);/);
  assert.match(gameSource, /if \(this\.state\.phase === 'playing' && this\.player\.controls\.isLocked\) \{[\s\S]*?this\.pickups\.update\(dtSeconds, this\.player\.position\)/);
  const state = new GameState();
  state.phase = 'playing';
  state.health = 90;
  const weapon = new Weapon(new PerspectiveCamera());
  weapon.addAmmo(ammoEffects[0].amount);
  assert.equal(weapon.snapshot.reserve, 64, 'ammo consumer adds to reserve');

  // A health pickup still emits an effect at full health; Game handles the cap.
  const healthEffects = pickups.update(0, new Vector3(10, 1.7, -12));
  assert.deepEqual(healthEffects, [{ kind: 'health', amount: 25 }]);
  state.heal(healthEffects[0].amount);
  assert.equal(state.health, 100, 'health consumer clamps at full health');
  const fullHealthEffects = pickups.update(0, new Vector3(-10, 1.7, 12));
  assert.deepEqual(fullHealthEffects, [{ kind: 'health', amount: 25 }]);
  state.heal(fullHealthEffects[0].amount);
  assert.equal(state.health, 100);
  assert.equal(healthRoot.visible, false);
  assert.equal(secondHealthRoot.visible, false);
  assert.deepEqual(pickups.update(0, new Vector3(10, 1.7, -12)), []);

  // No simulated delta means no timer progress; exact active-time delays respawn.
  pickups.update(0, new Vector3(0, 1.7, 18));
  pickups.update(0, new Vector3(0, 1.7, 18));
  assert.equal(ammoRoot.visible, false);
  pickups.update(14.99, new Vector3(0, 1.7, 18));
  assert.equal(ammoRoot.visible, false);
  assert.equal(healthRoot.visible, false);
  pickups.update(0.01, new Vector3(0, 1.7, 18));
  assert.equal(ammoRoot.visible, true);
  assert.equal(healthRoot.visible, false);
  pickups.update(14.99, new Vector3(0, 1.7, 18));
  assert.equal(healthRoot.visible, false);
  pickups.update(0.01, new Vector3(0, 1.7, 18));
  assert.equal(healthRoot.visible, true);
  assert.equal(secondHealthRoot.visible, true);

  // Reset repeatedly restores the original four items and clears every timer.
  for (let i = 0; i < 50; i++) {
    pickups.update(0, new Vector3(-10, 1.7, -12));
    pickups.reset();
    assert.equal(scene.children.length, 4);
    assert.ok(scene.children.every(item => item.visible));
  }
  assert.deepEqual(pickups.update(0, new Vector3(-10, 1.7, -12)), [{ kind: 'ammo', amount: 16 }]);
  pickups.update(14.99, new Vector3(0, 1.7, 18));
  assert.equal(ammoRoot.visible, false);
  pickups.update(0.01, new Vector3(0, 1.7, 18));
  assert.equal(ammoRoot.visible, true);

  const owned = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    owned.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) owned.add(material);
  });
  const disposed = new Map([...owned].map(resource => [resource, 0]));
  for (const resource of owned) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  pickups.dispose();
  pickups.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok([...disposed.values()].every(count => count === 1), 'owned resources dispose exactly once');
  assert.deepEqual(pickups.update(1, new Vector3(-10, 1.7, -12)), []);
  pickups.reset();
  assert.equal(scene.children.length, 0, 'reset after disposal does not recreate items');
  weapon.dispose();
  console.log('PASS: XZ collection/radius, single effects, inactive items, consumer routing, full-health pickup, frozen/active respawn time, repeated reset and exactly-once disposal.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
