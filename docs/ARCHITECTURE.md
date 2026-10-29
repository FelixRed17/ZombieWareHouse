# Shared architecture and integration contract

## Dependency direction

```text
main.ts
  └─ Game (composition + input routing + simulation order)
      ├─ GameState + GameLoop
      ├─ Player + Weapon
      ├─ ZombieSpawner → Zombie + ZombieAI
      ├─ Warehouse + Lighting + Pickups
      ├─ HUD
      └─ AudioManager

All systems → shared/types.ts + shared/config.ts
Optional asset loads → shared/assets.ts
```

`Game` is the integration point. Enemies never import `Player`, pickups never import `GameState`, and the HUD never changes health or ammo. Systems return values; Game applies them. Do not introduce a global event bus or a backend for the core prototype.

## Scene organization

```text
Scene
├─ Warehouse (Group)
│  ├─ Floor / Walls
│  ├─ Shelves / Crates / Barrels
│  └─ Optional decorative forklift
├─ Lights (Group)
├─ Camera (Player)
│  └─ Pistol (planned)
├─ Zombie roots (planned)
└─ Pickup meshes (planned)
```

## Units and world

- Right-handed Three.js world; **Y is up**, movement is on **XZ**, camera initially faces **-Z**.
- One scene unit is approximately one metre; all update deltas and cooldowns use **seconds**.
- Initial bounds: X `[-20, 20]`, Z `[-28, 28]`, wall height `9`. Ground is Y `0`; eye height `1.7`.
- Player starts at `(0, 1.7, 18)`. Zombie roots and pickups sit on ground Y `0`; do not copy eye height into their roots.
- Movement uses a circular footprint. `canOccupy(position, radius)` tests XZ and ignores the caller's Y. It must remain pure and must not mutate `position`.
- Spawn points are shared read-only world positions. Clone a point before moving an entity to it.
- `Warehouse` owns collision bounds, solid footprints, shot blockers, and spawn points. Everyone queries the same geometry rules.
- `shotBlockers` includes visible shot-obstructing meshes, including overhead geometry. A walkable space under a shelf does not make that shelf transparent to bullets.

The scaffold uses axis-separated grounded movement. Add neither jumping nor a full physics engine before the basic round works.

## Agreed APIs

These signatures already exist in source. Extend them through the integrator rather than independently inventing new cross-team messages.

| System | Boundary | Meaning |
| --- | --- | --- |
| World | `canOccupy(position: Vector3, radius: number): boolean` | True if a circular actor footprint fits in the arena without intersecting a ground obstacle |
| World | `bounds`, `shotBlockers`, `spawnPoints` | Read-only inputs for movement, raycasting, and spawning |
| Player | `position`, `update(dtSeconds, world)`, `reset()`, `dispose()` | Camera position and movement lifecycle |
| Weapon | `tryShoot(targets, blockers): ShotResult \| null` | Null = no shot fired; non-null = shot fired, including a miss; applies zombie damage internally |
| Weapon | `reload(): boolean`, `update(dtSeconds)` | Reload returns whether a reload started; update advances simulation timers |
| Weapon | `snapshot`, `addAmmo(amount)`, `reset()`, `dispose()` | Read-only HUD ammo values, pickup effect, and lifecycle |
| Zombie | `id`, `root`, `isAlive`, `takeDamage(amount): boolean` | Root maps recursive ray hits to an entity; true only on a fresh death |
| Zombie AI | `update(zombie, dtSeconds, playerPosition, world): number` | Move/attack and return player damage for this update; return zero if no attack |
| Spawner | `update(dtSeconds, elapsedSeconds, playerPosition, world): number` | Spawn/update enemies and return total attack damage for Game |
| Spawner | `getTargets(): readonly Damageable[]` | Living entities only; Weapon raycasts their roots |
| Pickups | `update(dtSeconds, playerPosition): readonly PickupEffect[]` | Collected effects to apply once this frame |
| HUD | `render(snapshot)` + constructor callbacks | Display state; request play/resume/restart/menu via callbacks |
| Audio | `unlock()`, `setPlaying(playing)`, `play(sound)`, `dispose()` | Gesture setup, pause/resume, one-shot effects, and cleanup |

`ShotResult` has `hitId: string | null` and `killed: boolean`. A miss or a cover hit returns `{ hitId: null, killed: false }` after consuming one round. Weapon calls `takeDamage` once; Game increases kills only if `killed` is true. Raycast recursively against targets and cover together, sort by distance, and act only on the closest valid hit. Resolve target child meshes by walking parent links up to `Damageable.root`.

`PickupEffect` is `{ kind: 'health' | 'ammo', amount: number }`. Remove or deactivate a pickup before returning its effect so a later update cannot collect it again. Game routes health to `GameState.heal` and ammo to `Weapon.addAmmo`.

If zombie-hit audio or radar positions are added, agree a small typed extension with Person 1; do not silently import AudioManager or HUD into enemy classes.

## State and time

```text
menu ── successful user-triggered pointer lock ──► playing
playing ── Esc / unlock / focus loss ──► paused
paused ── Resume + successful pointer lock ──► playing
playing ── health reaches 0 ──► gameOver
playing ── 300 active seconds ──► victory
paused / gameOver / victory ── Main menu ──► menu
gameOver / victory ── Restart + pointer lock ──► fresh playing state
```

Only `GameLoop` owns `requestAnimationFrame`. It caps delta at `0.05` seconds after a stall. Gameplay updates only when the phase is `playing` and pointer lock is active. The timer therefore measures simulated active play, excluding pauses and capped-away stalls.

Do not use `setInterval`, `setTimeout`, real-time timestamps, or independent animation loops for spawning, reloading, zombie attacks, pickup respawns, recoil, or animation. Advance those with the delta passed by Game so pause behavior is consistent. AnimationMixer also receives seconds.

The existing simulation order is:

1. Move the player against world collision.
2. Advance weapon timers.
3. Update enemies and apply their returned attack damage.
4. If the player is still alive, collect/apply pickup effects and advance the survival timer.
5. Release pointer lock on an outcome, render a snapshot, then render the scene.

Shooting/reload requests are routed by Game from browser input, gated on active play and pointer lock. Avoid doing damage from UI callbacks. Fatal damage takes priority when death and the end of the round occur in the same update.

## Lifecycle and asset handling

- A fresh round resets health, timer, kills, player position/orientation, weapon ammo/reload/recoil, enemy entities/timers, and pickups/respawns.
- Returning to the menu freezes simulation. Starting from the menu always resets the round after mouse capture succeeds.
- Use one-time listeners with cleanup; the scaffold uses AbortController for browser listeners. Avoid adding new listeners on each restart.
- `dispose()` detaches meshes and cleans up resources/listeners owned by that system. Never dispose cached shared geometry, materials, textures, or clips while another entity uses them.
- For animated GLB clones use a skinned-mesh-safe clone (such as the Three.js SkeletonUtils addon), one mixer per instance, and explicit clip-name mapping. Missing walk/attack/death clips must fall back gracefully.
- Load optional assets asynchronously, cache them, and guard against a load completing after a reset/dispose. A missing or failed asset keeps the procedural version playable and does not block the menu.
- Asset paths come from `ASSETS`, which includes `import.meta.env.BASE_URL`. Do not hardcode `/models/...` or `/audio/...` in modules.
- No asset requests are made by the current scaffold; public README files describe what to add. The design reference is not an authorized source of individual game assets.

## Baseline tuning

`src/shared/config.ts` is authoritative: 300 seconds, 100 player HP, 8+48 pistol ammo, 34 shot damage, 0.25s fire cooldown, 1.5s reload, 100 zombie HP, 10 attack damage, 1s attack cooldown, 24 maximum live zombies. Standard zombies therefore take three unmodified pistol hits. Headshot multipliers are outside the initial milestone.

## Official references

- [PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html)
- [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Raycaster](https://threejs.org/docs/pages/Raycaster.html)
- [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
