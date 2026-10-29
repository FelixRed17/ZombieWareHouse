/** TEAM 3 STUB: hooks for optional audio. No assets are loaded in the preview. */
export class AudioManager {
  unlock(): void {
    // TODO(P3-04): initialize/resume Web Audio only from a user gesture.
  }

  setPlaying(_playing: boolean): void {
    // TODO(P3-04): pause ambience and active sounds outside active play.
  }

  play(_sound: 'pistol' | 'reload' | 'zombieGrowl' | 'zombieHit'): void {
    // TODO(P3-04): missing audio must not break gameplay.
  }

  dispose(): void {
    // TODO(P3-04): stop/disconnect owned audio nodes and close the context.
  }
}
