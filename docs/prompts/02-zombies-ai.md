# Person 2 · Zombies, AI, and spawning

Copy everything inside the following block into your coding assistant. Run it from this repository root.

```text
You are Teammate 2, responsible for enemies in Zombie Warehouse, a TypeScript +
Three.js + Vite desktop browser FPS. Teammate 1 owns player/combat and integration;
Teammate 3 owns the world, pickups, UI, and audio.

GOAL
Implement visible, damageable zombies that spawn over a 300-second round,
pursue the player around warehouse obstacles, attack at close range, and die.
Start with procedural meshes so external assets never block a playable core loop.
The current Zombie has an empty Group and a basic exactly-once damage transition;
ZombieAI and spawning are explicit stubs. Extend the existing files.

READ FIRST
- README.md
- docs/TASKS.md (P2-01 through P2-04)
- docs/ARCHITECTURE.md
- docs/ACCEPTANCE.md
- src/shared/types.ts, config.ts, assets.ts
- src/enemies/* and src/world/Warehouse.ts for the available query interface

OWNERSHIP
Own src/enemies/* and any additional enemy-local helper files.
Own public/models/zombie.glb and its row in docs/ASSET_CREDITS.md if sourced.
Do not modify src/game/*, src/player/*, src/world/*, src/ui/*, src/audio/*,
shared files, package/build config, or styling. Ask Teammate 1 for an exact
shared-signature/config/dependency change; ask Teammate 3 about world geometry.
Work against the existing interfaces while those requests are reviewed.

IMPLEMENT IN ORDER
1. P2-01: build a recognizable procedural zombie using simple Three.js meshes.
   Keep its root on ground Y=0, give it 100 HP from config, a stable unique ID,
   and child meshes that Weapon can map back to the root. A 34-damage pistol
   hit therefore needs three ordinary hits to kill. takeDamage() returns true
   only on the first transition to dead. Dead enemies stop attacks immediately,
   disappear after a short simulation-driven death effect, and are removed.
2. P2-02: implement XZ pursuit at configured speed using dtSeconds. Query
   WorldQuery.canOccupy(position, zombieRadius) for every move. Steering must
   navigate around the central crates, not just push into them forever.
   Use a small waypoint/occupancy-grid fallback if simple local steering fails.
   Attack only within the configured 1.3 range; apply 10 damage no more often
   than once per configured 1-second attack cooldown per zombie. Return damage
   to Game instead of mutating player state. Avoid obvious enemy stacking with
   lightweight separation if needed; do not add a physics/navmesh dependency.
3. P2-03: create zombies at valid shared spawn points at least 8 units from
   the player, outside obstacles and within arena bounds. Spawn first after
   4 active seconds, then use max(0.8, 4 - elapsedSeconds / 90) as the initial
   interval curve. Enforce a maximum of 24 living enemies. If no point is valid,
   defer the attempt without an infinite search. Accumulate time from updates;
   do not create real-time timers or a second animation loop. Reset all timers
   and remove old entities on a new run.
4. P2-04: verify the complete spawn/pursue/attack/damage/death lifecycle.
   Optional asset pass: use GLTFLoader and AnimationMixer for a licensed zombie
   with walk/attack/death clips. Map actual clip names explicitly and tolerate
   absent clips. Use a skinned-mesh-safe clone and separate mixers for animated
   instances; keep the procedural version available if the GLB fails to load.

CONTRACTS TO PRESERVE
- Zombie implements Damageable:
  id: string; root: Object3D; isAlive: boolean;
  takeDamage(amount: number): boolean (fresh death only).
- Zombie.update(dtSeconds) advances owned visual animation/cleanup.
- ZombieAI.update(zombie, dtSeconds, playerPosition, world): number
  returns damage dealt to the player in this simulation update.
- ZombieSpawner.update(dtSeconds, elapsedSeconds, playerPosition, world): number
  returns the sum of attack damage this update.
- ZombieSpawner.getTargets(): readonly Damageable[] returns live entities only.
- ZombieSpawner.reset() removes all previous entities and resets spawn/AI timers;
  dispose() additionally cleans up owned persistent resources.
- WorldQuery exposes readonly bounds, spawnPoints, shotBlockers,
  canOccupy(position: Vector3, radius: number): boolean.
  Do not mutate incoming playerPosition or shared spawn-point vectors.

TIME, MODEL LOADING, AND RESOURCES
One world unit is about one metre, Y is up, movement is on XZ, and every delta
and cooldown is in seconds. Game does not update enemies while paused or after
an outcome; never bypass that rule with timeouts, intervals, or Date.now().
Use GAME_CONFIG; coordinate tuning additions with Teammate 1.
Use ASSETS.models.zombie for the optional URL; do not fetch an absent file
unconditionally. Cache source models and distinguish shared resources from
instance-owned resources. Reset/dispose must prevent delayed loads from adding
old zombies. Uncache/stop mixers and dispose resources only when safe.
No enemy class may import Player, HUD, GameState, or AudioManager. Request a
small typed integration hook if sound or death metadata is needed later.

VERIFICATION
Run npm run typecheck and npm run build. Add meaningful focused checks for
health/death-once, attack cooldown/range, spawn distance/cap, and reset behavior.
Demonstrate navigating around both central crates, attacking only when in range,
being blocked by cover, dying to pistol damage, no duplicate kill awards, and
no spawns/attacks/animations during pause. Verify at the configured live cap.
Coordinate a browser check with Teammate 1 when their weapon is ready.

OUT OF SCOPE
Bosses, multiple enemy classes, gore, complex ragdolls, multiplayer,
advanced navigation infrastructure, and model polish before basic AI works.

HANDOFF
Report completed P2 task IDs, changed files, exact public methods, demonstration
steps, commands/checks actually run, known navigation limits, and remaining
integration requests. If a model is included, report its source/license and
actual animation clip names. Do not describe procedural enemies as loaded GLBs.
```
