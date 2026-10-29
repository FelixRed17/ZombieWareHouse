# Procedural warehouse props

Current prompt completed with original Three.js geometry and plain materials.
No downloads, textures, fonts, icons, sounds or asynchronous loads are used by
these factories. The earlier GLTFLoader preparation remains inactive; asset
acquisition is no longer a prerequisite for this procedural direction.

Create one `PropFactory` per warehouse lifetime. Its `createCrate()`,
`createBarrel()`, `createPallet()` and `createRack()` methods return independent
Three.js Groups. All roots are XZ-centred, Y-up, with their bases at Y=0.

| Factory | Width × height × depth (metres) | Ground collision metadata |
| --- | --- | --- |
| createCrate | 1 × 1 × 1 | 1 × 1 solid rectangle, including raised frame |
| createBarrel | 0.7 × 1.1 × 0.7 | Circle, radius 0.35 |
| createPallet | 1.2 × 0.18 × 1 | Conservative 1.2 × 1 rectangle, including slat gaps |
| createRack | 3.4 × 6 × 7 | Four 0.16 × 0.16 post footprints at X ±1.5, Z ±3.2 |

`PROP_DEFINITIONS` exposes immutable dimensions and local XZ footprints. Racks
have empty ground bays and shelves centred at Y=2.7 and 5.4. Shelf undersides
are at 2.6 and 5.3 metres. The barrel uses 16 radial segments; its circular
collision envelope conservatively contains the faceted silhouette.

Warehouse remains responsible for placement and collision registration. No
arena-layout changes are included in this factory-only prompt. When placing:

1. Add factory roots to `Warehouse.root` and set their transforms there.
2. Translate/rotate footprints into world space in Warehouse. Prefer quarter-turn
   rotations for its existing axis-aligned Box3 collision checks. Keep upright;
   metadata describes ground-level props, not arbitrary tilted/stacked solids.
3. For barrels, add a world-owned circle obstacle branch to `canOccupy`, or use
   a documented conservative square envelope if retaining Box3-only collision.
4. Register visible child meshes as shot blockers (including overhead shelves).
   Do not register the rack's full outer rectangle as a ground obstacle.
5. `release(root)` detaches and clears one instance without releasing shared GPU
   resources. Call `dispose()` on the factory at world teardown: it detaches all
   tracked roots first, then disposes geometry/materials exactly once. No other
   object should dispose or mutate these resources. Do not manually clone roots;
   request another instance so its lifetime is tracked.

The factory reuses unit box/cylinder construction primitives. Static detail is
baked once per kind into two meshes grouped by material. Repeated instances share
those baked geometries and four palette materials; there are no per-frame updates,
textures, timers or listeners. These are shared resources, not GPU instancing:
rendering each prop still requires two draw calls before shadow passes.

Verification performed:

- `node src/world/checks/props.mjs`: passed all dimensions/floor alignment,
  footprint metadata, rack bay/overhead raycasts, independent transforms,
  resource identity across 100 repeated crates, release, idempotent teardown,
  and independent pool lifetimes.
- `npm run typecheck`: passed.
- `npm run build`: passed. The factories are typechecked but not in the app's
  production bundle until Warehouse uses them.

Not verified: browser appearance, GPU timing, or gameplay collision integration.
Next handoff: use these factories during the Warehouse placement/collision prompt.
No Game, shared-interface, package or other teammate changes are requested.
