import type { GameSnapshot } from '../shared/types';

export interface HUDCallbacks {
  onPlay(): void;
  onResume(): void;
  onRestart(): void;
  onMenu(): void;
  onToggleMute?(): void;
}

export interface HUDAudioState {
  muted: boolean;
  available: boolean;
}

type MenuPhase = Exclude<GameSnapshot['phase'], 'playing'>;

/** Displays snapshots and requests actions; Game owns transitions and input. */
export class HUD {
  private readonly events = new AbortController();
  private readonly health: HTMLElement;
  private readonly healthMeter: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly ammo: HTMLElement;
  private readonly reserve: HTMLElement;
  private readonly weaponState: HTMLElement;
  private readonly status: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly titleFirst: HTMLElement;
  private readonly titleSecond: HTMLElement;
  private readonly tagline: HTMLElement;
  private readonly copy: HTMLElement;
  private readonly chapter: HTMLElement;
  private readonly detailLeftLabel: HTMLElement;
  private readonly detailLeftValue: HTMLElement;
  private readonly detailRightLabel: HTMLElement;
  private readonly detailRightValue: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly playLabel: HTMLElement;
  private readonly menuButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly muteLabel: HTMLElement;
  private readonly muteIcon: SVGElement;
  private readonly crosshair: HTMLElement;
  private readonly onToggleMute: (() => void) | undefined;
  private currentPhase: GameSnapshot['phase'] = 'menu';
  private lastPhase: GameSnapshot['phase'] | null = null;

  constructor(private readonly container: HTMLElement, callbacks: HUDCallbacks) {
    this.onToggleMute = callbacks.onToggleMute;
    container.innerHTML = `
      <header class="topbar">
        <a class="wordmark" href="./" aria-label="Zombie Warehouse home">ZW<span aria-hidden="true"> / </span>WAREHOUSE</a>
        <span class="build-tag"><i aria-hidden="true"></i> DEVELOPMENT PREVIEW</span>
      </header>
      <div class="game-hud" aria-label="Current game status">
        <section class="health readout" aria-label="Player health">
          <div class="readout-heading"><span class="eyebrow">VITALS</span></div>
          <strong><span class="heart" aria-hidden="true">+</span> <span data-health>100</span><span class="unit"> HP</span></strong>
          <div class="health-meter" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span data-health-meter></span></div>
        </section>
        <section class="round readout" aria-label="Remaining time and kills">
          <span class="eyebrow">SURVIVAL CLOCK</span>
          <strong data-timer>05:00</strong>
          <small>ELIMINATED <span data-kills>0</span></small>
        </section>
        <section class="ammo readout" aria-label="Pistol ammunition">
          <span class="eyebrow">PISTOL · MAG / RESERVE</span>
          <strong><span data-ammo>8</span><span class="slash" aria-hidden="true"> / </span><span data-reserve>48</span></strong>
          <small class="weapon-state" data-weapon-state aria-live="polite" hidden></small>
        </section>
      </div>
      <div class="crosshair" data-crosshair hidden aria-hidden="true"><b></b><i></i></div>
      <section class="menu-panel" data-panel aria-labelledby="panel-title" aria-describedby="panel-copy">
        <div class="chapter"><span class="chapter-index" data-chapter-index>01</span><span data-chapter>THE LAST SHIFT</span></div>
        <h1 id="panel-title"><span class="title-line" data-title-first>ZOMBIE</span><span class="title-line" data-title-second>WAREHOUSE</span></h1>
        <p class="tagline" data-tagline>A five-minute survival shift.</p>
        <p class="description" id="panel-copy" data-copy>A development preview. Movement and mouse-look are available while the full survival game is still being built.</p>
        <div class="mission" data-details aria-label="Mission details">
          <span><span class="detail-label" data-detail-left-label>MISSION DURATION</span><strong data-detail-left-value>05:00</strong></span>
          <span><span class="detail-label" data-detail-right-label>LOCATION</span><strong data-detail-right-value>SECTOR 09</strong></span>
        </div>
        <div class="menu-actions">
          <button class="primary" type="button" data-play><span data-play-label>ENTER WAREHOUSE</span><span class="action-arrow" aria-hidden="true">↗</span></button>
          <button class="secondary" type="button" data-menu hidden><span>MAIN MENU</span><span class="action-arrow" aria-hidden="true">⌂</span></button>
          <button class="audio-toggle" type="button" data-mute aria-pressed="false" hidden>
            <svg data-mute-icon viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 9v6h4l5 4V5L8 9H4Z" />
              <path class="audio-waves" d="M16 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" />
              <path class="audio-slash" d="m16 9 5 6m0-6-5 6" />
            </svg>
            <span data-mute-label>SOUND ON</span>
          </button>
        </div>
        <p class="preview-note" data-preview-note>PREVIEW · Movement and mouse-look are available. Combat and the complete survival round are still in development.</p>
      </section>
      <footer class="bottom-bar">
        <span class="controls-hint"><kbd>W A S D</kbd> MOVE <kbd>SHIFT</kbd> SPRINT <kbd>ESC</kbd> PAUSE</span>
        <span class="notice" role="status" aria-live="polite" aria-atomic="true" data-status>DESKTOP · KEYBOARD + MOUSE</span>
      </footer>`;

    this.health = this.find('[data-health]');
    this.healthMeter = this.find('[data-health-meter]');
    this.timer = this.find('[data-timer]');
    this.kills = this.find('[data-kills]');
    this.ammo = this.find('[data-ammo]');
    this.reserve = this.find('[data-reserve]');
    this.weaponState = this.find('[data-weapon-state]');
    this.status = this.find('[data-status]');
    this.panel = this.find('[data-panel]');
    this.titleFirst = this.find('[data-title-first]');
    this.titleSecond = this.find('[data-title-second]');
    this.tagline = this.find('[data-tagline]');
    this.copy = this.find('[data-copy]');
    this.chapter = this.find('[data-chapter]');
    this.detailLeftLabel = this.find('[data-detail-left-label]');
    this.detailLeftValue = this.find('[data-detail-left-value]');
    this.detailRightLabel = this.find('[data-detail-right-label]');
    this.detailRightValue = this.find('[data-detail-right-value]');
    this.playButton = this.find<HTMLButtonElement>('[data-play]');
    this.playLabel = this.find('[data-play-label]');
    this.menuButton = this.find<HTMLButtonElement>('[data-menu]');
    this.muteButton = this.find<HTMLButtonElement>('[data-mute]');
    this.muteLabel = this.find('[data-mute-label]');
    this.muteIcon = this.find<SVGElement>('[data-mute-icon]');
    this.crosshair = this.find('[data-crosshair]');

    this.muteButton.hidden = !this.onToggleMute;
    this.setAudioState({ muted: false, available: false });
    this.playButton.addEventListener('click', () => {
      if (this.currentPhase === 'paused') callbacks.onResume();
      else if (this.currentPhase === 'menu') callbacks.onPlay();
      else callbacks.onRestart();
    }, { signal: this.events.signal });
    this.menuButton.addEventListener('click', callbacks.onMenu, { signal: this.events.signal });
    this.muteButton.addEventListener('click', () => this.onToggleMute?.(), { signal: this.events.signal });
  }

  render(snapshot: GameSnapshot): void {
    this.currentPhase = snapshot.phase;
    this.health.textContent = String(snapshot.health);
    this.healthMeter.parentElement?.setAttribute('aria-valuenow', String(snapshot.health));
    this.healthMeter.style.transform = `scaleX(${Math.max(0, Math.min(100, snapshot.health)) / 100})`;
    this.timer.textContent = formatTime(snapshot.remainingSeconds);
    this.kills.textContent = String(snapshot.kills);
    this.ammo.textContent = String(snapshot.weapon.ammo);
    this.reserve.textContent = String(snapshot.weapon.reserve);
    this.weaponState.textContent = snapshot.weapon.isReloading ? 'Reloading…' : snapshot.weapon.ammo === 0 ? 'MAGAZINE EMPTY' : '';
    this.weaponState.hidden = !snapshot.weapon.isReloading && snapshot.weapon.ammo !== 0;
    this.weaponState.classList.toggle('is-reloading', snapshot.weapon.isReloading);
    this.weaponState.classList.toggle('is-empty', !snapshot.weapon.isReloading && snapshot.weapon.ammo === 0);
    this.healthMeter.parentElement?.classList.toggle('is-depleted', snapshot.health <= 0);
    this.crosshair.hidden = snapshot.phase !== 'playing';
    this.panel.hidden = snapshot.phase === 'playing';
    this.container.dataset.phase = snapshot.phase;
    this.muteButton.hidden = !this.onToggleMute || (snapshot.phase !== 'menu' && snapshot.phase !== 'paused');

    const phaseChanged = snapshot.phase !== this.lastPhase;
    this.lastPhase = snapshot.phase;
    this.applyPhasePresentation(snapshot);
    if (phaseChanged && snapshot.phase !== 'playing') this.playButton.focus({ preventScroll: true });
  }

  /** Updates the optional menu/pause sound control without owning audio state. */
  setAudioState(state: HUDAudioState): void {
    this.muteButton.disabled = !state.available;
    this.muteButton.setAttribute('aria-pressed', String(state.muted));
    this.muteButton.setAttribute('aria-label', state.available
      ? state.muted ? 'Unmute audio' : 'Mute audio'
      : 'Audio unavailable');
    this.muteButton.title = state.available ? (state.muted ? 'Unmute audio' : 'Mute audio') : 'Audio is unavailable in this browser';
    this.muteLabel.textContent = state.available ? (state.muted ? 'SOUND MUTED' : 'SOUND ON') : 'AUDIO UNAVAILABLE';
    this.muteIcon.classList.toggle('is-muted', state.muted || !state.available);
  }

  showNotice(message: string): void {
    this.status.textContent = message;
  }

  private applyPhasePresentation(snapshot: GameSnapshot): void {
    if (snapshot.phase === 'playing') return;
    const timeLeft = formatTime(snapshot.remainingSeconds);
    const details = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string): void => {
      this.detailLeftLabel.textContent = leftLabel;
      this.detailLeftValue.textContent = leftValue;
      this.detailRightLabel.textContent = rightLabel;
      this.detailRightValue.textContent = rightValue;
    };

    const presentation: Record<MenuPhase, {
      first: string;
      second: string;
      chapter: string;
      tagline: string;
      copy: string;
      action: string;
    }> = {
      menu: {
        first: 'ZOMBIE', second: 'WAREHOUSE', chapter: 'THE LAST SHIFT',
        tagline: 'A five-minute survival shift.',
        copy: 'A development preview. Movement and mouse-look are available while the full survival game is still being built.',
        action: 'ENTER WAREHOUSE',
      },
      paused: {
        first: 'SHIFT', second: 'PAUSED', chapter: 'RUN ON HOLD',
        tagline: 'Take a breath.',
        copy: 'The simulation and survival clock are paused. Resume to capture your mouse and continue this run.',
        action: 'RESUME SHIFT',
      },
      gameOver: {
        first: 'YOU', second: 'DIED', chapter: 'SHIFT ENDED',
        tagline: 'This run is over.',
        copy: `Your shift has ended. Zombies eliminated: ${snapshot.kills}.`,
        action: 'TRY AGAIN',
      },
      victory: {
        first: 'SHIFT', second: 'SURVIVED', chapter: 'MISSION COMPLETE',
        tagline: 'You made it to the end.',
        copy: `You reached the end of the survival clock. Zombies eliminated: ${snapshot.kills}.`,
        action: 'PLAY AGAIN',
      },
    };
    const content = presentation[snapshot.phase];
    this.titleFirst.textContent = content.first;
    this.titleSecond.textContent = content.second;
    this.chapter.textContent = content.chapter;
    this.tagline.textContent = content.tagline;
    this.copy.textContent = content.copy;
    this.playLabel.textContent = content.action;
    this.menuButton.hidden = snapshot.phase === 'menu';
    this.container.dataset.phase = snapshot.phase;

    if (snapshot.phase === 'menu') {
      details('GAME MODE', 'SURVIVAL', 'CONTROLS', 'KEYBOARD + MOUSE');
    } else if (snapshot.phase === 'paused') {
      details('TIME REMAINING', timeLeft, 'ELIMINATED', String(snapshot.kills));
    } else if (snapshot.phase === 'gameOver') {
      details('TIME REMAINING', timeLeft, 'FINAL HEALTH', `${snapshot.health} HP`);
    } else {
      details('TIME REMAINING', timeLeft, 'FINAL HEALTH', `${snapshot.health} HP`);
    }
  }

  private find<T extends Element = HTMLElement>(selector: string): T {
    const element = this.container.querySelector<T>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }

  dispose(): void {
    this.events.abort();
    this.container.replaceChildren();
  }
}

function formatTime(secondsRemaining: number): string {
  const seconds = Math.max(0, Math.ceil(Number.isFinite(secondsRemaining) ? secondsRemaining : 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
