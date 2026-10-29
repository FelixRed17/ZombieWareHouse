import { ACESFilmicToneMapping, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { AudioManager } from '../audio/AudioManager';
import { ZombieSpawner } from '../enemies/ZombieSpawner';
import { Player } from '../player/Player';
import { Weapon } from '../player/Weapon';
import { HUD } from '../ui/HUD';
import { Lighting } from '../world/Lighting';
import { Pickups } from '../world/Pickups';
import { Warehouse } from '../world/Warehouse';
import { GameLoop } from './GameLoop';
import { applyShotResult, pauseOnUnlock, resetRun, resumeRun, routeCombatInput, runGameplayFrame } from './GameplayFrame';
import { GameState } from './GameState';

/** Composition root, owned by Team 1. Other systems communicate via contracts. */
export class Game {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(72, 1, 0.1, 120);
  private readonly renderer = new WebGLRenderer({ antialias: true });
  private readonly state = new GameState();
  private readonly warehouse = new Warehouse();
  private readonly lighting = new Lighting(this.scene);
  private readonly player: Player;
  private readonly weapon: Weapon;
  private readonly enemies = new ZombieSpawner(this.scene);
  private readonly pickups = new Pickups(this.scene);
  private readonly audio = new AudioManager();
  private readonly hud: HUD;
  private readonly loop = new GameLoop((dtSeconds) => this.update(dtSeconds));
  private readonly events = new AbortController();
  private pendingCapture: 'newRound' | 'resume' | null = null;

  constructor(private readonly viewport: HTMLElement, ui: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', 'Warehouse 3D view');
    viewport.append(this.renderer.domElement);
    this.scene.add(this.warehouse.root, this.lighting.root, this.camera);
    this.player = new Player(this.camera, this.renderer.domElement);
    this.weapon = new Weapon(this.camera);
    this.hud = new HUD(ui, {
      onPlay: () => this.requestPlay(true),
      onResume: () => this.requestPlay(false),
      onRestart: () => this.requestPlay(true),
      onMenu: () => this.returnToMenu(),
    });
    this.player.controls.addEventListener('lock', this.onLock);
    this.player.controls.addEventListener('unlock', this.onUnlock);
    const options = { signal: this.events.signal };
    window.addEventListener('resize', this.resize, options);
    window.addEventListener('blur', this.handleFocusLoss, options);
    document.addEventListener('visibilitychange', this.onVisibilityChange, options);
    document.addEventListener('pointerlockerror', this.onPointerLockError, options);
    window.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      routeCombatInput(this.state, this.hasGameCapture(), () => {
        const shot = this.weapon.tryShoot(this.enemies.getTargets(), this.warehouse.shotBlockers);
        if (shot) {
          this.audio.play('pistol');
          applyShotResult(this.state, shot);
        }
      });
    }, options);
    window.addEventListener('keydown', this.onKeyDown, options);
    this.resize();
    this.hud.render(this.state.snapshot(this.weapon.snapshot));
  }

  start(): void { this.loop.start(); }

  private requestPlay(newRound: boolean): void {
    const action = newRound ? 'newRound' : 'resume';
    if (this.pendingCapture !== null || !this.canBegin(action)) return;
    if (!this.isForeground()) {
      this.hud.showNotice('Return to this tab, then click the visible action to continue.');
      return;
    }

    this.pendingCapture = action;
    this.audio.unlock();
    // Keep the capture request synchronous with the Play/Resume/Restart gesture.
    try {
      this.player.controls.lock();
    } catch {
      this.onPointerLockError();
    }
  }

  private readonly onLock = (): void => {
    const action = this.pendingCapture;
    // Three.js dispatches `lock` just before it sets controls.isLocked, so check the
    // browser's pointerLockElement during this event instead of the later flag.
    const capturedByGame = document.pointerLockElement === this.renderer.domElement;
    if (action === null || !capturedByGame || !this.isForeground() || !this.canBegin(action)) {
      this.pendingCapture = null;
      this.audio.setPlaying(false);
      if (capturedByGame) this.player.controls.unlock();
      if (!this.isForeground()) {
        if (this.state.phase === 'playing') this.state.phase = 'paused';
        this.hud.showNotice('Focus changed before mouse capture. Return and click the visible action to retry.');
      } else if (action === null) {
        this.hud.showNotice('Mouse capture was canceled. Click the visible action to retry.');
      } else if (!capturedByGame) {
        this.showCaptureFailure();
      }
      return;
    }

    this.pendingCapture = null;
    if (action === 'newRound') {
      resetRun({
        resetPlayer: () => this.player.reset(),
        resetWeapon: () => this.weapon.reset(),
        resetEnemies: () => this.enemies.reset(),
        resetPickups: () => this.pickups.reset(),
        resetState: () => this.state.reset(),
      });
    } else {
      resumeRun(this.state);
    }
    this.audio.setPlaying(this.state.phase === 'playing');
    this.hud.showNotice('PREVIEW · LIVE ENEMIES, PICKUPS + AUDIO NOT INTEGRATED');
  };

  private readonly onUnlock = (): void => {
    pauseOnUnlock(this.state);
    this.audio.setPlaying(false);
  };

  private readonly handleFocusLoss = (): void => {
    const hadPendingCapture = this.pendingCapture !== null;
    this.pendingCapture = null;
    if (this.state.phase === 'playing') this.state.phase = 'paused';
    this.audio.setPlaying(false);
    if (this.player.controls.isLocked) this.player.controls.unlock();
    if (hadPendingCapture) {
      this.hud.showNotice('Focus changed before mouse capture. Return and click the visible action to retry.');
    }
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.handleFocusLoss();
  };

  private readonly onPointerLockError = (): void => {
    if (this.pendingCapture === null) return;
    this.pendingCapture = null;
    this.audio.setPlaying(false);
    this.showCaptureFailure();
  };

  private showCaptureFailure(): void {
    this.hud.showNotice('Mouse capture failed. Click Enter Warehouse, Resume, or Try Again to retry; a direct desktop URL may be needed.');
  }

  private isForeground(): boolean {
    return !document.hidden && document.hasFocus();
  }

  private canBegin(action: 'newRound' | 'resume'): boolean {
    if (action === 'resume') return this.state.phase === 'paused';
    return this.state.phase === 'menu' || this.state.phase === 'gameOver' || this.state.phase === 'victory';
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && this.pendingCapture !== null) {
      this.pendingCapture = null;
      if (this.player.controls.isLocked) this.player.controls.unlock();
      this.hud.showNotice('Mouse capture canceled. Click the visible action to retry.');
      return;
    }
    if (event.repeat) return;
    routeCombatInput(this.state, this.hasGameCapture(), () => {
      if (event.code === 'KeyR' && this.weapon.reload()) this.audio.play('reload');
    });
  };

  private returnToMenu(): void {
    this.state.phase = 'menu';
    this.pendingCapture = null;
    this.player.controls.unlock();
    this.audio.setPlaying(false);
    this.hud.showNotice('DESKTOP · KEYBOARD + MOUSE');
  }

  private update(dtSeconds: number): void {
    const hadGameCapture = this.hasGameCapture();
    const foreground = this.isForeground();
    if (this.state.phase === 'playing' && (!foreground || !hadGameCapture)) this.handleFocusLoss();
    const ranGameplayFrame = runGameplayFrame(
      dtSeconds,
      this.state.phase === 'playing' && foreground && hadGameCapture,
      this.state,
      {
        movePlayer: (dt) => this.player.update(dt, this.warehouse),
        advanceWeapon: (dt) => this.weapon.update(dt),
        updateEnemies: (dt, elapsed) => this.enemies.update(dt, elapsed, this.player.position, this.warehouse),
        updatePickups: (dt) => this.pickups.update(dt, this.player.position),
        addAmmo: (amount) => this.weapon.addAmmo(amount),
      },
    );
    if (ranGameplayFrame && this.state.phase !== 'playing') {
      this.player.controls.unlock();
      this.audio.setPlaying(false);
    }
    this.hud.render(this.state.snapshot(this.weapon.snapshot));
    this.renderer.render(this.scene, this.camera);
  }

  private hasGameCapture(): boolean {
    return this.player.controls.isLocked && document.pointerLockElement === this.renderer.domElement;
  }

  private readonly resize = (): void => {
    const width = this.viewport.clientWidth;
    const height = Math.max(this.viewport.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  dispose(): void {
    this.loop.stop();
    this.events.abort();
    this.player.controls.removeEventListener('lock', this.onLock);
    this.player.controls.removeEventListener('unlock', this.onUnlock);
    this.player.dispose();
    this.weapon.dispose();
    this.enemies.dispose();
    this.pickups.dispose();
    this.audio.dispose();
    this.warehouse.dispose();
    this.lighting.dispose();
    this.hud.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
