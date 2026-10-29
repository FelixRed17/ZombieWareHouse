import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { BufferGeometry, Material, Scene, Vector3 } from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { PickupEffect } from '../shared/types';
import { PICKUP_LOCATIONS } from './layout';
import type { PickupLocation } from './layout';

interface PickupItem {
  readonly location: PickupLocation;
  readonly root: Group;
  readonly visual: Group;
  active: boolean;
  animationSeconds: number;
  respawnElapsedSeconds: number;
}

interface PickupPalette {
  readonly medicalRed: MeshStandardMaterial;
  readonly darkRed: MeshStandardMaterial;
  readonly white: MeshStandardMaterial;
  readonly charcoal: MeshStandardMaterial;
  readonly yellow: MeshStandardMaterial;
  readonly brass: MeshStandardMaterial;
  readonly gold: MeshStandardMaterial;
}

const FLOAT_HEIGHT = 0.08;
const BOB_AMPLITUDE = 0.045;
const BOB_FREQUENCY = 2.8;
const TURN_RATE = 0.55;

/** Four procedural, world-owned pickups. Game consumes returned effects. */
export class Pickups {
  private readonly items: PickupItem[] = [];
  private readonly geometries = new Map<string, BufferGeometry>();
  private readonly materials = new Set<Material>();
  private readonly palette: PickupPalette;
  private disposed = false;

  constructor(readonly scene: Scene) {
    this.palette = {
      medicalRed: this.createMaterial(0xb8323b, 0.62),
      darkRed: this.createMaterial(0x70232a, 0.72),
      white: this.createMaterial(0xf4f1e6, 0.48),
      charcoal: this.createMaterial(0x29363d, 0.52, 0.35),
      yellow: this.createMaterial(0xd7a51c, 0.58, 0.12),
      brass: this.createMaterial(0x96602a, 0.42, 0.48),
      gold: this.createMaterial(0xd5a342, 0.36, 0.62),
    };

    for (const location of PICKUP_LOCATIONS) {
      const root = new Group();
      root.name = `Pickup:${location.kind}@${location.x},${location.z}`;
      root.position.set(location.x, 0, location.z);

      const visual = new Group();
      visual.name = location.kind === 'health' ? 'Medical case' : 'Ammunition crate';
      visual.position.y = FLOAT_HEIGHT;
      root.add(visual);
      if (location.kind === 'health') this.buildMedicalCase(visual);
      else this.buildAmmoCrate(visual);

      scene.add(root);
      this.items.push({ location, root, visual, active: true, animationSeconds: 0, respawnElapsedSeconds: 0 });
    }
  }

  update(dtSeconds: number, playerPosition: Vector3): readonly PickupEffect[] {
    if (this.disposed) return [];
    const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
    const collectRadiusSq = GAME_CONFIG.pickups.collectRadius ** 2;
    const effects: PickupEffect[] = [];

    for (const item of this.items) {
      let animationDt = dt;
      if (!item.active) {
        const remainingBeforeUpdate = Math.max(0, item.location.respawnSeconds - item.respawnElapsedSeconds);
        item.respawnElapsedSeconds += dt;
        if (item.respawnElapsedSeconds < item.location.respawnSeconds) continue;

        animationDt = Math.max(0, dt - remainingBeforeUpdate);
        item.respawnElapsedSeconds = 0;
        item.active = true;
        item.root.visible = true;
        item.animationSeconds = 0;
        item.visual.position.y = FLOAT_HEIGHT;
        item.visual.rotation.set(0, 0, 0);
      }

      if (animationDt > 0) {
        item.animationSeconds += animationDt;
        item.visual.position.y = FLOAT_HEIGHT + Math.sin(item.animationSeconds * BOB_FREQUENCY) * BOB_AMPLITUDE;
        item.visual.rotation.y = item.animationSeconds * TURN_RATE;
      }

      const dx = item.location.x - playerPosition.x;
      const dz = item.location.z - playerPosition.z;
      if (dx * dx + dz * dz > collectRadiusSq) continue;

      // Hide the item and start its clock before exposing the effect to Game.
      item.active = false;
      item.root.visible = false;
      item.respawnElapsedSeconds = 0;
      effects.push({
        kind: item.location.kind,
        amount: item.location.kind === 'health' ? GAME_CONFIG.pickups.healthAmount : GAME_CONFIG.pickups.ammoAmount,
      });
    }

    return effects;
  }

  reset(): void {
    if (this.disposed) return;
    for (const item of this.items) {
      item.active = true;
      item.animationSeconds = 0;
      item.respawnElapsedSeconds = 0;
      item.root.visible = true;
      item.visual.position.set(0, FLOAT_HEIGHT, 0);
      item.visual.rotation.set(0, 0, 0);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const item of this.items) {
      item.root.removeFromParent();
      item.root.clear();
    }
    this.items.length = 0;
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
    for (const material of this.materials) material.dispose();
    this.materials.clear();
  }

  private createMaterial(color: number, roughness: number, metalness = 0): MeshStandardMaterial {
    const material = new MeshStandardMaterial({ color, roughness, metalness });
    this.materials.add(material);
    return material;
  }

  private addBox(parent: Group, name: string, size: readonly [number, number, number],
    position: readonly [number, number, number], material: MeshStandardMaterial): void {
    const [width, height, depth] = size;
    const key = `box:${width}:${height}:${depth}`;
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = new BoxGeometry(width, height, depth);
      this.geometries.set(key, geometry);
    }
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    parent.add(mesh);
  }

  private addCylinder(parent: Group, name: string, radius: number, height: number,
    position: readonly [number, number, number], material: MeshStandardMaterial): void {
    const key = `cylinder:${radius}:${height}`;
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = new CylinderGeometry(radius, radius, height, 12);
      this.geometries.set(key, geometry);
    }
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    parent.add(mesh);
  }

  private addCone(parent: Group, name: string, radius: number, height: number,
    position: readonly [number, number, number], material: MeshStandardMaterial): void {
    const key = `cone:${radius}:${height}`;
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = new ConeGeometry(radius, height, 12);
      this.geometries.set(key, geometry);
    }
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    parent.add(mesh);
  }

  private buildMedicalCase(visual: Group): void {
    const { medicalRed, darkRed, white, charcoal } = this.palette;
    this.addBox(visual, 'Case body', [0.82, 0.5, 0.7], [0, 0.31, 0], medicalRed);
    this.addBox(visual, 'Raised lid', [0.9, 0.12, 0.76], [0, 0.61, 0], darkRed);
    this.addBox(visual, 'Red lid panel', [0.78, 0.045, 0.64], [0, 0.692, 0], medicalRed);

    // The white cross reads from both the aisle and the overhead camera angle.
    this.addBox(visual, 'Front cross horizontal', [0.34, 0.1, 0.025], [0, 0.32, 0.365], white);
    this.addBox(visual, 'Front cross vertical', [0.1, 0.32, 0.025], [0, 0.32, 0.365], white);
    this.addBox(visual, 'Top cross horizontal', [0.34, 0.025, 0.1], [0, 0.719, 0.08], white);
    this.addBox(visual, 'Top cross vertical', [0.1, 0.025, 0.34], [0, 0.719, 0.08], white);

    // A compact carry handle gives the medical case a distinct silhouette.
    this.addBox(visual, 'Handle foot left', [0.07, 0.13, 0.08], [-0.16, 0.755, -0.23], charcoal);
    this.addBox(visual, 'Handle foot right', [0.07, 0.13, 0.08], [0.16, 0.755, -0.23], charcoal);
    this.addBox(visual, 'Handle grip', [0.39, 0.07, 0.1], [0, 0.84, -0.23], charcoal);
  }

  private buildAmmoCrate(visual: Group): void {
    const { yellow, charcoal, brass, gold } = this.palette;
    this.addBox(visual, 'Crate body', [0.9, 0.52, 0.76], [0, 0.32, 0], yellow);
    this.addBox(visual, 'Crate lid', [0.96, 0.1, 0.82], [0, 0.63, 0], charcoal);
    this.addBox(visual, 'Yellow lid plate', [0.72, 0.035, 0.56], [0, 0.698, 0], yellow);
    this.addBox(visual, 'Front label', [0.38, 0.16, 0.025], [0, 0.32, 0.394], charcoal);
    this.addBox(visual, 'Label bar left', [0.07, 0.075, 0.03], [-0.09, 0.32, 0.411], yellow);
    this.addBox(visual, 'Label bar right', [0.07, 0.075, 0.03], [0.09, 0.32, 0.411], yellow);
    this.addBox(visual, 'Side band left', [0.08, 0.56, 0.81], [-0.36, 0.32, 0], charcoal);
    this.addBox(visual, 'Side band right', [0.08, 0.56, 0.81], [0.36, 0.32, 0], charcoal);

    // Three brass rounds protrude from the lid to distinguish ammunition by shape.
    for (const x of [-0.22, 0, 0.22]) {
      this.addCylinder(visual, 'Brass cartridge', 0.057, 0.2, [x, 0.81, -0.015], brass);
      this.addCone(visual, 'Gold cartridge tip', 0.057, 0.1, [x, 0.96, -0.015], gold);
    }
  }
}
