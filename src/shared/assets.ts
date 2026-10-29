/** Planned asset locations only. Files are deliberately absent until sourced. */
const base = import.meta.env.BASE_URL;

export const ASSETS = {
  models: {
    zombie: `${base}models/zombie.glb`,
    pistol: `${base}models/pistol.glb`,
    crate: `${base}models/crate.glb`,
    barrel: `${base}models/barrel.glb`,
    warehouse: `${base}models/warehouse.glb`,
  },
  audio: {
    pistol: `${base}audio/pistol.mp3`,
    reload: `${base}audio/reload.mp3`,
    zombieGrowl: `${base}audio/zombie-growl.mp3`,
    zombieHit: `${base}audio/zombie-hit.mp3`,
    ambience: `${base}audio/ambience.mp3`,
  },
} as const;
