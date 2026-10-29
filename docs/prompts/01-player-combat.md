# Person 1 · Player, pistol, and integration

Copy everything inside the following block into your coding assistant. Run it from this repository root.

```text
You are Teammate 1, responsible for player controls, pistol combat, round lifecycle,
and integration for Zombie Warehouse, a TypeScript + Three.js + Vite desktop browser FPS.

GOAL
Implement the core player/combat systems so the player can survive a 300-second round
against the enemy system supplied by Teammate 2 in the arena supplied by Teammate 3.
Work in the existing scaffold. It already renders a greybox, supports pointer lock,
WASD/sprint and basic collision, and has menu/pause/state/clock/HUD wiring.
Weapon methods are currently explicit stubs. Do not claim the whole game is complete
until the three subsystems have actually been integrated and verified.

READ FIRST
- README.md
- docs/TASKS.md (P1-01 through P1-05)
- docs/ARCHITECTURE.md
- docs/ACCEPTANCE.md
- src/shared/types.ts, config.ts, assets.ts
- Existing src/game/, src/player/, and src/main.ts

OWNERSHIP
Own src/game/*, src/player/*, src/main.ts, and src/shared/*.
You are the integrator for package.json, package-lock.json, tsconfig.json,
vite.config.ts, and shared-interface changes.
You may add public/models/pistol.glb and its asset-credit row when a license is known.
Do not rewrite src/enemies/*, src/world/*, src/ui/*, src/audio/*, index.html,
or style.css; send the relevant teammate an exact requested change instead.
Keep the existing stack; no React, physics engine, backend, or new dependency is
necessary for the first combat loop. Preserve teammate work.

IMPLEMENT IN ORDER
1. P1-01: verify/harden mouse-look, normalized WASD, sprint, grounded movement,
   collision through WorldQuery.canOccupy, key clearing on unlock/focus loss,
   and one requestAnimationFrame owner. Mouse capture must start directly from
   a user gesture. Failed capture leaves a usable menu with a helpful message.
2. P1-02: implement Weapon.tryShoot with Three.js Raycaster from camera center.
   Begin with one shot per left click, not automatic fire. Gate in active play.
   Use an 8-round magazine, 34 damage, and a 0.25-second fire cooldown from config.
   A valid shot consumes one round even on a miss. Reject shots when empty,
   reloading, paused, or inside a menu. Recursively raycast target roots and
   world shot blockers together. The closest cover hit must stop the bullet.
   Map child meshes back to a Damageable.root by walking parents. Call
   takeDamage once and return its exactly-once kill result.
3. P1-03: implement R reload using 1.5 seconds of simulation time, 48 initial
   reserve rounds, and min(magazine capacity - ammo, reserve) transferred only
   at completion. Full magazine, no reserve, repeat reload, and reload in pause
   are no-ops. Pause freezes reload/fire timers. Restart clears partial reloads.
4. P1-04: attach a simple pistol mesh to the camera, with small recoil/muzzle
   feedback driven by update(dtSeconds). A licensed GLB is optional. Use the
   fallback if loading fails; use ASSETS for paths and dispose owned resources.
5. P1-05: integrate the existing returned attack damage and pickup effects.
   Game applies enemy damage to GameState, pickup health to heal(), ammo to
   Weapon.addAmmo(), and increments kills only for ShotResult.killed.
   Zero HP -> gameOver. 300 active simulation seconds -> victory. Fatal damage
   wins a same-frame tie. Esc, unlock, focus loss, and hidden tabs pause all
   gameplay. Resume preserves the run; a new run resets every subsystem.

CONTRACTS TO PRESERVE
- Weapon.tryShoot(targets: readonly Damageable[],
    blockers: readonly Object3D[]): ShotResult | null
  Null means no shot fired. A miss/cover hit after firing returns
  { hitId: null, killed: false }. A zombie hit returns its ID and whether
  it just died. Weapon applies zombie damage; Game alone awards the kill.
- Weapon.reload(): boolean; Weapon.update(dtSeconds): void;
  Weapon.snapshot: WeaponSnapshot; addAmmo(amount), reset(), dispose().
- Damageable has id, root, isAlive, takeDamage(amount): boolean.
  true means a live-to-dead transition exactly once.
- WorldQuery provides canOccupy(position, radius), bounds, shotBlockers,
  and spawnPoints. Do not duplicate the world's collision geometry.
- ZombieSpawner.update(dtSeconds, elapsedSeconds, playerPosition, world)
  returns player damage; getTargets() returns living Damageable objects.
- Pickups.update(dtSeconds, playerPosition) returns one-time PickupEffect values.
- HUD receives GameSnapshot and calls its constructor callbacks.

TIME, RESET, AND RESOURCES
Use seconds from GameLoop for cooldowns, reloading, recoil, and animations.
Do not add setTimeout/setInterval for gameplay or a second animation loop.
Keep input listeners stable across restarts and clean them up on dispose.
Fresh runs reset HP, time, kills, ammo, reload/cooldown, camera, enemies,
spawn/attack timers, and pickups. Guard optional asynchronous asset loads
against a disposed game or a superseded run.

VERIFICATION
Run npm run typecheck and npm run build. Add focused automated regression
checks for ammo transfer, cooldown/reload pause behavior, kill-once handling,
and death/victory priority where useful. Do not add tests that only mirror
implementation or assert UI wording. In the browser, verify cover occlusion,
recursive mesh hits, empty ammo, partial reserve, pause/resume/restart, and
both round outcomes. Integrate teammates' changes in buildable increments.
Run the combined acceptance checklist after all three systems are connected.

OUT OF SCOPE
Multiplayer, mobile controls, shops, weapon switching, headshot bonuses,
accounts, a backend, and deployment. Complete the greybox loop before polish.

HANDOFF
Report completed P1 task IDs, changed files, exact shared API changes,
demonstration steps, checks actually run and results, and remaining blockers.
If other teammates' features are still stubs, identify them clearly and
provide a concrete integration checklist rather than claiming a playable MVP.
```
