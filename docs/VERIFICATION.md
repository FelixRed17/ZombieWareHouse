# Integration verification · 29 October 2026

## Result

The player/combat implementation and the production build pass their focused checks. The combined MVP is **not release ready**: the enemy, AI/spawner, and pickup systems remain stubs, so M1's visible zombie loop and M2's survival round cannot pass. The full five-minute timer did reach the production victory screen in a real desktop browser run, but no enemies spawned and that run is not evidence of a zombie survival round.

## P1 and integration milestones

| Work | Result | Evidence |
| --- | --- | --- |
| P1-01 · player lifecycle | Implemented; code/regression checks pass | Normalized WASD, sprint, grounded movement, world collision query, key clearing, focus/visibility pause, pointer lock, and one `GameLoop` owner. Live Safari movement, Esc pause, hidden-tab pause, resume, and timer freeze were observed. |
| P1-02 · hitscan pistol | Implemented; live target acceptance blocked | Browser regressions pass for miss ammo cost, cooldown, recursive child hit resolution, nearest cover, dead-target exclusion, and exactly-once kill result. Production Safari miss consumed one round. No live zombie exists to verify a real hit or kill. |
| P1-03 · reload/ammo | Implemented and verified | Browser regressions cover 1.5 seconds, full magazine, zero reserve, three-round partial reserve, repeated request, pause freeze, and reset mid-reload. Safari production reload showed `…`, then transferred 2 rounds from 48 reserve to fill 6→8. |
| P1-04 · weapon presentation | Implemented and verified | Procedural camera-attached pistol, recoil/flash simulation, reset pose, and owned-resource disposal pass focused checks. No optional GLB is included or required. |
| P1-05 · round integration | Integration code implemented; live enemy/pickup acceptance blocked | Game routes returned enemy damage, health/ammo pickup effects, kills, and terminal state through `GameplayFrame`. Regression checks cover routing/order and fatal-damage priority. Production timer reached 00:00 and victory after 300 active seconds; death and real subsystem effects cannot be exercised without the stubs being completed. |
| M0 · shared contracts | Passed | Current code matches `docs/ARCHITECTURE.md`: `WorldQuery`, `Damageable`, `ShotResult`, `PickupEffect`, snapshot and system update signatures remain unchanged. |
| M1 · first combat loop | Blocked | `Zombie.root` is an empty `Group`; `ZombieAI` returns no damage; `ZombieSpawner` creates nothing. No visible zombie can approach, attack, be shot, or die in the integrated game. |
| M2 · survival round | Blocked | No enemy spawning or pickup implementation. A real five-minute timer run completed, but had 100 HP, zero kills, and no enemy/pickup pressure. |
| M3 · release candidate | Blocked | Build/preview work, but enemy visuals/AI/spawning, pickups, and audio are incomplete; 1366×768 and numeric FPS were not verified. |

## Checks executed

- `npm run typecheck` — passed.
- `npm run build` — passed; Vite emitted its existing warning that the minified JS chunk is about 508.58 kB, above the 500 kB advisory threshold.
- `git diff --check` — passed.
- `npm list --depth=0` — passed; only declared Three.js, TypeScript, Vite, and Three.js types are installed. No dependency was added.
- Browser regression page `http://127.0.0.1:5173/tests/index.html` — **37/37 checks passed** after adding movement normalization, pitch independence, sprint/collision-query, and focus key-clear cases. The suite also exercises recursive target children, cover ordering, ammo, reload edge cases, frame routing, death/victory priority, reset, and exactly-once kill accounting. Test-created targets are logic regressions, not live-game evidence.
- Production preview `http://127.0.0.1:4173/` — opened in desktop Safari. Main menu, warehouse, pointer lock, movement, live missed shots, reload, Esc pause, hidden-tab pause, resume, three menu/Enter restart cycles, victory restart, and terminal victory were exercised.
- A five-minute **real active-time** production run advanced from 05:00 to 00:00 and reached `SHIFT SURVIVED`. The run included movement, shots, and a reload. It had no zombies; this verifies the timer and victory route only, not survival combat.
- No temporary tuning was applied, so no tuning restoration was needed.

## Acceptance checklist results

Status meanings: **Passed** means the stated check has direct evidence at the scope described; **Failed** means an observable requirement is currently wrong; **Blocked** means an incomplete dependency prevents a meaningful live check; **Not run** means no check was performed.

### Scaffold smoke check

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| `npm ci` succeeds from the committed lockfile | Not run | Dependencies were already installed. `npm list --depth=0`, typecheck, and build succeeded; `npm ci` was not executed. |
| Typecheck and production build succeed | Passed | `npm run typecheck` and `npm run build` succeeded. |
| Main menu renders the warehouse without application errors | Passed | Safari production preview rendered the warehouse and HUD. Safari's production JavaScript console showed no errors. |
| Enter captures mouse, hides panel, shows crosshair, starts timer | Passed | Native Safari pointer capture succeeded; panel disappeared, crosshair appeared, and timer counted down. |
| WASD/sprint movement, ground, walls, and crates | Blocked | Live forward/strafe movement and regression sprint/diagonal/world-query collision checks passed. Live collision against the actual warehouse walls/crates was not demonstrated. |
| Esc/focus loss pauses and pause wait does not consume time | Passed | Esc reached `SHIFT PAUSED`; a three-second paused wait kept 04:49 unchanged. Switching away to another Safari tab also returned to a paused screen. |
| Resume recaptures mouse without resetting | Passed | Resume restored pointer capture; health 100, ammo 7/48, and timer continued from the paused value rather than resetting. |
| Main menu then Enter resets position/time/stats | Passed | Three production menu/Enter cycles each returned to 05:00, 100 HP, 0 kills, and 8/48 ammo. |
| UI clearly says which features remain unfinished | Failed | Game's active notice now says live enemies, pickups, and audio are not integrated. HUD-owned static copy still says combat is a team task and labels the pistol a planned loadout, although player combat is implemented. |

### Combat and round lifecycle · Person 1

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| Normalized diagonal movement; pitch does not change horizontal speed | Passed | Regression compares forward, diagonal, and pitched-forward travel against configured walk speed. |
| Shots cost ammo on hits and misses; cooldown rejects extra attempts | Blocked | Live production miss consumed one round; logic regressions cover hits, misses, cooldown, and kill transition. A real zombie hit is blocked by the missing enemy implementation. |
| Empty magazine, reloading, pause, and menus reject shots | Passed | Regressions cover empty/reloading/input gates. A live paused click left ammo at 7/48; live reload ran in Safari. |
| Cover blocks a shot at a zombie behind it | Blocked | Nearest-cover regression passed with constructed meshes; no live zombie/cover encounter exists to verify integration. |
| Recursive child hit maps to zombie and death credits once | Blocked | Nested-child and three-hit/exactly-once regressions passed against a test `Damageable`; no real zombie target exists. |
| Reload takes 1.5 active seconds and transfers only available reserve | Passed | Timed reload and three-round partial-reserve regression passed. Production Safari showed reload state and transfer completion. |
| Full-magazine, zero-reserve, partial-reserve, repeat, pause, and restart reload cases | Passed | All listed cases pass focused browser regressions; restart restores 8/48 and clears reload state. |
| Fatal damage ends run; health is clamped | Blocked | `GameState` regression covers health floor/cap and game-over phase. No integrated attacker can inflict fatal damage in the production game. |
| 300 active seconds wins; death beats a same-frame timeout | Passed | Real Safari production timer reached 00:00 and victory. Same-frame death priority passes a `GameplayFrame` regression. |

### Enemies · Person 2

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| Zombies spawn at valid positions at least 8 units away | Blocked | `ZombieSpawner.update` is a stub and creates no zombies. |
| Zombies pursue on XZ and avoid crates/walls | Blocked | `ZombieAI.update` returns 0 and does not move zombies. |
| Zombies navigate around both central crates | Blocked | No pursuit implementation to exercise. |
| Attacks require range and respect cooldown | Blocked | No AI attack implementation. |
| No attacks/spawns/mixer progression during pause/outcome | Blocked | Game freezes subsystem updates, but the enemy subsystem is absent so entity timer behavior cannot be verified. |
| Three 34-damage hits kill 100 HP exactly once | Blocked | Weapon logic regression passes against a test target; production has no zombie entity or visible target. |
| Spawn pressure increases, cap is 24, and restart resets it | Blocked | Spawner is a stub. |
| Missing model/animation clips leave a procedural enemy | Blocked | Current `Zombie` has an empty root and no procedural body fallback. No enemy model/animation assets are present. |

### World, pickups, presentation · Person 3

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| Visible cover, movement collision, and shot blockers agree | Blocked | Warehouse meshes and collision/blocker code are present, and the scene renders. Live shooting at a zombie behind actual cover is blocked by missing zombies. |
| Player and spawn points are reachable and outside obstacles | Not run | Player start and configured spawn coordinates are present in source; no live spawner used them during the run. |
| Targets are readable under warehouse lighting | Blocked | No targets are present to evaluate. |
| Health/ammo pickups are distinct and collect once | Blocked | `Pickups` has no item meshes and returns no effects. |
| Health caps at 100; ammo adds to reserve without filling magazine | Blocked | Game routing and `GameState`/`Weapon` unit checks pass, but real pickup effects are unavailable. |
| Controlled pickup respawns support five minutes without duplicates | Blocked | `Pickups` is a stub. |
| HUD shows real stats/reload and menu buttons work | Passed | Production HUD showed changing timer/ammo, reload ellipsis/completion, pause, victory, and working play/resume/menu/restart controls. |
| Main/pause/death/victory screens are legible at 1366×768 | Not run | Main, pause, and victory rendered at the available desktop Safari size; 1366×768 and the death screen were not checked. |
| Audio unlock/mute/pause and missing files are safe | Blocked | `AudioManager` methods remain stubs; no audio behavior is implemented. |
| Third-party assets have source/author/license attribution | Passed | No third-party models, textures, or audio are included; `public/` contains only asset README placeholders and the project favicon. |

### Combined run · all three

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| Real five-minute desktop-browser survival run | Blocked | A full 300-second production timer run completed in Safari, but had zero zombies and cannot prove survival combat. |
| Temporary configuration verifies death/victory/restart and is restored | Blocked | No temporary configuration was used. Victory and restart were verified at release tuning; death is blocked by the missing enemy system. |
| Three restarts leave no duplicate enemies, pickups, handlers, audio, or loops | Blocked | Three production restarts reset HUD state. A single click after each restart spent exactly one round, and no extra canvas/loop was visible. Enemy, pickup, and audio duplication cannot be assessed because those systems do not exist yet. |
| No stale asynchronous asset loads add old-run objects | Passed | No optional models/audio were requested or loaded, so there were no asynchronous asset completions to become stale. |
| Console errors and rendering performance recorded | Not run | Safari 27.2 on a MacBook Pro running macOS 27.2 showed no production console errors and the scene appeared visually smooth during movement and the five-minute run. Numeric FPS was not instrumented. The separate in-app Chromium preview logged pointer-lock API `UnknownError`s; Safari captured successfully. |
| Production preview works (subdirectory check if selected) | Passed | Production root preview loaded and played in Safari. `vite.config.ts` uses relative `base: './'`; no subdirectory deployment was selected or exercised. |

## Remaining source stubs and teammate requests

- **Teammate 2 — enemies:** implement the procedural visible zombie body and cleanup in `Zombie`; XZ pursuit, collision/obstacle steering, range and cooldown attacks in `ZombieAI`; and spawn timing, valid distant points, 24-live cap, and reset in `ZombieSpawner`. Keep the existing `Damageable`, `ZombieAI.update(zombie, dtSeconds, playerPosition, world): number`, `ZombieSpawner.update(dtSeconds, elapsedSeconds, playerPosition, world): number`, and `getTargets(): readonly Damageable[]` contracts. Then demonstrate a live zombie approaching, damaging, being blocked by cover, taking three shots, dying once, and awarding one kill.
- **Teammate 3 — pickups:** implement visible health/ammo pickup meshes, one-time `PickupEffect` results, configured respawns, and reset/disposal in `Pickups`, preserving `update(dtSeconds, playerPosition): readonly PickupEffect[]`.
- **Teammate 3 — HUD/static copy:** replace the static “combat, enemies, pickups, and audio are team tasks” copy and “PISTOL / PLANNED LOADOUT” label. State that movement/player pistol are implemented while live enemies and pickups are missing and audio is still stubbed; retain development-preview wording until M1/M2 acceptance passes.
- **Teammate 3 — audio:** implement the `AudioManager` gesture unlock, play/pause, one-shot hooks, graceful missing-asset behavior, mute/pause flow if part of P3-04, and disposal. Keep asset absence playable and add no placeholder binaries.
- **Teammate 3 — lighting (non-blocking P3-01 TODO):** once a visible zombie target is integrated, check target readability in the warehouse and tune fog/light levels; add shadows only within a small rendering budget.

## Source and shared contract notes

No shared `src/shared/types.ts` signature changed. `WorldQuery`, `Damageable`, `ShotResult`, `PickupEffect`, `GameSnapshot`, and each system method contract still match `docs/ARCHITECTURE.md`. The internal `GameplayFrame` helper composes the existing system values and is not a new cross-team contract. Current `src/shared/config.ts` values remain the release tuning: 300 seconds, 100 HP, 8+48 rounds, 34 damage, 0.25-second fire cooldown, 1.5-second reload, 10 damage per zombie attack, and 24 maximum live zombies.

No new dependency or asset was added. `public/models/`, `public/audio/`, and `public/textures/` contain README placeholders only; optional GLB and audio files are absent. The pistol and warehouse use geometry fallbacks. The zombie does not yet have a procedural body fallback. CSS may request Barlow fonts from Google Fonts and has system-font fallbacks.
