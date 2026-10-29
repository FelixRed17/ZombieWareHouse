# World prop loader handoff — Prompt 1 (historical)

The current procedural-only direction supersedes this acquisition handoff. See
[PROPS.md](PROPS.md) for the active factories; no downloads are needed. The loader
below remains inactive and its earlier limitations are retained for context.

Asset acquisition is blocked by HTTP 403 from the official Factory Kit download.
No models or textures are included; all three categories remain missing. See
`docs/ASSET_CREDITS.md` for the exact attempted archive URL and license evidence.

`WorldAssetLoader` is prepared but is not wired into Warehouse while acquisition
is incomplete. Existing gameplay, layout, collision, menus and public interfaces
are unchanged. No other teammate integration change is requested at this stage.

Usage after acquisition:

- Set verified URLs in `worldAssets.ts`: shared reserved crate/barrel URLs for
  actual GLBs, or `worldAssetUrl('kit/original-name.gltf')` for world-only files.
  Preserve the archive's relative buffer/image dependencies.
- Create one `WorldAssetLoader` for the warehouse lifetime. `create(kind)` returns
  an immediate fallback `root`, `ready` promise and `dispose()` handle. Add that
  root to the warehouse. The promise resolves to loaded/fallback/disposed.
- Imported glTFs are already Y-up; measured height is uniformly normalized to
  crate 1 m, barrel 1.1 m, industrial pallet 0.18 m, centred on XZ with base Y=0.
  These are intended target sizes, not measured downloaded asset dimensions.
  Revise the industrial height if the actual selected prop is a machine.
- Each URL is requested once per cache lifetime, including failures. Failures
  report once and retain the fallback. Instances share immutable GPU resources;
  do not modify or dispose their geometry/material/texture resources individually.
- Instance disposal only detaches/clears its tree. Cache disposal detaches all
  instances and disposes unique resources; late loads are disposed without
  attachment. Start a new cache to retry failures or recreate a disposed world.
- This helper is for static props. It does not play model animations.
- When integrating assets in Warehouse, measure resulting bounds and maintain
  movement collision and recursive shot blockers against the actual props.

Checks actually performed:

- `npm run typecheck` — passed.
- `npm run build` — passed.
- `node src/world/checks/assets.mjs` — passed: all fallback heights and floor
  placement, subdirectory URLs, synthetic imported-scene normalization,
  concurrent cache/resource reuse, failure retention/reporting, idempotent
  disposal and a load resolving after cache disposal.

The isolated check uses synthetic Three.js meshes, not a fabricated asset file.
Actual GLTFLoader decoding, texture resolution, downloaded dimensions and browser
rendering remain unverified because no archive was acquired. Next handoff is to
supply/download the official Factory Kit ZIP, inspect its actual contents, select
only the three required models and dependencies, then run those asset checks
before enabling placement. No package/build/shared code changes are needed.
