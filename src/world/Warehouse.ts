import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Object3D } from 'three';
import { GAME_CONFIG } from '../shared/config';
import type { WorldQuery } from '../shared/types';

/** Greybox arena. TEAM 3 owns environment detail and the collision contract. */
export class Warehouse implements WorldQuery {
  readonly root = new Group();
  readonly bounds: Box3;
  readonly shotBlockers: Object3D[] = [];
  readonly spawnPoints = [new Vector3(-15, 0, -22), new Vector3(15, 0, -22), new Vector3(-15, 0, 22), new Vector3(15, 0, 22)];
  private readonly obstacles: Box3[] = [];
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly materials = {
    floor: new MeshStandardMaterial({ color: 0x19252e, roughness: 0.8, metalness: 0.3 }),
    wall: new MeshStandardMaterial({ color: 0x263844, roughness: 0.85 }),
    steel: new MeshStandardMaterial({ color: 0x344b59, roughness: 0.5, metalness: 0.7 }),
    crate: new MeshStandardMaterial({ color: 0x68543c, roughness: 1 }),
    yellow: new MeshStandardMaterial({ color: 0xd59e35, roughness: 0.7, metalness: 0.35 }),
  };

  constructor() {
    const { width, depth, height } = GAME_CONFIG.warehouse;
    this.root.name = 'Warehouse';
    this.bounds = new Box3(new Vector3(-width / 2, 0, -depth / 2), new Vector3(width / 2, height, depth / 2));
    this.box(width, 0.25, depth, 0, -0.125, 0, this.materials.floor, false);
    this.box(0.5, height, depth, -width / 2 - 0.25, height / 2, 0, this.materials.wall);
    this.box(0.5, height, depth, width / 2 + 0.25, height / 2, 0, this.materials.wall);
    this.box(width, height, 0.5, 0, height / 2, -depth / 2 - 0.25, this.materials.wall);
    this.box(width, height, 0.5, 0, height / 2, depth / 2 + 0.25, this.materials.wall);

    for (const z of [-18, -6, 6, 18]) {
      for (const x of [-17, 17]) {
        this.box(3.4, 0.2, 7, x, 2.7, z, this.materials.yellow, false);
        this.box(3.4, 0.2, 7, x, 5.4, z, this.materials.yellow, false);
        for (const dx of [-1.5, 1.5]) {
          for (const dz of [-3.2, 3.2]) this.box(0.16, 6, 0.16, x + dx, 3, z + dz, this.materials.steel);
        }
        this.box(2.8, 2.1, 5.5, x, 1.05, z, this.materials.crate);
        this.box(2.6, 1.7, 5.2, x, 3.65, z, this.materials.crate, false);
      }
      this.box(width, 0.3, 0.3, 0, 8.7, z, this.materials.steel, false);
      this.box(0.06, 0.01, 4, -5.5, 0.01, z, this.materials.yellow, false);
      this.box(0.06, 0.01, 4, 5.5, 0.01, z, this.materials.yellow, false);
    }
    this.box(3, 2, 3, -7, 1, -7, this.materials.crate);
    this.box(2, 1.5, 2, 7, 0.75, 4, this.materials.crate);
  }

  canOccupy(position: Vector3, radius: number): boolean {
    if (position.x - radius < this.bounds.min.x || position.x + radius > this.bounds.max.x ||
        position.z - radius < this.bounds.min.z || position.z + radius > this.bounds.max.z) return false;
    return !this.obstacles.some((box) => {
      const x = Math.max(box.min.x, Math.min(position.x, box.max.x));
      const z = Math.max(box.min.z, Math.min(position.z, box.max.z));
      return (position.x - x) ** 2 + (position.z - z) ** 2 < radius ** 2;
    });
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, material: MeshStandardMaterial, solid = true): void {
    const mesh = new Mesh(this.geometry, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    // Floors, overhead racks and beams also block shots, even if walkable below.
    this.shotBlockers.push(mesh);
    if (solid) this.obstacles.push(new Box3(new Vector3(x - w / 2, y - h / 2, z - d / 2), new Vector3(x + w / 2, y + h / 2, z + d / 2)));
  }

  dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
  }
}
