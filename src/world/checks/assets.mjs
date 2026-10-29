// Run: node src/world/checks/assets.mjs (uses the installed Vite/esbuild stack).
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const temp = await mkdtemp(join(process.cwd(), 'node_modules/.world-asset-check-'));
try {
  await build({ entryPoints: ['src/world/WorldAssetLoader.ts', 'src/world/worldAssets.ts'], outdir: temp,
    bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, splitting: true,
    packages: 'external', define: { 'import.meta.env.BASE_URL': '"/warehouse/"' } });
  const { WorldAssetLoader } = await import(join(temp, 'WorldAssetLoader.mjs'));
  const { WORLD_ASSETS, worldAssetUrl, RESERVED_WORLD_GLB_URLS } = await import(join(temp, 'worldAssets.mjs'));
  const { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } = await import('three');
  assert.equal(worldAssetUrl('kit/prop.gltf'), '/warehouse/models/world/kit/prop.gltf');
  assert.equal(RESERVED_WORLD_GLB_URLS.crate, '/warehouse/models/crate.glb');
  const fallbackCache = new WorldAssetLoader();
  for (const kind of Object.keys(WORLD_ASSETS)) {
    const item = fallbackCache.create(kind);
    assert.equal(await item.ready, 'fallback');
    const bounds = new Box3().setFromObject(item.root);
    assert.ok(Math.abs(bounds.min.y) < 1e-6);
    assert.ok(Math.abs(bounds.getSize(new Vector3()).y - WORLD_ASSETS[kind].heightMetres) < 1e-6);
  }
  fallbackCache.dispose();
  let loads = 0, geometryDisposals = 0, materialDisposals = 0;
  const template = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 4, 3), new MeshStandardMaterial());
  mesh.position.set(7, 3, -2);
  mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
  mesh.material.addEventListener('dispose', () => materialDisposals++);
  template.add(mesh);
  WORLD_ASSETS.crate.url = '/test.glb';
  const cache = new WorldAssetLoader(async () => { loads++; return template; });
  const a = cache.create('crate'), b = cache.create('crate');
  assert.deepEqual(await Promise.all([a.ready, b.ready]), ['loaded', 'loaded']);
  assert.equal(loads, 1);
  const meshes = [];
  for (const item of [a, b]) {
    const bounds = new Box3().setFromObject(item.root);
    assert.ok(Math.abs(bounds.min.y) < 1e-6);
    assert.equal(bounds.getSize(new Vector3()).y, 1);
    assert.ok(bounds.getCenter(new Vector3()).x === 0);
    item.root.traverse(o => { if (o.isMesh) meshes.push(o); });
  }
  assert.equal(meshes[0].geometry, meshes[1].geometry);
  assert.equal(meshes[0].material, meshes[1].material);
  a.dispose();
  assert.equal(geometryDisposals, 0);
  cache.dispose(); cache.dispose();
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
  let failures = 0;
  const failing = new WorldAssetLoader(async () => { throw new Error('expected failure'); }, () => failures++);
  const failedA = failing.create('crate'), failedB = failing.create('crate');
  assert.deepEqual(await Promise.all([failedA.ready, failedB.ready]), ['fallback', 'fallback']);
  assert.equal(failures, 1); assert.equal(failedA.root.children.length, 1);
  failing.dispose();
  let resolve;
  const lateTemplate = new Group();
  const lateMesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  lateTemplate.add(lateMesh);
  let lateDisposals = 0;
  lateMesh.geometry.addEventListener('dispose', () => lateDisposals++);
  const late = new WorldAssetLoader(() => new Promise(r => { resolve = r; }));
  const lateInstance = late.create('crate');
  await Promise.resolve();
  late.dispose(); resolve(lateTemplate);
  assert.equal(await lateInstance.ready, 'disposed');
  assert.equal(lateInstance.root.children.length, 0); assert.equal(lateDisposals, 1);
  console.log('PASS: base URLs, all fallback dimensions, normalization, cache sharing, failures, disposal and late completion.');
} finally { await rm(temp, { recursive: true, force: true }); }
