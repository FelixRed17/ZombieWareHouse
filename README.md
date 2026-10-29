# Zombie Warehouse

A browser FPS survival game built with **TypeScript, Three.js, and Vite**. The goal is to survive inside a warehouse for five minutes using a pistol, cover, health packs, and ammunition.

This repository contains the **project scaffold and a three-person implementation plan**. The included warehouse preview runs; the full survival game is still to be implemented by the team.

## Start here

```sh
npm install
npm run dev
```

Open the printed local URL, normally `http://127.0.0.1:5173`. Use a desktop browser with WebGL 2, a keyboard, and a mouse. Click **Enter Warehouse** to capture the mouse. Use **WASD** to move, **Shift** to sprint, and **Esc** to pause. Changing tabs also pauses the simulation.

If mouse capture fails inside an embedded preview, open the printed URL directly in a desktop browser and try again. See [verification notes](docs/VERIFICATION.md) for checks completed on this scaffold and the remaining browser checks.

```sh
npm run typecheck
npm run build
npm run preview
```

Node.js **22.12 or later** is the project's baseline. Commit the generated `package-lock.json` with the scaffold so the team can use `npm ci` thereafter.

## What is ready

| Working foundation | Team implementation still required |
| --- | --- |
| Vite entry point and strict TypeScript | Pistol shooting, reload, recoil, and view model |
| Three.js warehouse greybox and lighting | Zombie meshes, AI, attacks, spawning, and animations |
| Pointer-lock mouse-look, WASD, sprint | Health/ammo pickup entities and effects |
| Basic wall/crate collision | GLB asset loading and fallback handling |
| Five-minute simulation clock and health/state helpers | Audio loading, playback, and mute control |
| Menu, pause, end-screen scaffolds, HUD, cleanup | Full gameplay integration and playtesting |

**Weapon, AI, spawning, pickup, and audio files contain explicit TODO stubs.** The preview has no enemies and does not shoot. Reaching the timer's end currently exercises the victory screen without a survival challenge. No `.glb` or `.mp3` files are bundled or fetched.

## Team handoff

Start with [the task board](docs/TASKS.md) and [the integration contracts](docs/ARCHITECTURE.md). Give each teammate their complete prompt:

| Teammate | Focus | Copy-ready AI prompt |
| --- | --- | --- |
| 1 · Player and integration | Round lifecycle, input, pistol, raycasting, reload | [01-player-combat.md](docs/prompts/01-player-combat.md) |
| 2 · Enemies | Zombie entity, pursuit, attacks, spawning, animation | [02-zombies-ai.md](docs/prompts/02-zombies-ai.md) |
| 3 · World and presentation | Warehouse, collisions, pickups, HUD, menus, audio | [03-world-ui.md](docs/prompts/03-world-ui.md) |

## File structure

```text
ZombieWarehouse/
├── public/
│   ├── favicon.svg
│   ├── models/README.md          # expected GLB filenames; binaries not included
│   ├── audio/README.md           # expected audio filenames; binaries not included
│   └── textures/README.md
├── src/
│   ├── main.ts
│   ├── game/
│   │   ├── Game.ts               # composition root; integration belongs here
│   │   ├── GameState.ts          # phases, health, kills, survival time
│   │   └── GameLoop.ts           # single animation loop; seconds-based delta
│   ├── player/
│   │   ├── Player.ts
│   │   ├── PlayerMovement.ts
│   │   └── Weapon.ts
│   ├── enemies/
│   │   ├── Zombie.ts
│   │   ├── ZombieAI.ts
│   │   └── ZombieSpawner.ts
│   ├── world/
│   │   ├── Warehouse.ts
│   │   ├── Lighting.ts
│   │   └── Pickups.ts
│   ├── ui/HUD.ts
│   ├── audio/AudioManager.ts
│   └── shared/
│       ├── config.ts             # agreed tuning values
│       ├── types.ts              # cross-team interfaces
│       └── assets.ts             # base-aware planned asset URLs
├── docs/
│   ├── TASKS.md
│   ├── ARCHITECTURE.md
│   ├── ACCEPTANCE.md
│   ├── VERIFICATION.md
│   ├── ASSET_CREDITS.md
│   ├── reference/design-reference.png
│   └── prompts/
│       ├── 01-player-combat.md
│       ├── 02-zombies-ai.md
│       └── 03-world-ui.md
├── index.html
├── style.css
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

## Scope and visual direction

Use [the supplied reference](docs/reference/design-reference.png) for the dark blue industrial setting, red danger accents, yellow warehouse details, and green victory state. It is concept art, not a game-ready model or texture pack. Prioritize a readable, playable greybox before replacing meshes with licensed assets.

The first release is single-player and desktop-only, with one flat warehouse, one pistol, one zombie type, and two pickup types. Additional weapons, multiplayer, a shop, a backend, mobile touch controls, the optional upper floor, and a minimap are follow-up work.

The output of `npm run build` is `dist/`, suitable for static hosting. `base: './'` and the asset manifest support a repository subdirectory. Hosting setup and deployment are future tasks; there is no deployed site yet.

## Technical references

- [Three.js PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html): mouse-look and pointer lock; movement/collision remain application responsibilities.
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html): the optional model-loading path.
- [Vite guide](https://vite.dev/guide/): development and production builds.
