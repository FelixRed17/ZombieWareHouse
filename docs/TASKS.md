# Three-person implementation plan

## Deliverable

Ship a single-player, desktop browser FPS: enter a warehouse, move and aim, fire/reload a pistol, fight increasingly frequent zombies, collect health/ammo, and survive **300 seconds of active play**. Zero health ends the run. Both outcomes show kills and allow a clean restart.

The reference image guides the mood and UI. A playable greybox is the first milestone; visual fidelity is a later pass. Optional upper floors, a radar/minimap, extra zombie types, multiplayer, persistence, accounts, and hosting automation are outside the core milestone.

## Current starting point

- Working: strict TypeScript/Vite setup, Three.js renderer, greybox, basic collision/movement, pointer lock, pause/menu lifecycle, round clock, HUD scaffolding, disposal hooks.
- Partial: `GameState` and `Game` provide the initial composition, but need combat integration verification and regression checks.
- Stubbed: `Weapon.tryShoot/reload/update`, zombie visuals/AI/spawning, pickups, and audio.
- Missing by design: real GLB/audio assets. Do not create empty binary placeholders. Use geometry fallbacks and record imported asset credits.
- `TODO(P1-...)`, `TODO(P2-...)`, and `TODO(P3-...)` refer to the tasks below.

## Ownership

| Person | Primary ownership | Deliverable |
| --- | --- | --- |
| **1 · Player/combat + integrator** | `src/game/`, `src/player/`, `src/main.ts`, `src/shared/`, package/build configuration | Reliable round lifecycle and a usable, accurate pistol |
| **2 · Zombies/AI** | `src/enemies/`, zombie model/animation files and their asset credits | Zombies that spawn, navigate, attack, take damage, and die |
| **3 · World/UI** | `src/world/`, `src/ui/`, `src/audio/`, `style.css`, `index.html`, world assets/audio and their asset credits | Readable arena, working pickups, game screens, and sound |

Person 1 maintains shared contracts, dependency changes, and final integration. Persons 2 and 3 request shared changes with the exact signature and a reason; they can continue against existing interfaces meanwhile. All three can add focused checks for their systems. Keep asset-credit additions to the rows each person owns to minimize conflicts.

Suggested separate branches, if the team uses Git: `codex/player-combat`, `codex/zombies-ai`, `codex/world-ui`. These are suggested names, not branches created by this scaffold.

## Person 1 tasks

| ID | Task | Completion criteria | Dependencies |
| --- | --- | --- | --- |
| P1-01 | Harden player and round lifecycle | Normalized WASD, sprint, readable mouse-look, cover collision, focus loss and Esc pause, one loop, no stuck keys | Existing `WorldQuery`; final collision verified with P3-01 |
| P1-02 | Hitscan pistol | Center-camera Raycaster; one shot per click; cooldown; ammo use on hits and misses; nearest cover blocks targets; recursive child hits map to a zombie root; kill credited once | Existing `Damageable`; live targets from P2-01 |
| P1-03 | Reload and ammo state | 8-round magazine, 48 starting reserve, 1.5s reload, limited transfer, empty/reserve edge cases, paused timers, safe restart | P1-02; snapshots consumed by P3-03 |
| P1-04 | Weapon presentation | Camera-attached fallback pistol; optional GLB; short recoil/muzzle feedback; owned resources disposed; optional asset failure remains playable | P1-02; optional pistol asset |
| P1-05 | Integrate and validate the round | Apply returned attacks/effects; end at zero health or 300 active seconds; fatal damage wins a same-frame tie; reliable restart; minimal logic regression checks | P2-03, P3-02, P3-03 |

Prompt: [01-player-combat.md](prompts/01-player-combat.md).

## Person 2 tasks

| ID | Task | Completion criteria | Dependencies |
| --- | --- | --- | --- |
| P2-01 | Zombie entity | Visible procedural zombie, 100 HP, stable ID/root, exactly-once death transition, dead enemies stop attacking, safe cleanup; optional GLB + mixer | Existing `Damageable` |
| P2-02 | Pursuit and attacks | Frame-rate-independent movement on XZ, collision via `WorldQuery`, obstacle steering, range check and 1s attack cooldown, return damage to Game | P2-01; greybox available now |
| P2-03 | Spawning and difficulty | Valid distant spawn points, first spawn after 4s, interval `max(0.8, 4 - elapsedSeconds / 90)`, maximum 24 alive, no spawning while paused, clean reset | P2-01, P2-02 |
| P2-04 | Enemy verification | Verify damage, death, attack cooldown, spawn limits, reset, and navigating around the central crates; animation absence must not block play | P1-02 integration; P3-01 arena |

The interval is an initial tuning proposal for P2-03, not an already implemented feature. Keep tuning in `GAME_CONFIG` through Person 1. Try a lightweight waypoint or occupancy-grid fallback if simple steering cannot navigate the actual layout; a full navmesh dependency is unnecessary for the first flat arena.

Prompt: [02-zombies-ai.md](prompts/02-zombies-ai.md).

## Person 3 tasks

| ID | Task | Completion criteria | Dependencies |
| --- | --- | --- | --- |
| P3-01 | Playable warehouse | Flat arena with open paths, cover, shelves/crates/barrels, readable blue/warm lighting, collision + shot blockers match visible obstacles, clear spawn locations | Existing `Warehouse` greybox |
| P3-02 | Health/ammo pickups | Distinct meshes, valid positions, distance collection, one effect per collection, capped health handled by Game, replenishable ammo economy, clean reset/disposal | Existing `PickupEffect`; integration with P1-05 |
| P3-03 | HUD and screens | Health, ammo/reserve, reload state, remaining time, kills, crosshair; play/pause/death/victory/restart; helpful pointer-lock failure and desktop guidance | Existing snapshots/callbacks; final flows from P1-05 |
| P3-04 | Audio and final presentation | Gesture-unlocked audio, shot/reload/hit hooks, ambience, mute control, pause/resume, graceful absent assets; asset credits and resource cleanup | P1/P2 hooks; use geometry until assets exist |
| P3-05 | World/UI verification | Pickup effects once, safe spawn/pickup positions, visible targets, legible UI at 1366×768, paused sound/timers, restart removes stale items | P3-01 through P3-04 |

Start with fixed pickup locations. Add controlled respawns so the starting 56 total rounds do not determine the entire five-minute outcome: proposed ammo respawn 15s and health respawn 30s, at most one pickup per location. Person 1 should add agreed values to shared config. These are implementation tasks, not current preview behavior.

Prompt: [03-world-ui.md](prompts/03-world-ui.md).

## Integration milestones

| Milestone | Work that can happen together | Exit gate |
| --- | --- | --- |
| **M0 · Contract agreement** | Everyone reads `ARCHITECTURE.md`, config, and their prompt | Confirm method signatures, units, world bounds, collision ownership, and file ownership before changes |
| **M1 · First combat loop** | P1-01/02/03; P2-01/02; P3-01/03 | One visible zombie can approach, damage the player, be blocked by cover, be shot, and die; ammo and health are real |
| **M2 · Survival round** | P1-05; P2-03; P3-02 | Multiple zombies, increasing pressure, usable pickups, a five-minute win, death, pause, and clean restart |
| **M3 · Presentation and release candidate** | P1-04; P2-04; P3-04/05 | Optional assets/sound, resource cleanup, production build, full acceptance checklist |

Develop against procedural meshes throughout M1 and M2. Model downloads, texture work, and sound sourcing must not block the core loop. Merge small, buildable changes at milestone boundaries rather than waiting for three complete subsystems.

## Team handoff rule

Each handoff includes:

1. Completed task IDs and changed files.
2. Exact public API changes, if any; request agreement before changing another person's boundary.
3. How to demonstrate the feature in the existing app.
4. Actual commands/checks run and observed results.
5. Remaining issues and whether they block the next milestone.

Everyone runs `npm run typecheck` and `npm run build` before handoff. Person 1 runs the combined [acceptance checklist](ACCEPTANCE.md). Add focused automated checks for substantive game logic; avoid tests that only assert class names, DOM copy, or the existence of stub methods.
