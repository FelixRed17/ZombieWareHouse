# Planned models

Add real, licensed binary assets here when sourced. Do not commit zero-byte `.glb` placeholders.

| Filename | Owner | Fallback / requirements |
| --- | --- | --- |
| `zombie.glb` | Person 2 | Procedural zombie; optionally map walk/attack/death clips; document exact clip names |
| `pistol.glb` | Person 1 | Camera-attached procedural pistol |
| `crate.glb` | Person 3 | Box geometry; keep collision aligned |
| `barrel.glb` | Person 3 | Cylinder geometry; keep collision aligned |
| `warehouse.glb` | Person 3 | Optional; procedural arena remains the baseline |

Normalize orientation and scale to the metre-based, Y-up world described in `docs/ARCHITECTURE.md`. Use `GLTFLoader` only after an asset is intentionally enabled. Load via `ASSETS.models` from `src/shared/assets.ts`, retain a fallback on failure, and record the license in `docs/ASSET_CREDITS.md`.
