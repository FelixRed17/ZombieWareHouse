# Person 3 · Warehouse, pickups, UI, and audio

Copy everything inside the following block into your coding assistant. Run it from this repository root.

```text
You are Teammate 3, responsible for the environment and presentation of Zombie
Warehouse, a TypeScript + Three.js + Vite desktop browser FPS. Teammate 1 owns
player/combat and integration; Teammate 2 owns zombies/AI/spawning.

GOAL
Deliver a readable warehouse arena, working health/ammo pickups, complete HUD
and menu flows, and optional sound for a five-minute survival game. Build on
the existing rendered greybox, lighting, collision query, and HUD scaffold.
Pickups and AudioManager are currently explicit stubs. Use the supplied image
as mood/layout reference; it is not a source of game-ready assets.

READ FIRST
- README.md
- docs/TASKS.md (P3-01 through P3-05)
- docs/ARCHITECTURE.md
- docs/ACCEPTANCE.md and docs/ASSET_CREDITS.md
- src/shared/types.ts, config.ts, assets.ts
- src/world/*, src/ui/HUD.ts, src/audio/AudioManager.ts, style.css, index.html
- docs/reference/design-reference.png

OWNERSHIP
Own src/world/*, src/ui/*, src/audio/*, style.css, and index.html.
Own world/prop assets in public/models/, public/textures/, public/audio/,
and their rows in docs/ASSET_CREDITS.md. Teammate 1 owns the pistol model;
Teammate 2 owns the zombie model. Do not change their assets or modules.
Do not modify src/game/*, src/player/*, src/enemies/*, src/shared/*,
package.json, or build config. Request exact shared changes from Teammate 1.
Preserve existing callback and snapshot contracts so work integrates directly.

IMPLEMENT IN ORDER
1. P3-01: refine the flat 40x56 warehouse. Keep player start (0,1.7,18), open
   routes through the center and around cover, storage racks, crates, and barrels.
   Provide readable cool blue lighting with warm industrial accents. Keep the
   dark steel palette, red danger UI, yellow details, and green victory state.
   Retain pure WorldQuery.canOccupy(position,radius) for circular XZ footprints,
   world bounds, readonly spawnPoints, and shotBlockers. Match every visible
   solid obstacle to collision and raycast blockers. Validate the player start,
   enemy spawn points, and all pickup positions. Do not add an upper floor yet.
2. P3-02: implement distinct health and ammo pickup meshes. Use configured
   25 health, 16 reserve ammo, and 1.2 collection radius. update(dtSeconds,
   playerPosition) returns PickupEffect values; it never directly mutates
   Player or GameState. Mark/remove an item before returning its effect so
   it cannot be collected twice. Start with fixed valid positions. Coordinate
   shared-config values for proposed 15s ammo and 30s health respawns, with at
   most one item per location. Reset recreates a clean set and clears timers.
   Ammo must remain obtainable through the full five-minute survival round.
3. P3-03: finish the actual game UI using HTML/CSS. Display real health,
   ammo/reserve, reload progress/state, remaining time, kills, and crosshair.
   Implement main menu, pause, death, victory, restart, and return to menu via
   the existing callbacks. Keep actions as real focusable buttons, show useful
   desktop controls and pointer-lock error guidance, and check legibility at
   1366x768. UI must not mutate simulation state or independently count time.
   Keep preview/stub wording until all core gameplay actually exists. Remove
   that wording only as a coordinated final integration change. A minimap,
   graphics/settings screens, and fake nonfunctional controls are unnecessary.
4. P3-04: implement AudioManager using Web Audio or Three.js Audio. unlock()
   runs from a user gesture; setPlaying() handles pause/resume/ambience.
   Support pistol/reload/zombieGrowl/zombieHit sounds and mute with a clear UI
   control. Coordinate additional hooks with Teammate 1; do not import audio
   into enemy logic. Missing files must leave gameplay usable and reasonably
   quiet in the console. Optional GLBs/textures should use geometry fallbacks.
5. P3-05: verify collision/cover alignment, pickup effects/respawns, readability,
   all menu actions, mute, focus loss, pause, and clean restart. Record actual
   asset sources/licenses. Keep performance costs bounded and prefer simple
   materials/lights before expensive shadows, particles, or post-processing.

CONTRACTS TO PRESERVE
- Warehouse implements WorldQuery:
  bounds: Box3; shotBlockers: readonly Object3D[];
  spawnPoints: readonly Vector3[];
  canOccupy(position: Vector3, radius: number): boolean.
  Collision tests only XZ, ignores the caller's Y, and never mutates arguments.
- Pickups.update(dtSeconds, playerPosition): readonly PickupEffect[];
  PickupEffect = { kind: 'health' | 'ammo', amount: number }.
  Game applies health through heal() (capped at 100) or ammo to weapon reserve.
  Pickups.reset()/dispose() handle timers, meshes, and resource ownership.
- HUD.render(snapshot: GameSnapshot) displays data only. Phases are menu,
  playing, paused, gameOver, victory. Constructor callbacks are onPlay,
  onResume, onRestart, onMenu. Do not directly set a phase in the HUD.
- AudioManager.unlock(), setPlaying(boolean), play(sound), dispose().
  Agree an API extension if needed rather than inventing a global event bus.

TIME, ASSETS, AND RESOURCES
Use dtSeconds for pickup animation and respawns; no gameplay setTimeout,
setInterval, Date.now(), or independent requestAnimationFrame loops.
Pause and outcomes must stop simulation-driven animation and active audio.
All optional models/sounds use shared ASSETS paths so repository-subdirectory
hosting works. Do not commit empty .glb/.mp3 files or block the first screen
on model downloads. If assets are unavailable, retain procedural fallbacks.
Record the actual source/author/license/attribution for each included asset;
the name Kenney or Poly Pizza by itself is not a license record.
Avoid listeners or duplicate audio contexts on each restart. Clean up owned
materials/geometry/textures/audio nodes and guard delayed asset loads after
reset/dispose. Do not dispose resources still shared by other entities.

VERIFICATION
Run npm run typecheck and npm run build. Add focused checks where appropriate
for collision boundaries, one-time pickup effects, and respawn/reset rules;
do not test visual copy or only the existence of UI elements. In a desktop
browser, exercise all screens and actions, verify collectible locations are
reachable, ammo enters reserve, health is capped by Game, pause freezes item
respawns and audio, and restart leaves no stale or duplicate items/sounds.
Check labels/readability at 1366x768 and graceful narrow-screen guidance.

OUT OF SCOPE
Minimap/radar, the optional mezzanine, a shop, new weapons, mobile play,
accounts, a backend, deployment, and asset polish that delays the core round.

HANDOFF
Report completed P3 task IDs, changed files, exact integration requests,
demonstration steps, checks actually run, asset credits, and remaining blockers.
Clearly distinguish completed functionality from optional visual/audio work.
```
