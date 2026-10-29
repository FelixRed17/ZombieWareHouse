import type { GameSnapshot } from '../shared/types';

interface HUDCallbacks {
  onPlay(): void;
  onResume(): void;
  onRestart(): void;
  onMenu(): void;
}

/** TEAM 3 owns presentation; Game owns every action and state transition. */
export class HUD {
  private readonly events = new AbortController();
  private readonly health: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly kills: HTMLElement;
  private readonly ammo: HTMLElement;
  private readonly reserve: HTMLElement;
  private readonly status: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly title: HTMLElement;
  private readonly copy: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly menuButton: HTMLButtonElement;
  private readonly crosshair: HTMLElement;
  private currentPhase: GameSnapshot['phase'] = 'menu';
  private lastPhase: GameSnapshot['phase'] | null = null;

  constructor(private readonly container: HTMLElement, callbacks: HUDCallbacks) {
    container.innerHTML = `
      <header class="topbar">
        <a class="wordmark" href="./" aria-label="Zombie Warehouse home">ZW<span> / </span>WAREHOUSE</a>
        <span class="build-tag"><i></i> DEVELOPMENT SCAFFOLD</span>
      </header>
      <div class="game-hud">
        <div class="health readout"><span class="eyebrow">VITALS</span><strong><span class="heart">+</span> <span data-health>100</span><span class="unit"> HP</span></strong></div>
        <div class="round readout"><span class="eyebrow">SURVIVAL CLOCK</span><strong data-timer>05:00</strong><small>ELIMINATED <span data-kills>00</span></small></div>
        <div class="ammo readout"><span class="eyebrow">PISTOL / PLANNED LOADOUT</span><strong><span data-ammo>8</span><span class="slash"> / </span><span data-reserve>48</span></strong></div>
      </div>
      <div class="crosshair" data-crosshair hidden aria-hidden="true"><b></b><i></i></div>
      <section class="menu-panel" data-panel aria-labelledby="panel-title">
        <div class="chapter"><span>01</span> THE LAST SHIFT</div>
        <h1 id="panel-title">ZOMBIE<br /><span>WAREHOUSE</span></h1>
        <p class="tagline">Survive. Shoot. Stay alive.</p>
        <p class="description" data-copy>A five-minute survival FPS, built for the browser. Explore the warehouse foundation while your team builds the fight.</p>
        <div class="mission"><span>MISSION DURATION<strong>05:00</strong></span><span>LOCATION<strong>SECTOR 09</strong></span></div>
        <button class="primary" type="button" data-play>ENTER WAREHOUSE <span aria-hidden="true">↗</span></button>
        <button class="secondary" type="button" data-menu hidden>MAIN MENU</button>
        <p class="preview-note">Preview: movement and mouse-look work. Combat, enemies, pickups, and audio are team tasks.</p>
      </section>
      <footer class="bottom-bar">
        <span class="controls-hint"><kbd>W A S D</kbd> MOVE <kbd>SHIFT</kbd> SPRINT <kbd>ESC</kbd> PAUSE</span>
        <span class="notice" role="status" data-status>DESKTOP · KEYBOARD + MOUSE</span>
      </footer>`;

    this.health = this.find('[data-health]');
    this.timer = this.find('[data-timer]');
    this.kills = this.find('[data-kills]');
    this.ammo = this.find('[data-ammo]');
    this.reserve = this.find('[data-reserve]');
    this.status = this.find('[data-status]');
    this.panel = this.find('[data-panel]');
    this.title = this.find('#panel-title');
    this.copy = this.find('[data-copy]');
    this.playButton = this.find<HTMLButtonElement>('[data-play]');
    this.menuButton = this.find<HTMLButtonElement>('[data-menu]');
    this.crosshair = this.find('[data-crosshair]');
    this.playButton.addEventListener('click', () => {
      if (this.currentPhase === 'paused') callbacks.onResume();
      else if (this.currentPhase === 'menu') callbacks.onPlay();
      else callbacks.onRestart();
    }, { signal: this.events.signal });
    this.menuButton.addEventListener('click', callbacks.onMenu, { signal: this.events.signal });
  }

  render(snapshot: GameSnapshot): void {
    this.currentPhase = snapshot.phase;
    this.health.textContent = String(snapshot.health);
    const seconds = Math.ceil(snapshot.remainingSeconds);
    this.timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    this.kills.textContent = String(snapshot.kills).padStart(2, '0');
    this.ammo.textContent = snapshot.weapon.isReloading ? '…' : String(snapshot.weapon.ammo);
    this.reserve.textContent = String(snapshot.weapon.reserve);
    this.crosshair.hidden = snapshot.phase !== 'playing';
    this.panel.hidden = snapshot.phase === 'playing';
    this.container.dataset.phase = snapshot.phase;
    if (snapshot.phase === this.lastPhase) return;
    this.lastPhase = snapshot.phase;
    this.menuButton.hidden = snapshot.phase === 'menu';
    if (snapshot.phase === 'menu') {
      this.title.innerHTML = 'ZOMBIE<br /><span>WAREHOUSE</span>';
      this.copy.textContent = 'A five-minute survival FPS, built for the browser. Explore the warehouse foundation while your team builds the fight.';
      this.playButton.textContent = 'ENTER WAREHOUSE ↗';
    } else if (snapshot.phase === 'paused') {
      this.title.innerHTML = 'SHIFT<br /><span>PAUSED</span>';
      this.copy.textContent = 'Take a breath. The survival clock and simulation are paused. Resume to capture your mouse again.';
      this.playButton.textContent = 'RESUME PREVIEW ↗';
    } else if (snapshot.phase === 'gameOver') {
      this.title.innerHTML = 'YOU<br /><span>DIED</span>';
      this.copy.textContent = `Your shift is over. Zombies eliminated: ${snapshot.kills}.`;
      this.playButton.textContent = 'TRY AGAIN ↗';
    } else if (snapshot.phase === 'victory') {
      this.title.innerHTML = 'SHIFT<br /><span>SURVIVED</span>';
      this.copy.textContent = `Five minutes complete. Zombies eliminated: ${snapshot.kills}. This scaffold has no enemies yet.`;
      this.playButton.textContent = 'EXPLORE AGAIN ↗';
    }
  }

  showNotice(message: string): void { this.status.textContent = message; }

  private find<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.container.querySelector<T>(selector);
    if (!element) throw new Error(`Missing HUD element: ${selector}`);
    return element;
  }

  dispose(): void {
    this.events.abort();
    this.container.replaceChildren();
  }
}
