import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Raycaster,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { Damageable, ShotResult, WeaponSnapshot } from '../shared/types';

type Triple = readonly [number, number, number];

export class Weapon {
  private ammo: number = GAME_CONFIG.weapon.magazineSize;
  private reserve: number = GAME_CONFIG.weapon.startingReserve;
  private isReloading = false;
  private reloadRemainingSeconds = 0;
  private cooldownRemainingSeconds = 0;
  private recoilIntensity = 0;
  private muzzleFlashRemainingSeconds = 0;
  private disposed = false;
  private readonly raycaster = new Raycaster();
  private readonly screenCenter = new Vector2(0, 0);
  private readonly viewModel = new Group();
  private readonly pistol = new Group();
  private readonly muzzleFlash = new Group();
  private readonly ownedGeometries = new Set<BufferGeometry>();
  private readonly ownedMaterials = new Set<Material>();
  private readonly flashMaterial: MeshBasicMaterial;
  private readonly flashCoreMaterial: MeshBasicMaterial;

  constructor(readonly camera: PerspectiveCamera) {
    this.flashMaterial = this.ownMaterial(new MeshBasicMaterial({
      color: 0xff9638,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    }));
    this.flashCoreMaterial = this.ownMaterial(new MeshBasicMaterial({
      color: 0xffefad,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    }));

    this.viewModel.name = 'weapon-view-model';
    this.pistol.name = 'procedural-pistol';
    this.muzzleFlash.name = 'weapon-muzzle-flash';
    this.pistol.scale.setScalar(GAME_CONFIG.weapon.presentation.viewScale);
    this.createPistolModel();
    this.viewModel.add(this.pistol);
    this.camera.add(this.viewModel);
    this.applyPresentationPose();
  }

  get snapshot(): WeaponSnapshot {
    return { ammo: this.ammo, reserve: this.reserve, isReloading: this.isReloading };
  }

  tryShoot(targets: readonly Damageable[], blockers: readonly Object3D[]): ShotResult | null {
    if (this.ammo <= 0 || this.isReloading || this.cooldownRemainingSeconds > 0) return null;

    this.ammo -= 1;
    this.cooldownRemainingSeconds = GAME_CONFIG.weapon.cooldownSeconds;
    this.recoilIntensity = 1;
    this.muzzleFlashRemainingSeconds = GAME_CONFIG.weapon.presentation.muzzleFlashSeconds;

    const livingTargets = targets.filter((target) => target.isAlive);
    const targetByRoot = new Map(livingTargets.map((target) => [target.root, target] as const));
    const targetRoots = livingTargets.map((target) => target.root);

    this.camera.updateWorldMatrix(true, false);
    for (const root of targetRoots) root.updateWorldMatrix(true, true);
    for (const blocker of blockers) blocker.updateWorldMatrix(true, true);

    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    // The camera-attached view model is visual-only; only world targets and blockers enter this ray.
    const intersections = this.raycaster.intersectObjects([...targetRoots, ...blockers], true);
    const nearestHit = intersections[0];
    if (!nearestHit) return { hitId: null, killed: false };

    for (let object: Object3D | null = nearestHit.object; object; object = object.parent) {
      const target = targetByRoot.get(object);
      if (target) {
        return {
          hitId: target.id,
          killed: target.takeDamage(GAME_CONFIG.weapon.damage),
        };
      }
    }

    return { hitId: null, killed: false };
  }

  reload(): boolean {
    if (this.isReloading || this.ammo >= GAME_CONFIG.weapon.magazineSize || this.reserve <= 0) return false;

    this.isReloading = true;
    this.reloadRemainingSeconds = GAME_CONFIG.weapon.reloadSeconds;
    return true;
  }

  update(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    this.cooldownRemainingSeconds = Math.max(0, this.cooldownRemainingSeconds - dtSeconds);
    this.updatePresentation(dtSeconds);

    if (!this.isReloading) return;

    this.reloadRemainingSeconds = Math.max(0, this.reloadRemainingSeconds - dtSeconds);
    if (this.reloadRemainingSeconds > Number.EPSILON * GAME_CONFIG.weapon.reloadSeconds) return;

    const transferredAmmo = Math.min(GAME_CONFIG.weapon.magazineSize - this.ammo, this.reserve);
    this.ammo += transferredAmmo;
    this.reserve -= transferredAmmo;
    this.reloadRemainingSeconds = 0;
    this.isReloading = false;
  }

  addAmmo(amount: number): void {
    if (!Number.isFinite(amount)) return;
    this.reserve += Math.max(0, Math.floor(amount));
  }

  reset(): void {
    this.ammo = GAME_CONFIG.weapon.magazineSize;
    this.reserve = GAME_CONFIG.weapon.startingReserve;
    this.isReloading = false;
    this.reloadRemainingSeconds = 0;
    this.cooldownRemainingSeconds = 0;
    this.recoilIntensity = 0;
    this.muzzleFlashRemainingSeconds = 0;
    this.muzzleFlash.visible = false;
    this.flashMaterial.opacity = 0;
    this.flashCoreMaterial.opacity = 0;
    this.applyPresentationPose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.viewModel.removeFromParent();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
  }

  private createPistolModel(): void {
    const boxGeometry = this.ownGeometry(new BoxGeometry(1, 1, 1));
    const cylinderGeometry = this.ownGeometry(new CylinderGeometry(1, 1, 1, 16));
    const guardGeometry = this.ownGeometry(new TorusGeometry(1, 0.14, 5, 18));
    const coneGeometry = this.ownGeometry(new ConeGeometry(1, 1, 8));
    const flashCoreGeometry = this.ownGeometry(new OctahedronGeometry(1, 0));

    const frameMaterial = this.ownMaterial(new MeshStandardMaterial({
      color: 0x354149,
      metalness: 0.68,
      roughness: 0.34,
    }));
    const slideMaterial = this.ownMaterial(new MeshStandardMaterial({
      color: 0x78858b,
      metalness: 0.78,
      roughness: 0.28,
    }));
    const edgeMaterial = this.ownMaterial(new MeshStandardMaterial({
      color: 0xa7b1b5,
      metalness: 0.82,
      roughness: 0.25,
    }));
    const gripMaterial = this.ownMaterial(new MeshStandardMaterial({
      color: 0x20272c,
      metalness: 0.08,
      roughness: 0.82,
    }));
    const gripDetailMaterial = this.ownMaterial(new MeshStandardMaterial({
      color: 0x465158,
      metalness: 0.2,
      roughness: 0.72,
    }));
    const sightMaterial = this.ownMaterial(new MeshStandardMaterial({
      color: 0xe9c86e,
      emissive: 0x554116,
      emissiveIntensity: 0.55,
      metalness: 0.32,
      roughness: 0.4,
    }));

    this.addBox('pistol-frame', boxGeometry, frameMaterial, [0.15, 0.075, 0.31], [0, 0.048, 0.012]);
    this.addBox('pistol-slide', boxGeometry, slideMaterial, [0.14, 0.078, 0.37], [0, 0.108, -0.055]);
    this.addBox('slide-top-rail', boxGeometry, edgeMaterial, [0.038, 0.012, 0.25], [0, 0.153, -0.045]);
    this.addBox('left-slide-rail', boxGeometry, edgeMaterial, [0.009, 0.012, 0.22], [-0.067, 0.097, -0.055]);
    this.addBox('right-slide-rail', boxGeometry, edgeMaterial, [0.009, 0.012, 0.22], [0.067, 0.097, -0.055]);
    this.addBox('rear-sight', boxGeometry, frameMaterial, [0.052, 0.02, 0.026], [0, 0.158, 0.105]);
    this.addBox('front-sight', boxGeometry, frameMaterial, [0.04, 0.019, 0.021], [0, 0.157, -0.22]);
    this.addBox('rear-sight-dot', boxGeometry, sightMaterial, [0.008, 0.007, 0.009], [0, 0.17, 0.105]);
    this.addBox('front-sight-dot', boxGeometry, sightMaterial, [0.01, 0.006, 0.01], [0, 0.169, -0.22]);

    const barrel = new Mesh(cylinderGeometry, edgeMaterial);
    barrel.name = 'pistol-barrel';
    barrel.position.set(0, 0.106, -0.247);
    barrel.rotation.x = Math.PI / 2;
    barrel.scale.set(0.019, 0.19, 0.019);
    this.pistol.add(barrel);

    const muzzle = new Mesh(cylinderGeometry, slideMaterial);
    muzzle.name = 'pistol-muzzle';
    muzzle.position.set(0, 0.106, -0.35);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.scale.set(0.033, 0.045, 0.033);
    this.pistol.add(muzzle);

    const grip = new Group();
    grip.name = 'pistol-grip';
    grip.position.set(0, -0.066, 0.105);
    grip.rotation.set(0.14, 0, -0.075);
    this.pistol.add(grip);
    const gripCore = this.makeBox('grip-core', boxGeometry, gripMaterial, [0.108, 0.2, 0.14]);
    gripCore.position.set(0, -0.019, 0);
    grip.add(gripCore);
    const gripHeel = this.makeBox('grip-heel', boxGeometry, gripMaterial, [0.113, 0.035, 0.145]);
    gripHeel.position.set(0, -0.112, 0.006);
    grip.add(gripHeel);
    for (const y of [-0.005, -0.04, -0.075]) {
      const groove = this.makeBox('grip-groove', boxGeometry, gripDetailMaterial, [0.072, 0.005, 0.006]);
      groove.position.set(0, y, 0.073);
      grip.add(groove);
    }

    const triggerGuard = new Mesh(guardGeometry, frameMaterial);
    triggerGuard.name = 'pistol-trigger-guard';
    triggerGuard.position.set(0, -0.01, 0.095);
    triggerGuard.scale.set(0.047, 0.041, 0.008);
    this.pistol.add(triggerGuard);
    this.addBox('pistol-trigger', boxGeometry, edgeMaterial, [0.008, 0.044, 0.009], [0, -0.025, 0.082], [0, 0, 0.1]);

    this.addBox('ejection-port', boxGeometry, frameMaterial, [0.009, 0.026, 0.08], [0.073, 0.112, -0.06]);
    this.addBox('slide-detail', boxGeometry, edgeMaterial, [0.007, 0.009, 0.13], [0.074, 0.113, -0.17]);
    this.addBox('grip-side-panel-left', boxGeometry, gripDetailMaterial, [0.006, 0.12, 0.09], [-0.056, -0.085, 0.107]);
    this.addBox('grip-side-panel-right', boxGeometry, gripDetailMaterial, [0.006, 0.12, 0.09], [0.056, -0.085, 0.107]);

    const flashCone = new Mesh(coneGeometry, this.flashMaterial);
    flashCone.name = 'muzzle-flash-cone';
    flashCone.rotation.x = -Math.PI / 2;
    flashCone.scale.set(0.044, 0.13, 0.044);
    flashCone.renderOrder = 10;
    this.muzzleFlash.add(flashCone);
    const flashCore = new Mesh(flashCoreGeometry, this.flashCoreMaterial);
    flashCore.name = 'muzzle-flash-core';
    flashCore.scale.set(0.024, 0.024, 0.055);
    flashCore.renderOrder = 11;
    this.muzzleFlash.add(flashCore);
    this.muzzleFlash.position.set(0, 0.106, -0.38);
    this.muzzleFlash.visible = false;
    this.pistol.add(this.muzzleFlash);
  }

  private addBox(
    name: string,
    geometry: BoxGeometry,
    material: Material,
    size: Triple,
    position: Triple,
    rotation: Triple = [0, 0, 0],
  ): Mesh {
    const mesh = this.makeBox(name, geometry, material, size);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    this.pistol.add(mesh);
    return mesh;
  }

  private makeBox(name: string, geometry: BoxGeometry, material: Material, size: Triple): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.scale.set(...size);
    return mesh;
  }

  private updatePresentation(dtSeconds: number): void {
    const flashIsActive = this.muzzleFlashRemainingSeconds > 0;
    this.muzzleFlash.visible = flashIsActive;
    this.flashMaterial.opacity = flashIsActive
      ? Math.min(1, this.muzzleFlashRemainingSeconds / GAME_CONFIG.weapon.presentation.muzzleFlashSeconds)
      : 0;
    this.flashCoreMaterial.opacity = flashIsActive ? this.flashMaterial.opacity : 0;
    this.applyPresentationPose();

    this.muzzleFlashRemainingSeconds = Math.max(0, this.muzzleFlashRemainingSeconds - dtSeconds);
    this.recoilIntensity = Math.max(
      0,
      this.recoilIntensity - dtSeconds / GAME_CONFIG.weapon.presentation.recoilRecoverySeconds,
    );
  }

  private applyPresentationPose(): void {
    const presentation = GAME_CONFIG.weapon.presentation;
    this.viewModel.position.set(
      presentation.viewPosition[0],
      presentation.viewPosition[1],
      presentation.viewPosition[2] + presentation.recoilDistance * this.recoilIntensity,
    );
    this.viewModel.rotation.set(
      presentation.viewRotation[0] + presentation.recoilPitchRadians * this.recoilIntensity,
      presentation.viewRotation[1],
      presentation.viewRotation[2],
    );
  }

  private ownGeometry<T extends BufferGeometry>(geometry: T): T {
    this.ownedGeometries.add(geometry);
    return geometry;
  }

  private ownMaterial<T extends Material>(material: T): T {
    this.ownedMaterials.add(material);
    return material;
  }
}
