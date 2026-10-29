// node src/world/checks/layout.mjs
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
const temp = await mkdtemp(join(process.cwd(), 'node_modules/.layout-check-'));
try {
  await build({ entryPoints: ['src/world/Warehouse.ts', 'src/world/layout.ts'], outdir: temp, bundle: true, platform: 'node', format: 'esm', packages: 'external', outExtension: { '.js': '.mjs' } });
  const { Warehouse } = await import(join(temp, 'Warehouse.mjs'));
  const { PICKUP_CLEARINGS, PROPS } = await import(join(temp, 'layout.mjs'));
  const world = new Warehouse();
  const point = (x, z, y = 1.7) => new Vector3(x, y, z);
  assert.deepEqual(world.spawnPoints.map(p => p.toArray()), [[-15,0,-22],[15,0,-22],[-15,0,22],[15,0,22]]);
  for (const radius of [0.35, 0.4]) {
    const start = point(0,18), original = start.clone();
    assert.ok(world.canOccupy(start, radius)); assert.ok(start.equals(original));
    for (let z = -27; z <= 27; z += 0.25) assert.ok(world.canOccupy(point(0,z), radius));
    for (const [x,z] of PICKUP_CLEARINGS) assert.ok(world.canOccupy(point(x,z), 1.4));
    // Flood a 0.25m grid, sampling the midpoint of every edge too.
    const step = 0.25, key = (x,z) => `${x},${z}`, queue = [[0,18]], seen = new Set(['0,18']);
    for (let i=0; i<queue.length; i++) {
      const [x,z] = queue[i];
      for (const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]) {
        const nx=x+dx,nz=z+dz,k=key(nx,nz);
        if (!seen.has(k) && world.canOccupy(point(nx,nz),radius) && world.canOccupy(point(x+dx/2,z+dz/2),radius)) { seen.add(k); queue.push([nx,nz]); }
      }
    }
    for (const p of [...world.spawnPoints, ...PICKUP_CLEARINGS.map(([x,z])=>point(x,z))]) assert.ok(seen.has(key(p.x,p.z)), `unreachable ${p.toArray()}`);
    for (const p of PROPS.filter(p=>p.kind!=='rack')) {
      assert.equal(world.canOccupy(point(p.x,p.z,-100),radius), false);
      assert.equal(world.canOccupy(point(p.x,p.z,100),radius), false);
      // Each cardinal side of every cover cluster connects to the start when free.
      for (const [dx,dz] of [[3,0],[-3,0],[0,3],[0,-3]]) {
        const x=Math.round((p.x+dx)*4)/4,z=Math.round((p.z+dz)*4)/4;
        if (world.canOccupy(point(x,z),radius)) assert.ok(seen.has(key(x,z)));
      }
    }
    for (const [x,z] of [[20-radius,0],[-20+radius,0],[0,28-radius],[0,-28+radius]]) assert.ok(world.canOccupy(point(x,z),radius));
    for (const [x,z] of [[20,0],[-20,0],[0,28],[0,-28]]) assert.equal(world.canOccupy(point(x,z),radius), false);
  }
  const ray = (origin,direction) => new Raycaster(origin,direction,0,100).intersectObjects(world.shotBlockers,false);
  assert.ok(world.canOccupy(point(-17,-18),0.4));
  assert.ok(ray(point(-17,-18),new Vector3(0,1,0))[0].distance < 1.01);
  assert.ok(ray(point(-7,-3),new Vector3(0,0,-1))[0].distance < 3);
  for (const p of PROPS.filter(p=>p.kind!=='rack')) assert.ok(ray(point(p.x,p.z,8),new Vector3(0,-1,0))[0].point.y > 0.1);
  const centerHit=ray(point(0,18),new Vector3(0,0,-1))[0];
  assert.ok(Math.abs(centerHit.point.z+28)<0.001);
  const blockers = new Set(world.shotBlockers);
  world.root.traverse(o=>{ if(o.isMesh && o.scale.y !== 0.004) assert.ok(blockers.has(o)); });
  const resources=new Set();world.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});
  const counts=new Map();for(const r of resources){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}
  world.dispose();world.dispose();assert.ok([...counts.values()].every(n=>n===1));assert.equal(world.shotBlockers.length,0);
  console.log('PASS: start, spawns, pickup clearings, center aisle, both actor radii, connected cover routes, walls, input purity/Y independence, solid-prop raycasts, overhead shelves, blocker registration and idempotent resource disposal.');
} finally { await rm(temp,{recursive:true,force:true}); }
