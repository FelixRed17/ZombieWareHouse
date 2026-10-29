// Run from repository root: node src/world/checks/props.mjs
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Box3, Group, Raycaster, Vector3 } from 'three';
const temp = await mkdtemp(join(process.cwd(), 'node_modules/.prop-check-'));
try {
  await build({ entryPoints: ['src/world/PropFactory.ts'], outfile: join(temp, 'props.mjs'),
    bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  const { PropFactory, PROP_DEFINITIONS } = await import(join(temp, 'props.mjs'));
  const pool = new PropFactory();
  const scene = new Group();
  const tracked = new Map();
  const track = resource => {
    if (tracked.has(resource)) return;
    tracked.set(resource, 0);
    resource.addEventListener('dispose', () => tracked.set(resource, tracked.get(resource) + 1));
  };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  const methods = { crate: 'createCrate', barrel: 'createBarrel', pallet: 'createPallet', rack: 'createRack' };
  for (const [kind, method] of Object.entries(methods)) {
    const a = pool[method](), b = pool[method]();
    scene.add(a, b);
    assert.notEqual(a, b);
    assert.equal(a.children.length, 2);
    const spec = PROP_DEFINITIONS[kind];
    const bounds = new Box3().setFromObject(a);
    const size = bounds.getSize(new Vector3());
    near(bounds.min.y, 0); near(size.x, spec.width); near(size.y, spec.height); near(size.z, spec.depth);
    near(bounds.getCenter(new Vector3()).x, 0); near(bounds.getCenter(new Vector3()).z, 0);
    for (let i = 0; i < a.children.length; i++) {
      assert.notEqual(a.children[i], b.children[i]);
      assert.equal(a.children[i].geometry, b.children[i].geometry);
      assert.equal(a.children[i].material, b.children[i].material);
      track(a.children[i].geometry); track(a.children[i].material);
    }
    a.position.set(8, 2, -5);
    near(new Box3().setFromObject(a).min.y, 2);
    near(new Box3().setFromObject(b).min.y, 0);
    if (kind === 'rack') {
      assert.equal(spec.footprints.length, 4);
      assert.ok(spec.footprints.every(p => Math.abs(p.x) > p.width / 2 && Math.abs(p.z) > p.depth / 2));
      // Empty ground bay, but the shelf overhead must remain a shot blocker.
      assert.equal(new Raycaster(new Vector3(0, 1, 5), new Vector3(0, 0, -1)).intersectObject(b, true).length, 0);
      assert.ok(new Raycaster(new Vector3(0, 1, 0), new Vector3(0, 1, 0)).intersectObject(b, true).length > 0);
    } else if (kind === 'barrel') {
      assert.equal(spec.footprints[0].kind, 'circle'); near(spec.footprints[0].radius, size.x / 2);
    } else {
      near(spec.footprints[0].width, size.x); near(spec.footprints[0].depth, size.z);
    }
    pool.release(a); pool.release(a);
    assert.equal(a.parent, null); assert.equal(a.children.length, 0);
    assert.ok([...tracked.values()].every(n => n === 0));
  }
  // A large repeated population still uses only eight baked geometries/four materials.
  for (let i = 0; i < 100; i++) scene.add(pool.createCrate());
  const geometries = new Set(), materials = new Set();
  scene.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); } });
  assert.equal(geometries.size, 8); assert.equal(materials.size, 4);
  pool.dispose(); pool.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok([...tracked.values()].every(n => n === 1));
  assert.throws(() => pool.createCrate(), /disposed/);
  const otherPool = new PropFactory();
  const fresh = otherPool.createCrate();
  assert.ok(!geometries.has(fresh.children[0].geometry));
  otherPool.dispose();
  console.log('PASS: all dimensions/origins, footprint metadata, rack raycasts, independent transforms, shared resources, 100 repeated instances, release and idempotent teardown.');
} finally { await rm(temp, { recursive: true, force: true }); }
