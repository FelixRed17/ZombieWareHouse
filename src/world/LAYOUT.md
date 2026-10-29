# Industrial arena handoff (P3-01)

`layout.ts` owns prop placements, unchanged arena dimensions from shared config,
the four original spawns, pickup locations and respawn intervals, and light
positions.
Warehouse transforms the prop kit's footprints and visible meshes together.
Actor circles use XZ only; barrels use circles, other props use conservative
rectangles, and rack collision consists only of posts. Flat paint is not cover.
Every solid mesh, floor, wall, beam, lamp and overhead shelf is a shot blocker.
All props stand at Y=0; no new animation, input or gameplay state was added.

The center aisle is bounded by yellow paint at X ±4.5. Original central cover
positions remain, with sparse secondary cover and four empty rack bays. Pickup
centers (-10,-12), (10,12), (10,-12), (-10,12) have 1.4m clear radii and painted
2.8m squares. Pickups use these same centers, with one item per location.

Original procedural kit geometry is reused without edits. Floor texels are
locally generated with filtered mipmaps; no assets are downloaded. The prior
Google Fonts CSS import was removed in favor of system fonts. Lighting retains
one hemisphere and four point lights, no shadows or post-processing, and reduces
fog density for the far end of the aisle.

Verification on 2026-10-29:
- `node src/world/checks/layout.mjs`: passed player start, exact spawn positions,
  pickup clearings, center aisle, boundary checks, input purity/Y independence,
  0.25m grid connectivity with midpoint sampling for radii 0.35 and 0.4, cover
  routes, raycasts on every placed solid prop, overhead shelf raycasts, blocker
  registration, and exactly-once disposal.
- `node src/world/checks/props.mjs`: passed the existing prop-kit checks.
- `npm run typecheck` and `npm run build`: passed; Vite reports a >500kB chunk
  warning. Build configuration remains owned by the integrator.
- In-app browser: reviewed the static scene at Y=1.7 from the start, central
  cover and empty rack bay using `src/world/checks/eye-height.html`. Center
  sightline and yellow cover/shelf edges were visible; under-shelf space was
  visibly open. Initial floor pattern was distracting, so contrast was reduced
  and mipmap filtering added; the reviewed rack view showed a quieter floor.

The review page renders on view selection/resize only, uses the same Warehouse,
Lighting, FOV and tone mapping as Game, and disposes resources on page exit.
Run Vite and open `/src/world/checks/eye-height.html` to reproduce it.

Limits: static views and geometric tests do not verify player controls, enemy
steering, actual weapon integration, target visibility in combat, GPU timing or
full survival gameplay. Collision conservatively envelopes crate trim and pallet
slat gaps, as defined by the existing kit. `Pickups` consumes the typed
`PICKUP_LOCATIONS`; Warehouse derives `PICKUP_CLEARINGS` from those same points.
Next: teammates 1/2 should exercise real movement, nearest-hit shooting and
pursuit around this layout, then verify pickup collection during a round.
