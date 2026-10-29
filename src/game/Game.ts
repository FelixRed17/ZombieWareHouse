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
  private pendingStart = false;

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
    window.addEventListener('blur', this.pause, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); }, options);
    document.addEventListener('pointerlockerror', () => {
      this.pendingStart = false;
      this.hud.showNotice('Mouse capture failed. Open this URL directly in a desktop browser and retry.');
    }, options);
    window.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || this.state.phase !== 'playing' || !this.player.controls.isLocked) return;
      this.scene.updateMatrixWorld(true);
      const shot = this.weapon.tryShoot(this.enemies.getTargets(), this.warehouse.shotBlockers);
      if (shot) {
        this.audio.play('pistol');
        if (shot.killed) this.state.kills += 1;
      }
    }, options);
    window.addEventListener('keydown', (event) => {
      if (event.repeat || this.state.phase !== 'playing' || !this.player.controls.isLocked) return;
      if (event.code === 'KeyR' && this.weapon.reload()) this.audio.play('reload');
    }, options);
    this.resize();
    this.hud.render(this.state.snapshot(this.weapon.snapshot));
  }

  start(): void { this.loop.start(); }

  private requestPlay(newRound: boolean): void {
    this.audio.unlock();
    this.pendingStart = newRound;
    // Must remain directly inside the user's click gesture.
    this.player.controls.lock();
  }

  private readonly onLock = (): void => {
    if (this.pendingStart) {
      this.player.reset();
      this.weapon.reset();
      this.enemies.reset();
      this.pickups.reset();
      this.state.reset();
      this.pendingStart = false;
    } else if (this.state.phase === 'paused') {
      this.state.phase = 'playing';
    }
    this.audio.setPlaying(this.state.phase === 'playing');
    this.hud.showNotice('PREVIEW · WEAPON COMBAT PENDING');
  };

  private readonly onUnlock = (): void => {
    if (this.state.phase === 'playing') this.state.phase = 'paused';
    this.audio.setPlaying(false);
  };

  private readonly pause = (): void => {
    if (this.state.phase !== 'playing') return;
    this.state.phase = 'paused';
    this.player.controls.unlock();
    this.audio.setPlaying(false);
  };

  private returnToMenu(): void {
    this.state.phase = 'menu';
    this.pendingStart = false;
    this.player.controls.unlock();
    this.audio.setPlaying(false);
    this.hud.showNotice('DESKTOP · KEYBOARD + MOUSE');
  }

  private update(dtSeconds: number): void {
    if (this.state.phase === 'playing' && this.player.controls.isLocked) {
      this.player.update(dtSeconds, this.warehouse);
      this.weapon.update(dtSeconds);
      this.state.damage(this.enemies.update(dtSeconds, this.state.elapsedSeconds, this.player.position, this.warehouse));
      if (this.state.phase === 'playing') {
        for (const effect of this.pickups.update(dtSeconds, this.player.position)) {
          if (effect.kind === 'health') this.state.heal(effect.amount);
          else this.weapon.addAmmo(effect.amount);
        }
        // Fatal damage takes precedence over surviving the final frame.
        this.state.advance(dtSeconds);
      }
      if (this.state.phase !== 'playing') {
        this.player.controls.unlock();
        this.audio.setPlaying(false);
      }
    }
    this.hud.render(this.state.snapshot(this.weapon.snapshot));
    this.renderer.render(this.scene, this.camera);
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
