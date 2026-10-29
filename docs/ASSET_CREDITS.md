# Asset register

The current world, pickups, HUD icon, favicon, and audio are created by project code. No downloaded models, textures, fonts, icons, or sounds are required or bundled.

The user-supplied `docs/reference/design-reference.png` is retained only as design reference. Do not extract models, music, logos, or textures from it or assume any third-party licensing rights.

The UI uses system fonts supplied by the browser/operating system. It makes no web-font requests. The warehouse floor pattern is a runtime-generated Three.js `DataTexture`; prop and pickup visuals use original Three.js geometry and materials. AudioManager synthesizes tones, filtered noise, and ambience with Web Audio. These are project-authored procedural assets and use no external recordings or attribution.

| Local path | Owner | Source / author | License / attribution | Status |
| --- | --- | --- | --- | --- |
| `src/world/Warehouse.ts` | Person 3 | Project-authored Three.js geometry, materials, and generated `DataTexture` | No third-party asset; no external attribution | In use; generated at runtime |
| `src/world/PropFactory.ts` | Person 3 | Project-authored merged crate, barrel, pallet, and rack geometry | No third-party asset; no external attribution | In use; generated at runtime |
| `src/world/Pickups.ts` | Person 3 | Project-authored medical-case and ammunition-crate geometry/materials | No third-party asset; no external attribution | In use; generated at runtime |
| `src/world/Lighting.ts` | Person 3 | Project-authored Three.js lights, fog, and color values | No third-party asset; no external attribution | In use; generated at runtime |
| `src/audio/AudioManager.ts` | Person 3 | Project-authored Web Audio oscillators, filters, envelopes, and generated noise | No third-party recording; no external attribution | In use; synthesized at runtime |
| `src/ui/HUD.ts` | Person 3 | Original inline SVG speaker control and HTML UI | No third-party icon; no external attribution | In use |
| `style.css` | Person 3 | Project-authored CSS and system-font stack | No bundled font or external request | In use |
| `public/favicon.svg` | Person 3 | Original project SVG | No third-party icon; no external attribution | In use |

Before adding a game asset, record the actual downloaded item's source, author, license, and attribution requirements. A provider's name alone is not a license. Kenney and Poly Pizza are suggested sources from the project brief; no item has been selected or downloaded.

| Local path | Owner | Source / author | License / attribution | Status |
| --- | --- | --- | --- | --- |
| `public/models/zombie.glb` | Person 2 | To select | To verify | Not included |
| `public/models/pistol.glb` | Person 1 | To select | To verify | Not included |
| `public/models/crate.glb` | Person 3 | To select | To verify | Not included |
| `public/models/barrel.glb` | Person 3 | To select | To verify | Not included |
| `public/models/warehouse.glb` | Person 3 | To select, optional | To verify | Not included |
| `public/audio/pistol.mp3` | Person 3 | To select | To verify | Not included |
| `public/audio/reload.mp3` | Person 3 | To select | To verify | Not included |
| `public/audio/zombie-growl.mp3` | Person 3 | To select | To verify | Not included |
| `public/audio/zombie-hit.mp3` | Person 3 | To select | To verify | Not included |
| `public/audio/ambience.mp3` | Person 3 | To select | To verify | Not included |

## Person 3 — Prompt 1 acquisition attempt (2026-10-29)

**Optional sourcing attempt; no downloaded category is included.** The official [Factory Kit](https://kenney.nl/assets/factory-kit)
and [Survival Kit](https://kenney.nl/assets/survival-kit) pages list Creative Commons CC0
([license](https://creativecommons.org/publicdomain/zero/1.0/)). This establishes the pack
license, not the contents of an archive we could not inspect.

The Factory Kit page linked this exact archive URL:
https://kenney.nl/media/pages/assets/factory-kit/edaac9d4f6-1777639602/kenney_factory-kit_3.0.zip

Downloading it returned HTTP 403, including a retry through `www.kenney.nl`.
The archive was not obtained. No original model filenames, dependency paths, or
local binary paths can yet be recorded honestly. This optional crate, barrel,
and industrial prop sourcing attempt remains incomplete. Survival Kit was not
downloaded because we could not inspect Factory Kit to establish which
categories were missing. No download is needed for the current procedural
implementation; the planned third-party asset rows below are optional.

`src/world/worldAssets.ts` deliberately has null URLs for all three categories.
The code-generated crate, barrel and pallet are the active original procedural
implementation. If optional files are later sourced, record exact archive entry
names, original format, local paths, dependencies and license here before
enabling their URLs. Use the shared crate/barrel paths only for genuine GLBs;
retain `.gltf` and its relative dependencies when applicable.
